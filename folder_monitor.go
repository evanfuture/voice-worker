package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// FileInfo represents a discovered file in the dropbox folder
type FileInfo struct {
	Name      string  `json:"name"`
	Path      string  `json:"path"`
	Size      string  `json:"size"`
	SizeBytes int64   `json:"size_bytes"`
	FileType  string  `json:"file_type"`
	Extension string  `json:"extension"`
	IsOutput  bool    `json:"is_output"`
	Status    string  `json:"status"`
}

// AudioFile for backward compatibility with existing UI
type AudioFile = FileInfo

// CostEstimate represents the cost estimation for files
type CostEstimate struct {
	Cost     float64 `json:"cost"`
	Duration float64 `json:"duration"` // in minutes
}

// FolderMonitorService handles folder monitoring and file processing
type FolderMonitorService struct {
	ctx             context.Context
	selectedFolder  string
	selectedFolderId string // Convex folder ID
	isMonitoring    bool
	watcher         *fsnotify.Watcher
	files           []FileInfo
	processingQueue []FileInfo
	mutex           sync.RWMutex
	app             *App
	convexClient    *ConvexClient
}

// File type detection mappings
var fileTypeExtensions = map[string]string{
	// Audio files
	".wav":  "audio",
	".mp3":  "audio",
	".m4a":  "audio",
	".aac":  "audio",
	".flac": "audio",
	".ogg":  "audio",
	".wma":  "audio",

	// Text files
	".txt":  "text",
	".md":   "text",
	".rtf":  "text",
	".doc":  "text",
	".docx": "text",
	".pdf":  "text",

	// Other types can be added later
}

// Output file patterns for detection
var outputSuffixes = []string{
	"_summary",
	"_transcript",
	"_processed",
}

// NewFolderMonitorService creates a new folder monitor service
func NewFolderMonitorService() *FolderMonitorService {
	return &FolderMonitorService{
		files:           make([]FileInfo, 0),
		processingQueue: make([]FileInfo, 0),
		isMonitoring:    false,
	}
}

// SetContext sets the context for the service
func (fms *FolderMonitorService) SetContext(ctx context.Context, app *App, convexClient *ConvexClient) {
	fms.ctx = ctx
	fms.app = app
	fms.convexClient = convexClient
}

// SetSelectedFolder sets the current folder for scanning and monitoring
func (fms *FolderMonitorService) SetSelectedFolder(folderId string, path string) error {
	fms.mutex.Lock()
	fms.selectedFolder = path
	fms.selectedFolderId = folderId
	fms.mutex.Unlock()

	// Automatically scan the folder when it's set
	go fms.ScanFolder()

	return nil
}

// SelectFolder opens a folder picker dialog and returns the path
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

	return folderPath, nil
}

// ScanFolder scans the selected folder for all supported files and upserts them to Convex
func (fms *FolderMonitorService) ScanFolder() error {
	fms.mutex.RLock()
	folderPath := fms.selectedFolder
	folderId := fms.selectedFolderId
	fms.mutex.RUnlock()

	if folderPath == "" {
		return fmt.Errorf("no folder selected")
	}
	if folderId == "" {
		return fmt.Errorf("no folderId provided")
	}

	err := filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Continue walking even if we hit an error
		}

		if d.IsDir() || d.Name() == ".DS_Store" {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		fileType, isSupported := fileTypeExtensions[ext]
		if !isSupported {
			return nil // Skip unsupported file types
		}

		info, err := d.Info()
		if err != nil {
			return nil // Skip files we can't stat
		}

		// Calculate file hash
		hash, err := calculateFileHash(path)
		if err != nil {
			fmt.Printf("failed to hash file %s: %v\n", path, err)
			return nil // Skip files we can't hash
		}

		// Determine if this is an output file based on naming patterns
		isOutput := fms.isOutputFile(d.Name())

		// Prepare metadata based on file type
		metadata := map[string]interface{}{}
		if fileType == "audio" {
			estimatedDuration := fms.estimateDurationFromSize(info.Size(), ext)
			metadata["estimatedDuration"] = estimatedDuration
		}

		// Upsert file to Convex
		args := map[string]interface{}{
			"path":      path,
			"name":      d.Name(),
			"folderId":  folderId,
			"sizeBytes": info.Size(),
			"fileType":  fileType,
			"extension": ext,
			"hash":      hash,
			"isOutput":  isOutput,
			"metadata":  metadata,
		}

		_, mutationErr := fms.convexClient.CallMutation("files:upsert", args)
		if mutationErr != nil {
			fmt.Printf("failed to upsert file %s to convex: %v\n", d.Name(), mutationErr)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("error scanning folder: %v", err)
	}

	fmt.Println("Folder scan complete, data sent to Convex.")
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

// ProcessAllFiles gets all unprocessed files from Convex and creates parsing jobs
func (fms *FolderMonitorService) ProcessAllFiles() error {
	fms.mutex.RLock()
	folderId := fms.selectedFolderId
	fms.mutex.RUnlock()

	if folderId == "" {
		return fmt.Errorf("no folder selected")
	}

	// Initialize default parsers if they don't exist
	_, err := fms.convexClient.CallMutation("parsers:initializeDefaults", map[string]interface{}{})
	if err != nil {
		fmt.Printf("Warning: failed to initialize default parsers: %v\n", err)
	}

	// Get enabled parsers
	parsersResult, err := fms.convexClient.CallQuery("parsers:listEnabled", map[string]interface{}{})
	if err != nil {
		return fmt.Errorf("failed to fetch enabled parsers: %w", err)
	}

	parsers, ok := parsersResult.([]interface{})
	if !ok || len(parsers) == 0 {
		return fmt.Errorf("no enabled parsers found")
	}

	jobsCreated := 0

	// For each enabled parser, create jobs for applicable files
	for _, parserInterface := range parsers {
		parser, ok := parserInterface.(map[string]interface{})
		if !ok {
			continue
		}

		parserId, _ := parser["_id"].(string)
		if parserId == "" {
			continue
		}

		// Create jobs for this parser
		createJobsArgs := map[string]interface{}{
			"parserId": parserId,
			"folderId": folderId,
		}

		result, err := fms.convexClient.CallMutation("jobs:createJobsForParser", createJobsArgs)
		if err != nil {
			fmt.Printf("Warning: failed to create jobs for parser %s: %v\n", parserId, err)
			continue
		}

		if jobIds, ok := result.([]interface{}); ok {
			jobsCreated += len(jobIds)
			fmt.Printf("Created %d jobs for parser %s\n", len(jobIds), parserId)
		}
	}

	if jobsCreated == 0 {
		fmt.Println("No jobs created - all applicable files may already be processed.")
	} else {
		fmt.Printf("Successfully created %d total jobs for processing.\n", jobsCreated)
	}

	return nil
}

// GetSelectedFolder returns the currently selected folder
func (fms *FolderMonitorService) GetSelectedFolder() string {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.selectedFolder
}

// GetFiles returns the current list of files (deprecated - use Convex queries)
func (fms *FolderMonitorService) GetFiles() []FileInfo {
	fms.mutex.RLock()
	defer fms.mutex.RUnlock()
	return fms.files
}

// GetProcessingQueue returns the current processing queue (deprecated)
func (fms *FolderMonitorService) GetProcessingQueue() []FileInfo {
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
	for {
		select {
		case event, ok := <-fms.watcher.Events:
			if !ok {
				return
			}

			ext := strings.ToLower(filepath.Ext(event.Name))
			fileType, isSupported := fileTypeExtensions[ext]
			if !isSupported {
				continue
			}

			if event.Op&fsnotify.Create == fsnotify.Create || event.Op&fsnotify.Write == fsnotify.Write {
				fmt.Printf("File created/modified: %s\n", event.Name)
				fms.handleFileCreated(event.Name, fileType, ext)
			} else if event.Op&fsnotify.Remove == fsnotify.Remove || event.Op&fsnotify.Rename == fsnotify.Rename {
				fmt.Printf("File removed/renamed: %s\n", event.Name)
				fms.handleFileDeleted(event.Name)
			}

		case err, ok := <-fms.watcher.Errors:
			if !ok {
				return
			}
			fmt.Println("watcher error:", err)
		}
	}
}

// handleFileCreated handles when a new file is created or modified
func (fms *FolderMonitorService) handleFileCreated(filePath, fileType, extension string) {
	// Wait a moment for file to be fully written
	time.Sleep(100 * time.Millisecond)

	info, err := os.Stat(filePath)
	if err != nil {
		fmt.Printf("could not stat file %s: %v", filePath, err)
		return
	}

	hash, err := calculateFileHash(filePath)
	if err != nil {
		fmt.Printf("failed to hash file %s: %v\n", filePath, err)
		return
	}

	// Determine if this is an output file
	isOutput := fms.isOutputFile(filepath.Base(filePath))

	fms.mutex.RLock()
	folderId := fms.selectedFolderId
	fms.mutex.RUnlock()

	// Prepare metadata based on file type
	metadata := map[string]interface{}{}
	if fileType == "audio" {
		estimatedDuration := fms.estimateDurationFromSize(info.Size(), extension)
		metadata["estimatedDuration"] = estimatedDuration
	}

	args := map[string]interface{}{
		"path":      filePath,
		"name":      filepath.Base(filePath),
		"folderId":  folderId,
		"sizeBytes": info.Size(),
		"fileType":  fileType,
		"extension": extension,
		"hash":      hash,
		"isOutput":  isOutput,
		"metadata":  metadata,
	}

	_, mutationErr := fms.convexClient.CallMutation("files:upsert", args)
	if mutationErr != nil {
		fmt.Printf("failed to upsert file %s to convex: %v\n", filePath, mutationErr)
		return
	}

	// If this is an output file, check if we need to create relationships
	if isOutput {
		fms.handleOutputFileCreated(filePath)
	}
}

// handleFileDeleted handles when a file is deleted
func (fms *FolderMonitorService) handleFileDeleted(filePath string) {
	args := map[string]interface{}{
		"path": filePath,
	}

	result, mutationErr := fms.convexClient.CallMutation("files:markDeleted", args)
	if mutationErr != nil {
		fmt.Printf("failed to mark file %s as deleted in convex: %v\n", filePath, mutationErr)
		return
	}

	// If a file was found and deleted, check if it triggers re-queuing
	if result != nil {
		fmt.Printf("File %s marked as deleted and relationships updated.\n", filePath)
	}
}

// handleOutputFileCreated attempts to create file relationships for output files
func (fms *FolderMonitorService) handleOutputFileCreated(outputPath string) {
	// Try to determine the input file for this output
	inputPath := fms.findInputFileForOutput(outputPath)
	if inputPath == "" {
		fmt.Printf("Could not determine input file for output: %s\n", outputPath)
		return
	}

	// Get both file records from Convex
	inputFileResult, err := fms.convexClient.CallQuery("files:getByPath", map[string]interface{}{"path": inputPath})
	if err != nil || inputFileResult == nil {
		fmt.Printf("Could not find input file record for: %s\n", inputPath)
		return
	}

	outputFileResult, err := fms.convexClient.CallQuery("files:getByPath", map[string]interface{}{"path": outputPath})
	if err != nil || outputFileResult == nil {
		fmt.Printf("Could not find output file record for: %s\n", outputPath)
		return
	}

	inputFile := inputFileResult.(map[string]interface{})
	outputFile := outputFileResult.(map[string]interface{})

	inputFileId := inputFile["_id"].(string)
	outputFileId := outputFile["_id"].(string)
	inputFileType := inputFile["fileType"].(string)

	// Determine which parser created this output
	parserId := fms.findParserForOutput(inputFileType, outputPath)
	if parserId == "" {
		fmt.Printf("Could not determine parser for output: %s\n", outputPath)
		return
	}

	// Create the relationship
	relationshipArgs := map[string]interface{}{
		"inputFileId":  inputFileId,
		"outputFileId": outputFileId,
		"parserId":     parserId,
		"status":       "completed",
	}

	_, err = fms.convexClient.CallMutation("file_relationships:create", relationshipArgs)
	if err != nil {
		fmt.Printf("Failed to create file relationship: %v\n", err)
	} else {
		fmt.Printf("Created file relationship: %s -> %s\n", inputPath, outputPath)
	}
}

// isOutputFile determines if a filename indicates it's an output file
func (fms *FolderMonitorService) isOutputFile(filename string) bool {
	for _, suffix := range outputSuffixes {
		if strings.Contains(filename, suffix) {
			return true
		}
	}
	return false
}

// findInputFileForOutput attempts to find the input file that generated an output
func (fms *FolderMonitorService) findInputFileForOutput(outputPath string) string {
	outputName := filepath.Base(outputPath)
	outputDir := filepath.Dir(outputPath)

	// Remove output suffixes and extension to find base name
	baseName := outputName
	for _, suffix := range outputSuffixes {
		baseName = strings.Replace(baseName, suffix, "", 1)
	}

	// Remove the .txt extension (most outputs are .txt)
	if strings.HasSuffix(baseName, ".txt") {
		baseName = strings.TrimSuffix(baseName, ".txt")
	}

	// Look for audio files with this base name
	for ext := range fileTypeExtensions {
		if fileTypeExtensions[ext] == "audio" {
			candidatePath := filepath.Join(outputDir, baseName+ext)
			if _, err := os.Stat(candidatePath); err == nil {
				return candidatePath
			}
		}
	}

	return ""
}

// findParserForOutput determines which parser likely created an output file
func (fms *FolderMonitorService) findParserForOutput(inputFileType, outputPath string) string {
	// Get available parsers
	parsersResult, err := fms.convexClient.CallQuery("parsers:listEnabled", map[string]interface{}{})
	if err != nil {
		return ""
	}

	parsers, ok := parsersResult.([]interface{})
	if !ok {
		return ""
	}

	outputName := filepath.Base(outputPath)

	for _, parserInterface := range parsers {
		parser := parserInterface.(map[string]interface{})
		inputTypes := parser["inputFileTypes"].([]interface{})
		outputSuffix := ""
		if suffix, ok := parser["outputSuffix"].(string); ok {
			outputSuffix = suffix
		}

		// Check if this parser can handle the input file type
		canHandle := false
		for _, inputType := range inputTypes {
			if inputType.(string) == inputFileType {
				canHandle = true
				break
			}
		}

		if canHandle && (outputSuffix == "" || strings.Contains(outputName, outputSuffix)) {
			return parser["_id"].(string)
		}
	}

	return ""
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

func calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return hex.EncodeToString(hash.Sum(nil)), nil
}

