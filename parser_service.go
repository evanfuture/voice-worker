package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// ParserService handles file parsing operations
type ParserService struct {
	app          *App
	convexClient *ConvexClient
	isRunning    bool
	mutex        sync.RWMutex
}

// NewParserService creates a new parser service
func NewParserService(app *App, convexClient *ConvexClient) *ParserService {
	return &ParserService{
		app:          app,
		convexClient: convexClient,
		isRunning:    false,
	}
}

// Start begins the parser processing loop
func (ps *ParserService) Start() {
	ps.mutex.Lock()
	if ps.isRunning {
		ps.mutex.Unlock()
		return
	}
	ps.isRunning = true
	ps.mutex.Unlock()

	fmt.Println("Parser Service started.")
	ticker := time.NewTicker(3 * time.Second) // Poll every 3 seconds
	defer ticker.Stop()

	for ps.isRunning {
		<-ticker.C
		ps.processNextJob()
	}
	fmt.Println("Parser Service stopped.")
}

// Stop gracefully stops the parser processing loop
func (ps *ParserService) Stop() {
	ps.mutex.Lock()
	ps.isRunning = false
	ps.mutex.Unlock()
}

// processNextJob gets the next parser job and processes it
func (ps *ParserService) processNextJob() {
	// Get next parser job from Convex
	jobInterface, err := ps.convexClient.CallQuery("jobs:getNextJob", map[string]interface{}{})
	if err != nil {
		fmt.Printf("Error fetching next parser job: %v\n", err)
		return
	}

	if jobInterface == nil {
		// No job to process
		return
	}

	job, ok := jobInterface.(map[string]interface{})
	if !ok {
		fmt.Println("Error: Could not parse job from Convex response")
		return
	}

	jobId, _ := job["_id"].(string)
	parserId, _ := job["parserId"].(string)
	relationshipId, _ := job["relationshipId"].(string)

	if jobId == "" || parserId == "" || relationshipId == "" {
		fmt.Printf("Error: Invalid job data - missing required fields\n")
		return
	}

	fmt.Printf("Processing parser job %s (parser: %s, relationship: %s)\n", jobId, parserId, relationshipId)

	// Update job status to processing
	_, err = ps.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "processing",
	})
	if err != nil {
		fmt.Printf("Error updating job %s to processing: %v\n", jobId, err)
		return
	}

	// Get parser details
	parserInterface, err := ps.convexClient.CallQuery("parsers:get", map[string]interface{}{"id": parserId})
	if err != nil || parserInterface == nil {
		ps.failJob(jobId, fmt.Sprintf("could not find parser %s: %v", parserId, err))
		return
	}

	parser := parserInterface.(map[string]interface{})
	parserType, _ := parser["name"].(string)

	// Get file relationship details
	relationshipInterface, err := ps.convexClient.CallQuery("file_relationships:get", map[string]interface{}{"id": relationshipId})
	if err != nil || relationshipInterface == nil {
		ps.failJob(jobId, fmt.Sprintf("could not find file relationship %s: %v", relationshipId, err))
		return
	}

	relationship := relationshipInterface.(map[string]interface{})
	inputFileId, _ := relationship["inputFileId"].(string)

	// Get input file details
	inputFileInterface, err := ps.convexClient.CallQuery("files:get", map[string]interface{}{"id": inputFileId})
	if err != nil || inputFileInterface == nil {
		ps.failJob(jobId, fmt.Sprintf("could not find input file %s: %v", inputFileId, err))
		return
	}

	inputFile := inputFileInterface.(map[string]interface{})
	inputPath, _ := inputFile["path"].(string)

	// Process based on parser type
	var outputPath string
	var processingErr error

	switch parserType {
	case "transcription":
		outputPath, processingErr = ps.processTranscription(inputPath, parser)
	case "summary":
		outputPath, processingErr = ps.processSummary(inputPath, parser)
	default:
		processingErr = fmt.Errorf("unknown parser type: %s", parserType)
	}

	if processingErr != nil {
		ps.failJob(jobId, fmt.Sprintf("parsing failed: %v", processingErr))
		return
	}

	// Update the relationship with the output file
	err = ps.completeJobWithOutput(jobId, relationshipId, outputPath)
	if err != nil {
		ps.failJob(jobId, fmt.Sprintf("failed to complete job: %v", err))
		return
	}

	fmt.Printf("Successfully processed parser job %s -> %s\n", jobId, outputPath)
}

// processTranscription handles audio transcription using Whisper
func (ps *ParserService) processTranscription(inputPath string, parser map[string]interface{}) (string, error) {
	// Read audio file
	audioData, err := os.ReadFile(inputPath)
	if err != nil {
		return "", fmt.Errorf("could not read audio file %s: %v", inputPath, err)
	}

	// Use existing transcription service
	transcript, err := ps.app.transcriptionService.TranscribeAudio(bytes.NewBuffer(audioData))
	if err != nil {
		return "", fmt.Errorf("transcription failed: %v", err)
	}

	// Generate output filename
	outputSuffix, _ := parser["outputSuffix"].(string)
	if outputSuffix == "" {
		outputSuffix = "_transcript"
	}

	outputExt, _ := parser["outputExtension"].(string)
	if outputExt == "" {
		outputExt = ".txt"
	}

	baseName := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))
	outputPath := filepath.Join(filepath.Dir(inputPath), baseName+outputSuffix+outputExt)

	// Write transcript to file
	err = os.WriteFile(outputPath, []byte(transcript), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write transcript: %v", err)
	}

	return outputPath, nil
}

// processSummary handles text summarization
func (ps *ParserService) processSummary(inputPath string, parser map[string]interface{}) (string, error) {
	// Read input text file
	content, err := os.ReadFile(inputPath)
	if err != nil {
		return "", fmt.Errorf("could not read text file %s: %v", inputPath, err)
	}

	text := strings.TrimSpace(string(content))
	if text == "" {
		return "", fmt.Errorf("input file is empty")
	}

	// Generate summary using a simple approach (can be enhanced with AI)
	summary := ps.generateSimpleSummary(text)

	// Generate output filename
	outputSuffix, _ := parser["outputSuffix"].(string)
	if outputSuffix == "" {
		outputSuffix = "_summary"
	}

	outputExt, _ := parser["outputExtension"].(string)
	if outputExt == "" {
		outputExt = ".txt"
	}

	baseName := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))
	outputPath := filepath.Join(filepath.Dir(inputPath), baseName+outputSuffix+outputExt)

	// Write summary to file
	err = os.WriteFile(outputPath, []byte(summary), 0644)
	if err != nil {
		return "", fmt.Errorf("failed to write summary: %v", err)
	}

	return outputPath, nil
}

// generateSimpleSummary creates a basic summary of text
func (ps *ParserService) generateSimpleSummary(text string) string {
	// Simple summarization: take first and last sentences, and some statistics
	sentences := strings.Split(text, ".")
	cleanSentences := make([]string, 0)

	for _, sentence := range sentences {
		sentence = strings.TrimSpace(sentence)
		if len(sentence) > 10 { // Only keep substantial sentences
			cleanSentences = append(cleanSentences, sentence)
		}
	}

	if len(cleanSentences) == 0 {
		return "Summary: [No substantial content found]"
	}

	words := strings.Fields(text)
	wordCount := len(words)
	sentenceCount := len(cleanSentences)

	summary := fmt.Sprintf("SUMMARY\n\n")
	summary += fmt.Sprintf("Document Statistics:\n")
	summary += fmt.Sprintf("- Word count: %d\n", wordCount)
	summary += fmt.Sprintf("- Sentence count: %d\n", sentenceCount)
	summary += fmt.Sprintf("- Estimated reading time: %.1f minutes\n\n", float64(wordCount)/200)

	if len(cleanSentences) >= 2 {
		summary += fmt.Sprintf("Key Points:\n")
		summary += fmt.Sprintf("- Opening: %s.\n", cleanSentences[0])
		if len(cleanSentences) > 2 {
			summary += fmt.Sprintf("- Middle: %s.\n", cleanSentences[len(cleanSentences)/2])
		}
		summary += fmt.Sprintf("- Closing: %s.\n", cleanSentences[len(cleanSentences)-1])
	} else {
		summary += fmt.Sprintf("Content: %s.\n", cleanSentences[0])
	}

	return summary
}

// completeJobWithOutput finalizes a job by creating the output file record and updating relationships
func (ps *ParserService) completeJobWithOutput(jobId, relationshipId, outputPath string) error {
	// First, create/update the output file in Convex
	outputInfo, err := os.Stat(outputPath)
	if err != nil {
		return fmt.Errorf("could not stat output file: %v", err)
	}

	outputHash, err := calculateFileHash(outputPath)
	if err != nil {
		return fmt.Errorf("could not hash output file: %v", err)
	}

	// Get the relationship to find folder info
	relationshipInterface, err := ps.convexClient.CallQuery("file_relationships:get", map[string]interface{}{"id": relationshipId})
	if err != nil {
		return fmt.Errorf("could not get relationship: %v", err)
	}

	relationship := relationshipInterface.(map[string]interface{})
	inputFileId := relationship["inputFileId"].(string)

	// Get input file to get folderId
	inputFileInterface, err := ps.convexClient.CallQuery("files:get", map[string]interface{}{"id": inputFileId})
	if err != nil {
		return fmt.Errorf("could not get input file: %v", err)
	}

	inputFile := inputFileInterface.(map[string]interface{})
	folderId := inputFile["folderId"].(string)

	// Determine file type
	ext := strings.ToLower(filepath.Ext(outputPath))
	fileType := "text" // Most outputs are text files

	// Create output file record
	outputFileArgs := map[string]interface{}{
		"path":      outputPath,
		"name":      filepath.Base(outputPath),
		"folderId":  folderId,
		"sizeBytes": outputInfo.Size(),
		"fileType":  fileType,
		"extension": ext,
		"hash":      outputHash,
		"isOutput":  true,
		"metadata":  map[string]interface{}{},
	}

	outputFileResult, err := ps.convexClient.CallMutation("files:upsert", outputFileArgs)
	if err != nil {
		return fmt.Errorf("failed to create output file record: %v", err)
	}

	outputFileId := outputFileResult.(string)

	// Update the relationship with the output file
	_, err = ps.convexClient.CallMutation("file_relationships:updateWithOutput", map[string]interface{}{
		"id":           relationshipId,
		"outputFileId": outputFileId,
		"status":       "completed",
	})
	if err != nil {
		return fmt.Errorf("failed to update relationship: %v", err)
	}

	// Mark job as completed
	_, err = ps.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "completed",
	})
	if err != nil {
		return fmt.Errorf("failed to complete job: %v", err)
	}

	return nil
}

// failJob marks a job as failed with an error message
func (ps *ParserService) failJob(jobId string, errorMessage string) {
	fmt.Printf("Parser job failed: %s\n", errorMessage)
	_, err := ps.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":           jobId,
		"status":       "failed",
		"errorMessage": errorMessage,
	})
	if err != nil {
		fmt.Printf("Error failing job %s: %v\n", jobId, err)
	}
}
