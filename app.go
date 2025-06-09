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
	convexClient          *ConvexClient
	parserService         *ParserService
}

// NewApp creates a new App application struct
func NewApp(audioService *AudioService, transcriptionService *TranscriptionService, fileService *FileService, costTrackingService *CostTrackingService, convexClient *ConvexClient) *App {
	app := &App{
		audioService:         audioService,
		transcriptionService: transcriptionService,
		fileService:          fileService,
		costTrackingService:  costTrackingService,
		folderMonitorService: NewFolderMonitorService(),
		convexClient:         convexClient,
	}
	app.parserService = NewParserService(app, convexClient)
	return app
}

// startup is called when the app starts up.
// The context here can be used to access the runtime features.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.audioService.SetContext(ctx)
	a.folderMonitorService.SetContext(ctx, a, a.convexClient)

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

func (a *App) SetSelectedFolder(folderId string, path string) error {
	return a.folderMonitorService.SetSelectedFolder(folderId, path)
}

// SelectFolderToMonitor opens a folder picker and returns the path
func (a *App) SelectFolderToMonitor() (string, error) {
	return a.folderMonitorService.SelectFolder()
}

// ScanMonitoredFolder rescans the currently selected folder for files
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

// GetFolderFiles returns the list of files found in the folder (backward compatibility)
func (a *App) GetFolderFiles() []FileInfo {
	return a.folderMonitorService.GetFiles()
}

// GetProcessingQueue returns the current processing queue (backward compatibility)
func (a *App) GetProcessingQueue() []FileInfo {
	return a.folderMonitorService.GetProcessingQueue()
}

// IsMonitoringFolder returns whether folder monitoring is active
func (a *App) IsMonitoringFolder() bool {
	return a.folderMonitorService.IsMonitoring()
}
