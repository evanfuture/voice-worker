package main

import (
	"context"
	"crypto/md5"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type FileWatcherServiceImpl struct {
	convexClient    *ConvexClient
	watcher         *fsnotify.Watcher
	monitoredFolder string
	folderId        string
	isMonitoring    bool
	ctx             context.Context
}

func NewFileWatcherServiceImpl(convexClient *ConvexClient) *FileWatcherServiceImpl {
	return &FileWatcherServiceImpl{
		convexClient: convexClient,
		isMonitoring: false,
	}
}

func (f *FileWatcherServiceImpl) SetMonitoredFolder(folderId, path string) error {
	// Stop current monitoring if active
	if f.isMonitoring {
		f.StopMonitoring()
	}

	f.folderId = folderId
	f.monitoredFolder = path

	// Update folder in Convex
	_, err := f.convexClient.CallMutation("folders:update", map[string]interface{}{
		"id":   folderId,
		"path": path,
	})

	return err
}

func (f *FileWatcherServiceImpl) StartMonitoring() error {
	if f.monitoredFolder == "" {
		return fmt.Errorf("no folder selected for monitoring")
	}

	if f.isMonitoring {
		return fmt.Errorf("monitoring already started")
	}

	// Create filesystem watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create watcher: %v", err)
	}

	f.watcher = watcher
	f.isMonitoring = true

	// Add the folder to watch
	err = f.watcher.Add(f.monitoredFolder)
	if err != nil {
		f.watcher.Close()
		f.isMonitoring = false
		return fmt.Errorf("failed to watch folder: %v", err)
	}

	// Initial scan
	err = f.ScanFolder()
	if err != nil {
		log.Printf("Warning: initial folder scan failed: %v", err)
	}

	// Start watching for events
	go f.watchEvents()

	// Update folder monitoring status in Convex
	_, err = f.convexClient.CallMutation("folders:setMonitoring", map[string]interface{}{
		"id":           f.folderId,
		"isMonitoring": true,
	})

	log.Printf("Started monitoring folder: %s", f.monitoredFolder)
	return err
}

func (f *FileWatcherServiceImpl) StopMonitoring() error {
	if !f.isMonitoring {
		return nil
	}

	f.isMonitoring = false

	if f.watcher != nil {
		f.watcher.Close()
		f.watcher = nil
	}

	// Update folder monitoring status in Convex
	if f.folderId != "" {
		_, err := f.convexClient.CallMutation("folders:setMonitoring", map[string]interface{}{
			"id":           f.folderId,
			"isMonitoring": false,
		})
		if err != nil {
			log.Printf("Warning: failed to update monitoring status: %v", err)
		}
	}

	log.Printf("Stopped monitoring folder: %s", f.monitoredFolder)
	return nil
}

func (f *FileWatcherServiceImpl) IsMonitoring() bool {
	return f.isMonitoring
}

func (f *FileWatcherServiceImpl) ScanFolder() error {
	if f.monitoredFolder == "" {
		return fmt.Errorf("no folder selected")
	}

	log.Printf("Scanning folder: %s", f.monitoredFolder)

	// Get current files from filesystem
	currentFiles := make(map[string]FileInfo)
	err := filepath.Walk(f.monitoredFolder, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		fileInfo, err := f.createFileInfo(path, info)
		if err != nil {
			log.Printf("Warning: failed to process file %s: %v", path, err)
			return nil
		}

		currentFiles[path] = fileInfo
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to scan folder: %v", err)
	}

	// Get existing files from Convex
	result, err := f.convexClient.CallQuery("files:getByFolder", map[string]interface{}{
		"folderId": f.folderId,
	})
	if err != nil {
		return fmt.Errorf("failed to get existing files: %v", err)
	}

	existingFiles := make(map[string]bool)
	if filesData, ok := result.([]interface{}); ok {
		for _, fileData := range filesData {
			if fileMap, ok := fileData.(map[string]interface{}); ok {
				if path, ok := fileMap["path"].(string); ok {
					existingFiles[path] = true
				}
			}
		}
	}

	// Add new files and update existing ones
	for path, fileInfo := range currentFiles {
		if existingFiles[path] {
			// File exists, update it
			err = f.updateFileInConvex(fileInfo)
		} else {
			// New file, add it
			err = f.addFileToConvex(fileInfo)
		}

		if err != nil {
			log.Printf("Warning: failed to sync file %s: %v", path, err)
		}
	}

	// Remove files that no longer exist
	for path := range existingFiles {
		if _, exists := currentFiles[path]; !exists {
			err = f.removeFileFromConvex(path)
			if err != nil {
				log.Printf("Warning: failed to remove file %s: %v", path, err)
			}
		}
	}

	log.Printf("Folder scan completed. Found %d files", len(currentFiles))
	return nil
}

func (f *FileWatcherServiceImpl) GetSelectedFolder() string {
	return f.monitoredFolder
}

func (f *FileWatcherServiceImpl) SetContext(ctx context.Context) {
	f.ctx = ctx
}

func (f *FileWatcherServiceImpl) SelectFolder() (string, error) {
	if f.ctx == nil {
		return "", fmt.Errorf("context not set")
	}

	folderPath, err := runtime.OpenDirectoryDialog(f.ctx, runtime.OpenDialogOptions{
		Title: "Select folder to monitor",
	})

	return folderPath, err
}

// Private methods

func (f *FileWatcherServiceImpl) watchEvents() {
	for f.isMonitoring {
		select {
		case event, ok := <-f.watcher.Events:
			if !ok {
				return
			}
			f.handleFileEvent(event)

		case err, ok := <-f.watcher.Errors:
			if !ok {
				return
			}
			log.Printf("Watcher error: %v", err)
		}
	}
}

func (f *FileWatcherServiceImpl) handleFileEvent(event fsnotify.Event) {
	path := event.Name

	switch {
	case event.Op&fsnotify.Create == fsnotify.Create:
		f.handleFileAdded(path)
	case event.Op&fsnotify.Remove == fsnotify.Remove:
		f.handleFileRemoved(path)
	case event.Op&fsnotify.Write == fsnotify.Write:
		f.handleFileModified(path)
	}
}

func (f *FileWatcherServiceImpl) handleFileAdded(path string) {
	info, err := os.Stat(path)
	if err != nil {
		log.Printf("Warning: cannot stat added file %s: %v", path, err)
		return
	}

	if info.IsDir() {
		return
	}

	fileInfo, err := f.createFileInfo(path, info)
	if err != nil {
		log.Printf("Warning: failed to process added file %s: %v", path, err)
		return
	}

	err = f.addFileToConvex(fileInfo)
	if err != nil {
		log.Printf("Warning: failed to add file to database %s: %v", path, err)
	}

	log.Printf("File added: %s", path)
}

func (f *FileWatcherServiceImpl) handleFileRemoved(path string) {
	err := f.removeFileFromConvex(path)
	if err != nil {
		log.Printf("Warning: failed to remove file from database %s: %v", path, err)
	}

	log.Printf("File removed: %s", path)
}

func (f *FileWatcherServiceImpl) handleFileModified(path string) {
	info, err := os.Stat(path)
	if err != nil {
		log.Printf("Warning: cannot stat modified file %s: %v", path, err)
		return
	}

	if info.IsDir() {
		return
	}

	fileInfo, err := f.createFileInfo(path, info)
	if err != nil {
		log.Printf("Warning: failed to process modified file %s: %v", path, err)
		return
	}

	err = f.updateFileInConvex(fileInfo)
	if err != nil {
		log.Printf("Warning: failed to update file in database %s: %v", path, err)
	}

	log.Printf("File modified: %s", path)
}

func (f *FileWatcherServiceImpl) createFileInfo(path string, info os.FileInfo) (FileInfo, error) {
	// Determine file type
	fileType := f.determineFileType(path)

	// Check if this is an output file
	isOutput := f.isOutputFile(path)

	// Format file size
	sizeStr := fmt.Sprintf("%.2f MB", float64(info.Size())/(1024*1024))

	return FileInfo{
		Path:      path,
		Name:      info.Name(),
		FileType:  fileType,
		Extension: filepath.Ext(path),
		Status:    "unprocessed",
		IsOutput:  isOutput,
		Size:      sizeStr,
		SizeBytes: info.Size(),
	}, nil
}

func (f *FileWatcherServiceImpl) determineFileType(path string) string {
	ext := strings.ToLower(filepath.Ext(path))

	audioExts := map[string]bool{
		".mp3": true, ".wav": true, ".m4a": true, ".aac": true,
		".flac": true, ".ogg": true, ".wma": true,
	}

	if audioExts[ext] {
		return "audio"
	}

	if ext == ".txt" {
		return "text"
	}

	return "other"
}

func (f *FileWatcherServiceImpl) calculateFileHash(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hasher := md5.New()
	_, err = io.Copy(hasher, file)
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", hasher.Sum(nil)), nil
}

func (f *FileWatcherServiceImpl) isOutputFile(path string) bool {
	name := filepath.Base(path)

	// Check for common output patterns
	if strings.Contains(name, "_summary") && strings.HasSuffix(name, ".txt") {
		return true
	}

	// Transcript files are outputs if there's a corresponding audio file
	if strings.HasSuffix(name, ".txt") {
		baseName := strings.TrimSuffix(name, ".txt")
		dir := filepath.Dir(path)

		// Check for corresponding audio files
		audioExts := []string{".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".wma"}
		for _, ext := range audioExts {
			audioPath := filepath.Join(dir, baseName+ext)
			if _, err := os.Stat(audioPath); err == nil {
				return true
			}
		}
	}

	return false
}

func (f *FileWatcherServiceImpl) addFileToConvex(fileInfo FileInfo) error {
	// Calculate hash for the file
	hash, err := f.calculateFileHash(fileInfo.Path)
	if err != nil {
		log.Printf("Warning: failed to calculate hash for %s: %v", fileInfo.Path, err)
		hash = ""
	}

	_, err = f.convexClient.CallMutation("files:create", map[string]interface{}{
		"path":      fileInfo.Path,
		"name":      fileInfo.Name,
		"folderId":  f.folderId,
		"sizeBytes": fileInfo.SizeBytes,
		"fileType":  fileInfo.FileType,
		"extension": fileInfo.Extension,
		"status":    fileInfo.Status,
		"hash":      hash,
		"isOutput":  fileInfo.IsOutput,
		"metadata":  map[string]interface{}{},
	})
	return err
}

func (f *FileWatcherServiceImpl) updateFileInConvex(fileInfo FileInfo) error {
	// Calculate hash for the file
	hash, err := f.calculateFileHash(fileInfo.Path)
	if err != nil {
		log.Printf("Warning: failed to calculate hash for %s: %v", fileInfo.Path, err)
		hash = ""
	}

	_, err = f.convexClient.CallMutation("files:updateByPath", map[string]interface{}{
		"path":      fileInfo.Path,
		"sizeBytes": fileInfo.SizeBytes,
		"hash":      hash,
		"status":    fileInfo.Status,
		"metadata":  map[string]interface{}{},
	})
	return err
}

func (f *FileWatcherServiceImpl) removeFileFromConvex(path string) error {
	_, err := f.convexClient.CallMutation("files:deleteByPath", map[string]interface{}{
		"path": path,
	})
	return err
}
