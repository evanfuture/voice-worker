package main

import (
	"bytes"
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// AudioFile represents a discovered audio file
type AudioFile struct {
	Name     string  `json:"name"`
	Path     string  `json:"path"`
	Size     string  `json:"size"`
	SizeBytes int64  `json:"size_bytes"`
	Duration int     `json:"duration"` // in seconds
	Status   string  `json:"status"`   // pending, queued, processing, completed, failed
}

// CostEstimate represents the cost estimation for files
type CostEstimate struct {
	Cost     float64 `json:"cost"`
	Duration float64 `json:"duration"` // in minutes
}

// FolderMonitorService handles folder monitoring and file processing
type FolderMonitorService struct {
	ctx             context.Context
	selectedFolder  string
	isMonitoring    bool
	watcher         *fsnotify.Watcher
	files           []AudioFile
	processingQueue []AudioFile
	mutex           sync.RWMutex
	app             *App
}

// NewFolderMonitorService creates a new folder monitor service
func NewFolderMonitorService() *FolderMonitorService {
	return &FolderMonitorService{
		files:           make([]AudioFile, 0),
		processingQueue: make([]AudioFile, 0),
		isMonitoring:    false,
	}
}

// SetContext sets the context for the service
func (fms *FolderMonitorService) SetContext(ctx context.Context, app *App) {
	fms.ctx = ctx
	fms.app = app
}

// SelectFolder opens a folder picker dialog and sets the selected folder
func (fms *FolderMonitorService) SelectFolder() (string, error) {
	options := runtime.OpenDialogOptions{
		Title: "Select Folder to Monitor",
	}

	folderPath, err := runtime.OpenDirectoryDialog(fms.ctx, options)
	if err != nil {
		return "", err
	}

	if folderPath == "" {
		return "", fmt.Errorf("no folder selected")
	}

	fms.mutex.Lock()
	fms.selectedFolder = folderPath
	fms.mutex.Unlock()

	// Scan the folder immediately after selection
	if err := fms.ScanFolder(); err != nil {
		return folderPath, fmt.Errorf("folder selected but scan failed: %v", err)
	}

	return folderPath, nil
}

// ScanFolder scans the selected folder for audio files
func (fms *FolderMonitorService) ScanFolder() error {
	fms.mutex.RLock()
	folderPath := fms.selectedFolder
	fms.mutex.RUnlock()

	if folderPath == "" {
		return fmt.Errorf("no folder selected")
	}

	var files []AudioFile
	supportedExtensions := map[string]bool{
		".wav":  true,
		".mp3":  true,
		".m4a":  true,
		".aac":  true,
		".flac": true,
		".ogg":  true,
	}

	err := filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Continue walking even if we hit an error
		}

		if d.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if !supportedExtensions[ext] {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil // Skip files we can't stat
		}

		// Estimate duration based on file size (rough approximation)
		// For better accuracy, we'd need to read audio metadata
		estimatedDuration := fms.estimateDurationFromSize(info.Size(), ext)

		audioFile := AudioFile{
			Name:      d.Name(),
			Path:      path,
			Size:      formatFileSize(info.Size()),
			SizeBytes: info.Size(),
			Duration:  estimatedDuration,
			Status:    "pending",
		}

		files = append(files, audioFile)
		return nil
	})

	if err != nil {
		return fmt.Errorf("error scanning folder: %v", err)
	}

	fms.mutex.Lock()
	fms.files = files
	fms.mutex.Unlock()

	// Emit event to frontend
	runtime.EventsEmit(fms.ctx, "folderFilesUpdate", files)

	// Calculate and emit cost estimate
	estimate := fms.calculateCostEstimate(files)
	runtime.EventsEmit(fms.ctx, "costEstimateUpdate", estimate)

	return nil
}

// StartMonitoring starts monitoring the selected folder for new files
func (fms *FolderMonitorService) StartMonitoring() error {
	fms.mutex.RLock()
	folderPath := fms.selectedFolder
	fms.mutex.RUnlock()

	if folderPath == "" {
		return fmt.Errorf("no folder selected")
	}

	if fms.isMonitoring {
		return fmt.Errorf("already monitoring")
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create watcher: %v", err)
	}

	err = watcher.Add(folderPath)
	if err != nil {
		watcher.Close()
		return fmt.Errorf("failed to watch folder: %v", err)
	}

	fms.mutex.Lock()
	fms.watcher = watcher
	fms.isMonitoring = true
	fms.mutex.Unlock()

	// Start watching in a goroutine
	go fms.watchFiles()

	return nil
}

// StopMonitoring stops monitoring the folder
func (fms *FolderMonitorService) StopMonitoring() error {
	fms.mutex.Lock()
	defer fms.mutex.Unlock()

	if !fms.isMonitoring {
		return fmt.Errorf("not currently monitoring")
	}

	if fms.watcher != nil {
		fms.watcher.Close()
		fms.watcher = nil
	}

	fms.isMonitoring = false
	return nil
}

// ProcessAllFiles adds all files to the processing queue
func (fms *FolderMonitorService) ProcessAllFiles() error {
	fms.mutex.Lock()
	defer fms.mutex.Unlock()

	if len(fms.files) == 0 {
		return fmt.Errorf("no files to process")
	}

	// Copy files to processing queue with "queued" status
	for _, file := range fms.files {
		if file.Status == "pending" {
			file.Status = "queued"
			fms.processingQueue = append(fms.processingQueue, file)
		}
	}

	// Emit updated queue
	runtime.EventsEmit(fms.ctx, "processingQueueUpdate", fms.processingQueue)

	// Start processing files asynchronously
	go fms.processQueuedFiles()

	return nil
}

// GetSelectedFolder returns the currently selected folder
func (fms *FolderMonitorService) GetSelectedFolder() string {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.selectedFolder
}

// GetFiles returns the current list of files
func (fms *FolderMonitorService) GetFiles() []AudioFile {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.files
}

// GetProcessingQueue returns the current processing queue
func (fms *FolderMonitorService) GetProcessingQueue() []AudioFile {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.processingQueue
}

// IsMonitoring returns whether the service is currently monitoring
func (fms *FolderMonitorService) IsMonitoring() bool {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.isMonitoring
}

// watchFiles monitors the folder for file system events
func (fms *FolderMonitorService) watchFiles() {
	defer func() {
		fms.mutex.Lock()
		if fms.watcher != nil {
			fms.watcher.Close()
			fms.watcher = nil
		}
		fms.isMonitoring = false
		fms.mutex.Unlock()
	}()

	for {
		select {
		case event, ok := <-fms.watcher.Events:
			if !ok {
				return
			}

			// Handle file creation and write events
			if event.Op&fsnotify.Create == fsnotify.Create || event.Op&fsnotify.Write == fsnotify.Write {
				// Check if it's an audio file
				ext := strings.ToLower(filepath.Ext(event.Name))
				supportedExtensions := map[string]bool{
					".wav": true, ".mp3": true, ".m4a": true,
					".aac": true, ".flac": true, ".ogg": true,
				}

				if supportedExtensions[ext] {
					// Rescan folder to update file list
					time.Sleep(100 * time.Millisecond) // Brief delay to ensure file is fully written
					fms.ScanFolder()
				}
			}

		case err, ok := <-fms.watcher.Errors:
			if !ok {
				return
			}
			fmt.Printf("Watcher error: %v\n", err)
		}
	}
}

// processQueuedFiles processes files in the queue
func (fms *FolderMonitorService) processQueuedFiles() {
	for {
		fms.mutex.Lock()
		var nextFile *AudioFile
		for i := range fms.processingQueue {
			if fms.processingQueue[i].Status == "queued" {
				nextFile = &fms.processingQueue[i]
				nextFile.Status = "processing"
				break
			}
		}
		fms.mutex.Unlock()

		if nextFile == nil {
			break // No more files to process
		}

		// Emit queue update
		runtime.EventsEmit(fms.ctx, "processingQueueUpdate", fms.processingQueue)

		// Process the file
		err := fms.processFile(*nextFile)

		fms.mutex.Lock()
		for i := range fms.processingQueue {
			if fms.processingQueue[i].Path == nextFile.Path {
				if err != nil {
					fms.processingQueue[i].Status = "failed"
				} else {
					fms.processingQueue[i].Status = "completed"
				}
				break
			}
		}
		fms.mutex.Unlock()

		// Emit final queue update
		runtime.EventsEmit(fms.ctx, "processingQueueUpdate", fms.processingQueue)
	}
}

// processFile transcribes a single audio file
func (fms *FolderMonitorService) processFile(file AudioFile) error {
	if fms.app == nil {
		return fmt.Errorf("app reference not set")
	}

	// Read the audio file
	audioData, err := os.ReadFile(file.Path)
	if err != nil {
		return fmt.Errorf("failed to read file: %v", err)
	}

	// Convert to buffer for the transcription service
	audioBuffer := bytes.NewBuffer(audioData)

	// Use the existing transcription service
	transcript, err := fms.app.transcriptionService.TranscribeAudio(audioBuffer)
	if err != nil {
		return fmt.Errorf("transcription failed: %v", err)
	}

	// Save the transcript
	filename := fms.app.fileService.WriteTranscript(transcript)
	if filename == "" {
		return fmt.Errorf("failed to save transcript")
	}

	// Track the cost
	duration := float64(file.Duration) // Duration is already in seconds
	fms.app.costTrackingService.RecordTranscription(duration, filename)

	// Emit transcript event
	runtime.EventsEmit(fms.ctx, "newTranscript", transcript)

	return nil
}

// estimateDurationFromSize estimates audio duration based on file size
func (fms *FolderMonitorService) estimateDurationFromSize(sizeBytes int64, extension string) int {
	// Very rough estimation - these are approximate bitrates
	var bitrate float64
	switch extension {
	case ".wav":
		bitrate = 1411.2 // CD quality
	case ".mp3":
		bitrate = 128 // Common MP3 bitrate
	case ".m4a", ".aac":
		bitrate = 128 // Common AAC bitrate
	case ".flac":
		bitrate = 800 // Compressed lossless
	case ".ogg":
		bitrate = 112 // Common OGG bitrate
	default:
		bitrate = 128 // Default fallback
	}

	// Duration = (file size in bits) / (bitrate in kbps * 1000)
	durationSeconds := float64(sizeBytes*8) / (bitrate * 1000)
	return int(durationSeconds)
}

// calculateCostEstimate calculates the estimated cost for a list of files
func (fms *FolderMonitorService) calculateCostEstimate(files []AudioFile) CostEstimate {
	totalDuration := 0
	for _, file := range files {
		totalDuration += file.Duration
	}

	durationMinutes := float64(totalDuration) / 60.0
	cost := durationMinutes * 0.006 // OpenAI Whisper pricing

	return CostEstimate{
		Cost:     cost,
		Duration: durationMinutes,
	}
}

// formatFileSize formats file size in human readable format
func formatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}
