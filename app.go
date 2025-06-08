package main

import (
	"context"
	"fmt"
)

// App struct
type App struct {
	ctx                   context.Context
	audioService          *AudioService
	transcriptionService  *TranscriptionService
	fileService           *FileService
	costTrackingService   *CostTrackingService
	folderMonitorService  *FolderMonitorService
}

// NewApp creates a new App application struct
func NewApp(audioService *AudioService, transcriptionService *TranscriptionService, fileService *FileService, costTrackingService *CostTrackingService) *App {
	return &App{
		audioService:          audioService,
		transcriptionService:  transcriptionService,
		fileService:           fileService,
		costTrackingService:   costTrackingService,
		folderMonitorService:  NewFolderMonitorService(),
	}
}

// startup is called when the app starts up.
// The context here can be used to access the runtime features.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.audioService.SetContext(ctx)
	a.folderMonitorService.SetContext(ctx, a)

	devices, err := a.audioService.ListDevices()
	if err != nil {
		fmt.Printf("Error listing devices: %v\n", err)
		return
	}

	for _, device := range devices {
		fmt.Printf("Device: %s\n", device)
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// Audio service methods for the frontend

// StartRecording starts recording audio from the specified device
func (a *App) StartRecording(deviceName string) error {
	return a.audioService.StartRecording(deviceName)
}

// StopRecording stops the current recording
func (a *App) StopRecording() error {
	return a.audioService.StopRecording()
}

// GetInputDevices returns a list of available audio input devices
func (a *App) GetInputDevices() ([]string, error) {
	return a.audioService.ListInputDevices()
}

// GetDefaultInputDevice returns the default input device name
func (a *App) GetDefaultInputDevice() (string, error) {
	return a.audioService.GetDefaultInputDeviceName()
}

// Cost tracking methods for the frontend

// GetCostSummary returns a summary of costs
func (a *App) GetCostSummary() map[string]interface{} {
	return a.costTrackingService.GetCostSummary()
}

// GetDailyCosts returns daily cost breakdown for the last N days
func (a *App) GetDailyCosts(days int) []DailyCost {
	return a.costTrackingService.GetDailyCosts(days)
}

// EstimateCost estimates cost for a given duration without recording it
func (a *App) EstimateCost(durationSeconds float64) float64 {
	return a.costTrackingService.EstimateCost(durationSeconds)
}

// ResetSessionCost resets the session cost counter
func (a *App) ResetSessionCost() {
	a.costTrackingService.ResetSessionCost()
}

// Folder Monitor Methods

// SelectFolderToMonitor opens a folder picker and starts monitoring the selected folder
func (a *App) SelectFolderToMonitor() (string, error) {
	return a.folderMonitorService.SelectFolder()
}

// ScanMonitoredFolder rescans the currently selected folder for audio files
func (a *App) ScanMonitoredFolder() error {
	return a.folderMonitorService.ScanFolder()
}

// StartFolderMonitoring starts monitoring the selected folder for new files
func (a *App) StartFolderMonitoring() error {
	return a.folderMonitorService.StartMonitoring()
}

// StopFolderMonitoring stops monitoring the folder
func (a *App) StopFolderMonitoring() error {
	return a.folderMonitorService.StopMonitoring()
}

// ProcessAllFolderFiles processes all files in the folder
func (a *App) ProcessAllFolderFiles() error {
	return a.folderMonitorService.ProcessAllFiles()
}

// GetSelectedFolder returns the currently selected folder path
func (a *App) GetSelectedFolder() string {
	return a.folderMonitorService.GetSelectedFolder()
}

// GetFolderFiles returns the list of files found in the folder
func (a *App) GetFolderFiles() []AudioFile {
	return a.folderMonitorService.GetFiles()
}

// GetProcessingQueue returns the current processing queue
func (a *App) GetProcessingQueue() []AudioFile {
	return a.folderMonitorService.GetProcessingQueue()
}

// IsMonitoringFolder returns whether folder monitoring is active
func (a *App) IsMonitoringFolder() bool {
	return a.folderMonitorService.IsMonitoring()
}
