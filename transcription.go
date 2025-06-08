package main

import (
	"bytes"
	"context"
	"fmt"
	"os"

	openai "github.com/sashabaranov/go-openai"
	"github.com/joho/godotenv"
)

// TranscriptionService handles communication with the transcription API.
type TranscriptionService struct {
	client *openai.Client
}

// NewTranscriptionService creates a new TranscriptionService.
func NewTranscriptionService() (*TranscriptionService, error) {
	// Load .env file. This is not critical, so we ignore errors.
	_ = godotenv.Load()

	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY environment variable not set")
	}
	client := openai.NewClient(apiKey)
	return &TranscriptionService{client: client}, nil
}

// TranscribeAudio sends audio data to the Whisper API for transcription.
func (s *TranscriptionService) TranscribeAudio(audioData *bytes.Buffer) (string, error) {
	fmt.Println("Sending audio for transcription...")

	req := openai.AudioRequest{
		Model:    openai.Whisper1,
		Reader:   audioData,
		FilePath: "audio.wav", // Sending a WAV file now
	}

	resp, err := s.client.CreateTranscription(context.Background(), req)
	if err != nil {
		return "", fmt.Errorf("transcription failed: %w", err)
	}

	fmt.Println("Transcription successful.")
	return resp.Text, nil
}
