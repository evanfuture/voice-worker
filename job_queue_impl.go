package main

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type JobQueueServiceImpl struct {
	convexClient    *ConvexClient
	parserManager   ParserManagerService
	isProcessing    bool
	stopChannel     chan bool
	jobsInProgress  map[string]bool
	mutex           sync.RWMutex
	ctx             context.Context
}

func NewJobQueueServiceImpl(convexClient *ConvexClient, parserManager ParserManagerService) *JobQueueServiceImpl {
	return &JobQueueServiceImpl{
		convexClient:   convexClient,
		parserManager:  parserManager,
		isProcessing:   false,
		stopChannel:    make(chan bool, 1),
		jobsInProgress: make(map[string]bool),
	}
}

func (j *JobQueueServiceImpl) StartProcessing() {
	j.mutex.Lock()
	defer j.mutex.Unlock()

	if j.isProcessing {
		return
	}

	j.isProcessing = true
	j.ctx = context.Background()

	go j.processJobQueue()
	log.Println("Job queue processing started")
}

func (j *JobQueueServiceImpl) StopProcessing() {
	j.mutex.Lock()
	defer j.mutex.Unlock()

	if !j.isProcessing {
		return
	}

	j.isProcessing = false
	select {
	case j.stopChannel <- true:
	default:
	}

	log.Println("Job queue processing stopped")
}

func (j *JobQueueServiceImpl) QueueJob(job JobRequest) error {
	// Create job in Convex
	_, err := j.convexClient.CallMutation("jobs:create", map[string]interface{}{
		"fileId":   job.FileID,
		"parserId": job.ParserID,
		"jobType":  job.JobType,
		"status":   "pending",
		"priority": job.Priority,
		"metadata": job.Metadata,
	})

	return err
}

func (j *JobQueueServiceImpl) GetQueueStatus() QueueStatus {
	result, err := j.convexClient.CallQuery("jobs:getQueueStats", map[string]interface{}{})
	if err != nil {
		log.Printf("Warning: failed to get queue stats: %v", err)
		return QueueStatus{}
	}

	status := QueueStatus{}
	if statsMap, ok := result.(map[string]interface{}); ok {
		if total, ok := statsMap["total"].(float64); ok {
			status.TotalJobs = int(total)
		}
		if pending, ok := statsMap["pending"].(float64); ok {
			status.PendingJobs = int(pending)
		}
		if processing, ok := statsMap["processing"].(float64); ok {
			status.ProcessingJobs = int(processing)
		}
		if completed, ok := statsMap["completed"].(float64); ok {
			status.CompletedJobs = int(completed)
		}
		if failed, ok := statsMap["failed"].(float64); ok {
			status.FailedJobs = int(failed)
		}
		if paused, ok := statsMap["paused"].(float64); ok {
			status.PausedJobs = int(paused)
		}
	}

	return status
}

func (j *JobQueueServiceImpl) PauseJob(jobId string) error {
	_, err := j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "paused",
	})
	return err
}

func (j *JobQueueServiceImpl) ResumeJob(jobId string) error {
	_, err := j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "pending",
	})
	return err
}

func (j *JobQueueServiceImpl) CancelJob(jobId string) error {
	_, err := j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "cancelled",
	})
	return err
}

func (j *JobQueueServiceImpl) RetryJob(jobId string) error {
	_, err := j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":     jobId,
		"status": "pending",
	})
	return err
}

// Private methods

func (j *JobQueueServiceImpl) processJobQueue() {
	ticker := time.NewTicker(5 * time.Second) // Check for jobs every 5 seconds
	defer ticker.Stop()

	for j.isProcessing {
		select {
		case <-j.stopChannel:
			return
		case <-ticker.C:
			j.processNextJob()
		}
	}
}

func (j *JobQueueServiceImpl) processNextJob() {
	// Get next pending job
	result, err := j.convexClient.CallQuery("jobs:getNextPending", map[string]interface{}{})
	if err != nil {
		log.Printf("Warning: failed to get next job: %v", err)
		return
	}

	// No jobs available
	if result == nil {
		return
	}

	jobMap, ok := result.(map[string]interface{})
	if !ok {
		log.Printf("Warning: invalid job data received")
		return
	}

	jobId, ok := jobMap["_id"].(string)
	if !ok {
		log.Printf("Warning: job missing ID")
		return
	}

	// Check if job is already being processed
	j.mutex.RLock()
	inProgress := j.jobsInProgress[jobId]
	j.mutex.RUnlock()

	if inProgress {
		return
	}

	// Mark job as in progress
	j.mutex.Lock()
	j.jobsInProgress[jobId] = true
	j.mutex.Unlock()

	// Process job in goroutine
	go j.processJob(jobMap)
}

func (j *JobQueueServiceImpl) processJob(jobData map[string]interface{}) {
	jobId := jobData["_id"].(string)

	// Remove from in-progress when done
	defer func() {
		j.mutex.Lock()
		delete(j.jobsInProgress, jobId)
		j.mutex.Unlock()
	}()

	// Update job status to processing
	_, err := j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
		"id":        jobId,
		"status":    "processing",
		"startedAt": time.Now().Unix() * 1000,
	})
	if err != nil {
		log.Printf("Error updating job status: %v", err)
		return
	}

	// Get job details
	fileId, _ := jobData["fileId"].(string)
	parserId, _ := jobData["parserId"].(string)
	jobType, _ := jobData["jobType"].(string)

	log.Printf("Processing job %s: %s parser for file %s", jobId, parserId, fileId)

	var jobErr error
	switch jobType {
	case "parse":
		jobErr = j.processParseJob(jobId, fileId, parserId)
	case "requeue":
		jobErr = j.processRequeueJob(jobId, fileId, parserId)
	default:
		jobErr = fmt.Errorf("unknown job type: %s", jobType)
	}

	// Update job completion status
	if jobErr != nil {
		log.Printf("Job %s failed: %v", jobId, jobErr)
		_, err = j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
			"id":           jobId,
			"status":       "failed",
			"completedAt":  time.Now().Unix() * 1000,
			"errorMessage": jobErr.Error(),
		})
	} else {
		log.Printf("Job %s completed successfully", jobId)
		_, err = j.convexClient.CallMutation("jobs:updateStatus", map[string]interface{}{
			"id":          jobId,
			"status":      "completed",
			"completedAt": time.Now().Unix() * 1000,
		})
	}

	if err != nil {
		log.Printf("Error updating job completion status: %v", err)
	}
}

func (j *JobQueueServiceImpl) processParseJob(jobId, fileId, parserId string) error {
	// Get file information
	fileResult, err := j.convexClient.CallQuery("files:getById", map[string]interface{}{
		"id": fileId,
	})
	if err != nil {
		return fmt.Errorf("failed to get file info: %v", err)
	}

	fileMap, ok := fileResult.(map[string]interface{})
	if !ok {
		return fmt.Errorf("invalid file data")
	}

	filePath, _ := fileMap["path"].(string)
	fileType, _ := fileMap["fileType"].(string)

	// Get parser
	parser, err := j.parserManager.GetParser(parserId)
	if err != nil {
		return fmt.Errorf("failed to get parser: %v", err)
	}

	// Check if parser can process this file
	if !parser.CanProcess(filePath, fileType) {
		return fmt.Errorf("parser %s cannot process file type %s", parserId, fileType)
	}

	// Generate output file path
	outputPath := j.generateOutputPath(filePath, parser)

	// Process the file
	ctx, cancel := context.WithTimeout(j.ctx, 30*time.Minute)
	defer cancel()

	err = parser.Process(ctx, filePath, outputPath)
	if err != nil {
		return fmt.Errorf("parser processing failed: %v", err)
	}

	// Update job metadata with output path
	_, err = j.convexClient.CallMutation("jobs:updateMetadata", map[string]interface{}{
		"id": jobId,
		"metadata": map[string]interface{}{
			"outputPath": outputPath,
		},
	})
	if err != nil {
		log.Printf("Warning: failed to update job metadata: %v", err)
	}

	return nil
}

func (j *JobQueueServiceImpl) processRequeueJob(jobId, fileId, parserId string) error {
	// For requeue jobs, we simply create a new parse job
	// This handles cases where output files were deleted

	return j.processParseJob(jobId, fileId, parserId)
}

func (j *JobQueueServiceImpl) generateOutputPath(inputPath string, parser Parser) string {
	dir := filepath.Dir(inputPath)
	baseName := strings.TrimSuffix(filepath.Base(inputPath), filepath.Ext(inputPath))

	suffix := parser.GetOutputSuffix()
	extension := parser.GetOutputExtension()

	outputName := baseName + suffix + extension
	return filepath.Join(dir, outputName)
}
