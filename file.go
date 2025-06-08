package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"
)

const transcriptsDir = "transcripts"

// FileService handles writing transcripts to disk.
type FileService struct{}

// NewFileService creates a new FileService.
func NewFileService() *FileService {
	// Ensure the transcripts directory exists.
	if err := os.MkdirAll(transcriptsDir, 0755); err != nil {
		fmt.Printf("Error creating transcripts directory: %v\n", err)
	}
	return &FileService{}
}

// WriteTranscript saves the transcript to a new file and returns the filename.
func (s *FileService) WriteTranscript(text string) string {
	filename := fmt.Sprintf("%d.txt", time.Now().UnixNano())
	path := filepath.Join(transcriptsDir, filename)

	fmt.Printf("Writing transcript to %s\n", path)

	err := os.WriteFile(path, []byte(text), 0644)
	if err != nil {
		fmt.Printf("Error writing transcript file: %v\n", err)
		return ""
	}
	return filename
}
