package main

import (
	"context"
	"fmt"
	"log"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// CleanApp struct with the new service architecture
type CleanApp struct {
	ctx                context.Context
	voiceWorkerService *VoiceWorkerService
	convexClient       *ConvexClient
}

// NewCleanApp creates a new clean App application struct
func NewCleanApp() *CleanApp {
	convexClient, err := NewConvexClient()
	if err != nil {
		log.Fatalf("failed to create convex client: %v", err)
	}

	voiceWorkerService := NewVoiceWorkerService(convexClient)

	return &CleanApp{
		voiceWorkerService: voiceWorkerService,
		convexClient:       convexClient,
	}
}

// startup is called when the app starts up.
func (a *CleanApp) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize the voice worker service
	err := a.voiceWorkerService.Initialize(ctx)
	if err != nil {
		log.Printf("Warning: failed to initialize voice worker service: %v", err)
	}

	// Start the service
	err = a.voiceWorkerService.Start()
	if err != nil {
		log.Printf("Warning: failed to start voice worker service: %v", err)
	}

	// Reset any stale jobs from a previous run
	_, err = a.convexClient.CallMutation("jobs:resetStale", map[string]interface{}{})
	if err != nil {
		log.Printf("Warning: could not reset stale jobs: %v", err)
	}

	log.Println("Voice Worker started successfully")
}

// shutdown is called when the app is shutting down
func (a *CleanApp) shutdown(ctx context.Context) {
	if a.voiceWorkerService != nil {
		a.voiceWorkerService.Stop()
	}
}

// Greet returns a greeting for the given name
func (a *CleanApp) Greet(name string) string {
	return fmt.Sprintf("Hello %s, Voice Worker is ready!", name)
}

// === Folder Management Methods ===

// SelectFolderToMonitor opens a folder picker and returns the path
func (a *CleanApp) SelectFolderToMonitor() (string, error) {
	folderPath, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select folder to monitor",
	})
	return folderPath, err
}

// SetSelectedFolder configures the folder to monitor
func (a *CleanApp) SetSelectedFolder(folderId string, path string) error {
	return a.voiceWorkerService.SetSelectedFolder(folderId, path)
}

// GetSelectedFolder returns the currently selected folder path
func (a *CleanApp) GetSelectedFolder() string {
	return a.voiceWorkerService.GetSelectedFolder()
}

// ScanMonitoredFolder rescans the currently selected folder for files
func (a *CleanApp) ScanMonitoredFolder() error {
	return a.voiceWorkerService.ScanMonitoredFolder()
}

// StartFolderMonitoring starts monitoring the selected folder for new files
func (a *CleanApp) StartFolderMonitoring() error {
	return a.voiceWorkerService.StartFolderMonitoring()
}

// StopFolderMonitoring stops monitoring the folder
func (a *CleanApp) StopFolderMonitoring() error {
	return a.voiceWorkerService.StopFolderMonitoring()
}

// IsMonitoringFolder returns whether folder monitoring is active
func (a *CleanApp) IsMonitoringFolder() bool {
	return a.voiceWorkerService.IsMonitoringFolder()
}

// === Parser Management Methods ===

// GetAvailableParsers returns list of all available parsers
func (a *CleanApp) GetAvailableParsers() ([]map[string]interface{}, error) {
	parsers, err := a.voiceWorkerService.GetAvailableParsers()
	if err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for _, parser := range parsers {
		result = append(result, map[string]interface{}{
			"id":              parser.GetID(),
			"name":            parser.GetName(),
			"inputTypes":      parser.GetInputTypes(),
			"outputExtension": parser.GetOutputExtension(),
			"outputSuffix":    parser.GetOutputSuffix(),
			"configuration":   parser.GetConfiguration(),
		})
	}

	return result, nil
}

// EnableParser enables a parser by ID
func (a *CleanApp) EnableParser(parserId string) error {
	return a.voiceWorkerService.EnableParser(parserId)
}

// DisableParser disables a parser by ID
func (a *CleanApp) DisableParser(parserId string) error {
	return a.voiceWorkerService.DisableParser(parserId)
}

// ConfigureParser updates parser configuration
func (a *CleanApp) ConfigureParser(parserId string, config map[string]interface{}) error {
	return a.voiceWorkerService.parserManager.ConfigureParser(parserId, config)
}

// === Job Queue Management Methods ===

// GetQueueStatus returns current queue statistics
func (a *CleanApp) GetQueueStatus() QueueStatus {
	return a.voiceWorkerService.GetQueueStatus()
}

// QueueJob adds a new job to the processing queue
func (a *CleanApp) QueueJob(fileId, parserId, jobType string, priority int) error {
	job := JobRequest{
		FileID:   fileId,
		ParserID: parserId,
		JobType:  jobType,
		Priority: priority,
	}
	return a.voiceWorkerService.jobQueue.QueueJob(job)
}

// PauseJob pauses a specific job
func (a *CleanApp) PauseJob(jobId string) error {
	return a.voiceWorkerService.jobQueue.PauseJob(jobId)
}

// ResumeJob resumes a paused job
func (a *CleanApp) ResumeJob(jobId string) error {
	return a.voiceWorkerService.jobQueue.ResumeJob(jobId)
}

// CancelJob cancels a job
func (a *CleanApp) CancelJob(jobId string) error {
	return a.voiceWorkerService.jobQueue.CancelJob(jobId)
}

// RetryJob retries a failed job
func (a *CleanApp) RetryJob(jobId string) error {
	return a.voiceWorkerService.jobQueue.RetryJob(jobId)
}

// === File Management Methods ===

// ProcessAllFolderFiles queues parse jobs for all unprocessed files
func (a *CleanApp) ProcessAllFolderFiles() error {
	// Get all unprocessed files
	result, err := a.convexClient.CallQuery("files:getUnprocessed", map[string]interface{}{})
	if err != nil {
		return fmt.Errorf("failed to get unprocessed files: %v", err)
	}

	files, ok := result.([]interface{})
	if !ok {
		return fmt.Errorf("invalid files data")
	}

	// Queue jobs for each file
	for _, fileData := range files {
		fileMap, ok := fileData.(map[string]interface{})
		if !ok {
			continue
		}

		fileId, _ := fileMap["_id"].(string)
		fileType, _ := fileMap["fileType"].(string)

		// Get applicable parsers for this file type
		applicableParsers, err := a.voiceWorkerService.parserManager.GetApplicableParsers(fileType)
		if err != nil {
			log.Printf("Warning: failed to get applicable parsers for file %s: %v", fileId, err)
			continue
		}

		// Queue jobs for each applicable parser
		for _, parser := range applicableParsers {
			job := JobRequest{
				FileID:   fileId,
				ParserID: parser.GetID(),
				JobType:  "parse",
				Priority: 50, // Default priority
			}

			err = a.voiceWorkerService.jobQueue.QueueJob(job)
			if err != nil {
				log.Printf("Warning: failed to queue job for file %s with parser %s: %v", fileId, parser.GetID(), err)
			}
		}
	}

	return nil
}

// === Cost Tracking Methods ===

// GetCostSummary returns cost summary from the cost tracking service
func (a *CleanApp) GetCostSummary() (map[string]interface{}, error) {
	result, err := a.convexClient.CallQuery("cost_tracking:getSummary", map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to get cost summary: %v", err)
	}

	if summary, ok := result.(map[string]interface{}); ok {
		return summary, nil
	}

	return map[string]interface{}{}, nil
}

// EstimateCost estimates processing cost for a file
func (a *CleanApp) EstimateCost(filePath, parserId string) (float64, error) {
	parser, err := a.voiceWorkerService.parserManager.GetParser(parserId)
	if err != nil {
		return 0, fmt.Errorf("failed to get parser: %v", err)
	}

	return parser.EstimateCost(filePath)
}

// === Audio Recording Methods (Legacy Support) ===

// GetInputDevices returns a list of available audio input devices
func (a *CleanApp) GetInputDevices() ([]string, error) {
	// Return empty list since we're focusing on file processing
	return []string{}, nil
}

// GetDefaultInputDevice returns the default input device name
func (a *CleanApp) GetDefaultInputDevice() (string, error) {
	// Return empty since we're focusing on file processing
	return "", nil
}

// StartRecording starts recording audio from the specified device
func (a *CleanApp) StartRecording(deviceName string) error {
	// Not implemented in the clean architecture - focusing on file processing
	return fmt.Errorf("recording not available in file processing mode")
}

// StopRecording stops the current recording
func (a *CleanApp) StopRecording() error {
	// Not implemented in the clean architecture - focusing on file processing
	return fmt.Errorf("recording not available in file processing mode")
}

// ResetSessionCost resets the session cost counter
func (a *CleanApp) ResetSessionCost() {
	// Placeholder for session cost reset
	log.Println("Session cost reset (placeholder)")
}

// GetFolderFiles returns the list of files found in the folder
func (a *CleanApp) GetFolderFiles() ([]FileInfo, error) {
	// Get files from Convex for current folder
	result, err := a.convexClient.CallQuery("files:getByFolder", map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to get folder files: %v", err)
	}

	var files []FileInfo
	if filesData, ok := result.([]interface{}); ok {
		for _, fileData := range filesData {
			if fileMap, ok := fileData.(map[string]interface{}); ok {
				file := FileInfo{
					Name:      fileMap["name"].(string),
					Path:      fileMap["path"].(string),
					FileType:  fileMap["fileType"].(string),
					Extension: fileMap["extension"].(string),
					Status:    fileMap["status"].(string),
					IsOutput:  fileMap["isOutput"].(bool),
				}
				if sizeBytes, ok := fileMap["sizeBytes"].(float64); ok {
					file.SizeBytes = int64(sizeBytes)
					file.Size = fmt.Sprintf("%.2f MB", float64(file.SizeBytes)/(1024*1024))
				}
				files = append(files, file)
			}
		}
	}

	return files, nil
}

// GetProcessingQueue returns the current processing queue
func (a *CleanApp) GetProcessingQueue() ([]map[string]interface{}, error) {
	result, err := a.convexClient.CallQuery("jobs:getQueue", map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to get processing queue: %v", err)
	}

	var queue []map[string]interface{}
	if queueData, ok := result.([]interface{}); ok {
		for _, jobData := range queueData {
			if jobMap, ok := jobData.(map[string]interface{}); ok {
				queue = append(queue, jobMap)
			}
		}
	}

	return queue, nil
}
