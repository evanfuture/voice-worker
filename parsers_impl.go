package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// TranscriptionParserImpl implements the Parser interface for audio transcription
type TranscriptionParserImpl struct {
	id              string
	name            string
	inputTypes      []string
	outputExtension string
	outputSuffix    string
	configuration   map[string]interface{}
}

func (t *TranscriptionParserImpl) GetID() string {
	return t.id
}

func (t *TranscriptionParserImpl) GetName() string {
	return t.name
}

func (t *TranscriptionParserImpl) GetInputTypes() []string {
	return t.inputTypes
}

func (t *TranscriptionParserImpl) GetOutputExtension() string {
	return t.outputExtension
}

func (t *TranscriptionParserImpl) GetOutputSuffix() string {
	return t.outputSuffix
}

func (t *TranscriptionParserImpl) CanProcess(filePath, fileType string) bool {
	if fileType != "audio" {
		return false
	}

	// Check supported audio extensions
	ext := strings.ToLower(filepath.Ext(filePath))
	supportedExts := map[string]bool{
		".mp3": true, ".wav": true, ".m4a": true, ".aac": true,
		".flac": true, ".ogg": true, ".wma": true,
	}

	return supportedExts[ext]
}

func (t *TranscriptionParserImpl) Process(ctx context.Context, inputPath, outputPath string) error {
	// Get API key from configuration
	apiKey, ok := t.configuration["apiKey"].(string)
	if !ok || apiKey == "" {
		return fmt.Errorf("OpenAI API key not configured")
	}

	// Open the audio file
	file, err := os.Open(inputPath)
	if err != nil {
		return fmt.Errorf("failed to open audio file: %v", err)
	}
	defer file.Close()

	// Create multipart form
	var requestBody bytes.Buffer
	writer := multipart.NewWriter(&requestBody)

	// Add file field
	fileWriter, err := writer.CreateFormFile("file", filepath.Base(inputPath))
	if err != nil {
		return fmt.Errorf("failed to create form file: %v", err)
	}

	_, err = io.Copy(fileWriter, file)
	if err != nil {
		return fmt.Errorf("failed to copy file data: %v", err)
	}

	// Add model field
	model := "whisper-1"
	if configModel, ok := t.configuration["model"].(string); ok && configModel != "" {
		model = configModel
	}

	err = writer.WriteField("model", model)
	if err != nil {
		return fmt.Errorf("failed to write model field: %v", err)
	}

	// Add response format
	err = writer.WriteField("response_format", "text")
	if err != nil {
		return fmt.Errorf("failed to write response format field: %v", err)
	}

	writer.Close()

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/audio/transcriptions", &requestBody)
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	client := &http.Client{Timeout: 30 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Read response
	transcription, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %v", err)
	}

	// Write transcription to output file
	err = os.WriteFile(outputPath, transcription, 0644)
	if err != nil {
		return fmt.Errorf("failed to write output file: %v", err)
	}

	return nil
}

func (t *TranscriptionParserImpl) EstimateCost(filePath string) (float64, error) {
	// Get file info
	info, err := os.Stat(filePath)
	if err != nil {
		return 0, err
	}

	// Estimate based on file size (rough approximation)
	// Assume 1MB per minute of audio, $0.006 per minute
	fileSizeMB := float64(info.Size()) / (1024 * 1024)
	estimatedMinutes := fileSizeMB // rough approximation
	cost := estimatedMinutes * 0.006 // OpenAI Whisper pricing

	return cost, nil
}

func (t *TranscriptionParserImpl) GetConfiguration() map[string]interface{} {
	if t.configuration == nil {
		t.configuration = make(map[string]interface{})
	}
	return t.configuration
}

func (t *TranscriptionParserImpl) SetConfiguration(config map[string]interface{}) error {
	t.configuration = config
	return nil
}

// SummaryParserImpl implements the Parser interface for text summarization
type SummaryParserImpl struct {
	id              string
	name            string
	inputTypes      []string
	outputExtension string
	outputSuffix    string
	configuration   map[string]interface{}
}

func (s *SummaryParserImpl) GetID() string {
	return s.id
}

func (s *SummaryParserImpl) GetName() string {
	return s.name
}

func (s *SummaryParserImpl) GetInputTypes() []string {
	return s.inputTypes
}

func (s *SummaryParserImpl) GetOutputExtension() string {
	return s.outputExtension
}

func (s *SummaryParserImpl) GetOutputSuffix() string {
	return s.outputSuffix
}

func (s *SummaryParserImpl) CanProcess(filePath, fileType string) bool {
	if fileType != "text" {
		return false
	}

	// Only process .txt files, and avoid processing our own outputs
	if !strings.HasSuffix(filePath, ".txt") {
		return false
	}

	// Don't process summary files
	if strings.Contains(filepath.Base(filePath), "_summary") {
		return false
	}

	return true
}

func (s *SummaryParserImpl) Process(ctx context.Context, inputPath, outputPath string) error {
	// Get API key from configuration
	apiKey, ok := s.configuration["apiKey"].(string)
	if !ok || apiKey == "" {
		return fmt.Errorf("OpenAI API key not configured")
	}

	// Read input text
	textContent, err := os.ReadFile(inputPath)
	if err != nil {
		return fmt.Errorf("failed to read input file: %v", err)
	}

	text := string(textContent)
	if len(text) == 0 {
		return fmt.Errorf("input file is empty")
	}

	// Get model from configuration
	model := "gpt-3.5-turbo"
	if configModel, ok := s.configuration["model"].(string); ok && configModel != "" {
		model = configModel
	}

	// Create request payload
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]interface{}{
			{
				"role": "system",
				"content": "You are a helpful assistant that creates concise summaries of text content. Provide a clear, informative summary that captures the key points and main ideas.",
			},
			{
				"role": "user",
				"content": fmt.Sprintf("Please summarize this text:\n\n%s", text),
			},
		},
		"max_tokens": 500,
		"temperature": 0.3,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal request payload: %v", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(payloadBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	// Send request
	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	err = json.NewDecoder(resp.Body).Decode(&response)
	if err != nil {
		return fmt.Errorf("failed to decode response: %v", err)
	}

	if len(response.Choices) == 0 {
		return fmt.Errorf("no summary generated")
	}

	summary := response.Choices[0].Message.Content

	// Write summary to output file
	err = os.WriteFile(outputPath, []byte(summary), 0644)
	if err != nil {
		return fmt.Errorf("failed to write output file: %v", err)
	}

	return nil
}

func (s *SummaryParserImpl) EstimateCost(filePath string) (float64, error) {
	// Read file to estimate token count
	content, err := os.ReadFile(filePath)
	if err != nil {
		return 0, err
	}

	// Rough token estimation: ~4 characters per token
	estimatedTokens := len(content) / 4

	// GPT-3.5-turbo pricing: $0.0015 per 1K input tokens, $0.002 per 1K output tokens
	inputCost := float64(estimatedTokens+100) / 1000.0 * 0.0015
	outputCost := 500.0 / 1000.0 * 0.002

	return inputCost + outputCost, nil
}

func (s *SummaryParserImpl) GetConfiguration() map[string]interface{} {
	if s.configuration == nil {
		s.configuration = make(map[string]interface{})
	}
	return s.configuration
}

func (s *SummaryParserImpl) SetConfiguration(config map[string]interface{}) error {
	s.configuration = config
	return nil
}
