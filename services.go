package main

import (
	"context"
)

// Core service interfaces for the file processing pipeline

// FileWatcherService monitors a dropbox folder and syncs file state to Convex
type FileWatcherService interface {
	// SetMonitoredFolder configures which folder to monitor
	SetMonitoredFolder(folderId, path string) error

	// StartMonitoring begins filesystem watching
	StartMonitoring() error

	// StopMonitoring stops filesystem watching
	StopMonitoring() error

	// IsMonitoring returns current monitoring status
	IsMonitoring() bool

	// ScanFolder performs initial scan of folder contents
	ScanFolder() error

	// GetSelectedFolder returns current monitored folder path
	GetSelectedFolder() string
}

// ParserManagerService manages parsers and their configurations
type ParserManagerService interface {
	// GetAvailableParsers returns list of all parsers
	GetAvailableParsers() ([]Parser, error)

	// GetEnabledParsers returns list of enabled parsers
	GetEnabledParsers() ([]Parser, error)

	// EnableParser enables a parser by ID
	EnableParser(parserId string) error

	// DisableParser disables a parser by ID
	DisableParser(parserId string) error

	// ConfigureParser updates parser configuration
	ConfigureParser(parserId string, config map[string]interface{}) error

	// GetApplicableParsers returns parsers that can process a file type
	GetApplicableParsers(fileType string) ([]Parser, error)

	// GetParser returns a specific parser by ID
	GetParser(parserId string) (Parser, error)
}

// JobQueueService processes parsing jobs in the background
type JobQueueService interface {
	// StartProcessing begins job queue processing
	StartProcessing()

	// StopProcessing stops job queue processing
	StopProcessing()

	// QueueJob adds a new job to the queue
	QueueJob(job JobRequest) error

	// GetQueueStatus returns current queue statistics
	GetQueueStatus() QueueStatus

	// PauseJob pauses a specific job
	PauseJob(jobId string) error

	// ResumeJob resumes a paused job
	ResumeJob(jobId string) error

	// CancelJob cancels a job
	CancelJob(jobId string) error

	// RetryJob retries a failed job
	RetryJob(jobId string) error
}

// Parser interface for pluggable parser implementations
type Parser interface {
	// GetID returns the parser's unique identifier
	GetID() string

	// GetName returns human-readable parser name
	GetName() string

	// GetInputTypes returns file types this parser can process
	GetInputTypes() []string

	// GetOutputExtension returns the file extension for outputs
	GetOutputExtension() string

	// GetOutputSuffix returns suffix added to output filenames
	GetOutputSuffix() string

	// CanProcess returns whether this parser can handle the file
	CanProcess(filePath, fileType string) bool

	// Process processes the input file and creates output
	Process(ctx context.Context, inputPath, outputPath string) error

	// EstimateCost estimates processing cost for the file
	EstimateCost(filePath string) (float64, error)

	// GetConfiguration returns current parser configuration
	GetConfiguration() map[string]interface{}

	// SetConfiguration updates parser configuration
	SetConfiguration(config map[string]interface{}) error
}

// Data structures

type JobRequest struct {
	FileID       string                 `json:"fileId"`
	ParserID     string                 `json:"parserId"`
	JobType      string                 `json:"jobType"`
	Priority     int                    `json:"priority"`
	Metadata     map[string]interface{} `json:"metadata,omitempty"`
}

type QueueStatus struct {
	TotalJobs     int `json:"totalJobs"`
	PendingJobs   int `json:"pendingJobs"`
	ProcessingJobs int `json:"processingJobs"`
	CompletedJobs int `json:"completedJobs"`
	FailedJobs    int `json:"failedJobs"`
	PausedJobs    int `json:"pausedJobs"`
}

// Main service coordinator
type VoiceWorkerService struct {
	fileWatcher   FileWatcherService
	parserManager ParserManagerService
	jobQueue      JobQueueService
	convexClient  *ConvexClient
	ctx           context.Context
}

func NewVoiceWorkerService(convexClient *ConvexClient) *VoiceWorkerService {
	return &VoiceWorkerService{
		convexClient: convexClient,
	}
}

func (v *VoiceWorkerService) Initialize(ctx context.Context) error {
	v.ctx = ctx

	// Initialize all services
	fileWatcher := NewFileWatcherServiceImpl(v.convexClient)
	fileWatcher.SetContext(ctx)
	v.fileWatcher = fileWatcher

	v.parserManager = NewParserManagerServiceImpl(v.convexClient)
	v.jobQueue = NewJobQueueServiceImpl(v.convexClient, v.parserManager)

	return nil
}

func (v *VoiceWorkerService) Start() error {
	// Start the job queue processor
	v.jobQueue.StartProcessing()
	return nil
}

func (v *VoiceWorkerService) Stop() error {
	// Stop services gracefully
	if v.fileWatcher != nil && v.fileWatcher.IsMonitoring() {
		v.fileWatcher.StopMonitoring()
	}
	if v.jobQueue != nil {
		v.jobQueue.StopProcessing()
	}
	return nil
}

// Frontend interface methods
func (v *VoiceWorkerService) SetSelectedFolder(folderId, path string) error {
	return v.fileWatcher.SetMonitoredFolder(folderId, path)
}

func (v *VoiceWorkerService) StartFolderMonitoring() error {
	return v.fileWatcher.StartMonitoring()
}

func (v *VoiceWorkerService) StopFolderMonitoring() error {
	return v.fileWatcher.StopMonitoring()
}

func (v *VoiceWorkerService) ScanMonitoredFolder() error {
	return v.fileWatcher.ScanFolder()
}

func (v *VoiceWorkerService) GetSelectedFolder() string {
	return v.fileWatcher.GetSelectedFolder()
}

func (v *VoiceWorkerService) IsMonitoringFolder() bool {
	return v.fileWatcher.IsMonitoring()
}

func (v *VoiceWorkerService) GetQueueStatus() QueueStatus {
	return v.jobQueue.GetQueueStatus()
}

func (v *VoiceWorkerService) GetAvailableParsers() ([]Parser, error) {
	return v.parserManager.GetAvailableParsers()
}

func (v *VoiceWorkerService) EnableParser(parserId string) error {
	return v.parserManager.EnableParser(parserId)
}

func (v *VoiceWorkerService) DisableParser(parserId string) error {
	return v.parserManager.DisableParser(parserId)
}
