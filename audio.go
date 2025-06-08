package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"time"

	"github.com/go-audio/audio"
	"github.com/go-audio/wav"
	"github.com/gordonklaus/portaudio"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const sampleRate = 44100

// AudioService handles all audio recording functionality.
type AudioService struct {
	ctx                  context.Context
	stream               *portaudio.Stream
	audioBuffer          bytes.Buffer
	isRecording          bool
	recordingStartTime   time.Time
	transcriptionService *TranscriptionService
	fileService          *FileService
	costTrackingService  *CostTrackingService
	devices              []*portaudio.DeviceInfo
}

// NewAudioService creates a new AudioService.
func NewAudioService(transcriptionService *TranscriptionService, fileService *FileService, costTrackingService *CostTrackingService) *AudioService {
	return &AudioService{
		transcriptionService: transcriptionService,
		fileService:          fileService,
		costTrackingService:  costTrackingService,
	}
}

// Initialize initializes the audio service.
func (s *AudioService) Initialize() {
	fmt.Println("Initializing PortAudio...")
	if err := portaudio.Initialize(); err != nil {
		fmt.Printf("Error initializing PortAudio: %v\n", err)
	}
}

// Teardown cleans up the audio service.
func (s *AudioService) Teardown(ctx context.Context) {
	if s.isRecording {
		if err := s.StopRecording(); err != nil {
			fmt.Printf("Error stopping recording during teardown: %v\n", err)
		}
	}
	if err := portaudio.Terminate(); err != nil {
		fmt.Printf("Error terminating PortAudio: %v\n", err)
	}
	fmt.Println("PortAudio terminated.")
}

// ListDevices lists the available audio input devices.
func (s *AudioService) ListDevices() ([]string, error) {
	devices, err := portaudio.Devices()
	if err != nil {
		return nil, fmt.Errorf("failed to get devices: %w", err)
	}
	var deviceNames []string
	for _, device := range devices {
		// We only care about input devices
		if device.MaxInputChannels > 0 {
			deviceNames = append(deviceNames, device.Name)
		}
	}
	return deviceNames, nil
}

// ListInputDevices returns a list of available audio input device names.
// It also caches the full device info list for internal use.
func (s *AudioService) ListInputDevices() ([]string, error) {
	if s.devices == nil {
		devs, err := portaudio.Devices()
		if err != nil {
			return nil, fmt.Errorf("failed to get devices: %w", err)
		}
		s.devices = devs
	}

	var deviceNames []string
	for _, device := range s.devices {
		if device.MaxInputChannels > 0 {
			deviceNames = append(deviceNames, device.Name)
		}
	}
	return deviceNames, nil
}

// StartRecording opens the specified audio stream and starts reading from it.
func (s *AudioService) StartRecording(deviceName string) error {
	if s.isRecording {
		return fmt.Errorf("already recording")
	}

	if s.devices == nil {
		if _, err := s.ListInputDevices(); err != nil {
			return fmt.Errorf("could not list devices before recording: %w", err)
		}
	}

	var targetDevice *portaudio.DeviceInfo
	for _, device := range s.devices {
		if device.Name == deviceName && device.MaxInputChannels > 0 {
			targetDevice = device
			break
		}
	}

	if targetDevice == nil {
		return fmt.Errorf("input device not found: %s. please select a valid device", deviceName)
	}

	fmt.Printf("Starting recording on device: %s\n", targetDevice.Name)

	buffer := make([]int16, 256)

	streamParameters := portaudio.StreamParameters{
		Input: portaudio.StreamDeviceParameters{
			Device:   targetDevice,
			Channels: 1,
			Latency:  targetDevice.DefaultLowInputLatency,
		},
		SampleRate:      sampleRate,
		FramesPerBuffer: len(buffer),
	}

	stream, err := portaudio.OpenStream(streamParameters, func(in []int16) {
		// Convert []int16 to []byte and write to buffer
		for i := range in {
			binary.Write(&s.audioBuffer, binary.LittleEndian, in[i])
		}
	})
	if err != nil {
		return fmt.Errorf("failed to open stream on device %s: %w", targetDevice.Name, err)
	}

	if err := stream.Start(); err != nil {
		return fmt.Errorf("failed to start stream: %w", err)
	}

	s.stream = stream
	s.isRecording = true
	s.recordingStartTime = time.Now()
	runtime.EventsEmit(s.ctx, "statusUpdate", "Recording...")
	fmt.Println("Recording started.")

	return nil
}

// StopRecording stops the audio stream and processes the recorded audio.
func (s *AudioService) StopRecording() error {
	if !s.isRecording {
		return fmt.Errorf("not recording")
	}
	if err := s.stream.Stop(); err != nil {
		return fmt.Errorf("failed to stop stream: %w", err)
	}
	if err := s.stream.Close(); err != nil {
		return fmt.Errorf("failed to close stream: %w", err)
	}
	s.isRecording = false

	// Process the recorded audio if we have any
	if s.audioBuffer.Len() > 0 {
		runtime.EventsEmit(s.ctx, "statusUpdate", "Transcribing...")
		fmt.Println("Processing recorded audio...")

		// Calculate recording duration
		recordingDuration := time.Since(s.recordingStartTime).Seconds()
		fmt.Printf("Recording duration: %.2f seconds\n", recordingDuration)

		wavBuffer, err := s.encodeWAV(s.audioBuffer.Bytes())
		if err != nil {
			fmt.Printf("Error encoding WAV: %v\n", err)
			runtime.EventsEmit(s.ctx, "statusUpdate", "Error")
			return fmt.Errorf("failed to encode audio: %w", err)
		}

		go func() {
			transcript, err := s.transcriptionService.TranscribeAudio(wavBuffer)
			if err != nil {
				fmt.Printf("Error during transcription: %v\n", err)
				runtime.EventsEmit(s.ctx, "statusUpdate", fmt.Sprintf("Error: %v", err))
				return
			}

			fmt.Printf("Transcript: %s\n", transcript)
			runtime.EventsEmit(s.ctx, "newTranscript", transcript)

			// Record the transcription cost
			filename := s.fileService.WriteTranscript(transcript)
			if filename != "" {
				cost := s.costTrackingService.RecordTranscription(recordingDuration, filename)

				// Emit cost update event
				costSummary := s.costTrackingService.GetCostSummary()
				runtime.EventsEmit(s.ctx, "costUpdate", costSummary)

				fmt.Printf("Cost for this transcription: $%.4f\n", cost)
			}

			runtime.EventsEmit(s.ctx, "statusUpdate", "Idle")
		}()

		s.audioBuffer.Reset()
	} else {
		runtime.EventsEmit(s.ctx, "statusUpdate", "Idle")
	}

	fmt.Println("Recording stopped.")
	return nil
}

func (s *AudioService) encodeWAV(input []byte) (*bytes.Buffer, error) {
	// The WAV encoder needs an io.WriteSeeker. A temp file is a simple way to provide one.
	tmpfile, err := os.CreateTemp("", "recording-*.wav")
	if err != nil {
		return nil, fmt.Errorf("could not create temp file: %w", err)
	}
	defer os.Remove(tmpfile.Name()) // Clean up the temp file

	numSamples := len(input) / 2 // 2 bytes per int16
	audioFormat := 1             // PCM
	numChannels := 1
	bitDepth := 16

	e := wav.NewEncoder(tmpfile, sampleRate, bitDepth, numChannels, audioFormat)

	// PortAudio gives us signed 16-bit integers. We need to convert the
	// raw bytes back to that format.
	intBuf := make([]int, numSamples)
	for i := 0; i < numSamples; i++ {
		sample := int16(binary.LittleEndian.Uint16(input[i*2 : (i+1)*2]))
		intBuf[i] = int(sample)
	}

	audioBuf := &audio.IntBuffer{
		Format: &audio.Format{
			NumChannels: numChannels,
			SampleRate:  sampleRate,
		},
		Data:           intBuf,
		SourceBitDepth: bitDepth,
	}

	if err := e.Write(audioBuf); err != nil {
		return nil, err
	}
	if err := e.Close(); err != nil {
		return nil, err
	}

	// The file is written, now read it back into a buffer.
	wavData, err := os.ReadFile(tmpfile.Name())
	if err != nil {
		return nil, fmt.Errorf("could not read temp wav file: %w", err)
	}

	return bytes.NewBuffer(wavData), nil
}

// SetContext sets the application context for the service.
func (s *AudioService) SetContext(ctx context.Context) {
	s.ctx = ctx
}

// GetDefaultInputDeviceName returns the name of the default audio input device.
func (s *AudioService) GetDefaultInputDeviceName() (string, error) {
	device, err := portaudio.DefaultInputDevice()
	if err != nil {
		return "", fmt.Errorf("failed to get default input device: %w", err)
	}
	return device.Name, nil
}
