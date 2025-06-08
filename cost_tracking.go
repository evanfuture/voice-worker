package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"time"
)

const (
	// OpenAI Whisper API pricing: $0.006 per minute (rounded to nearest second)
	WHISPER_COST_PER_MINUTE = 0.006
	WHISPER_COST_PER_SECOND = WHISPER_COST_PER_MINUTE / 60.0
	COST_DATA_FILE = "cost_data.json"
)

// CostEntry represents a single transcription cost entry
type CostEntry struct {
	Timestamp    time.Time `json:"timestamp"`
	DurationSec  float64   `json:"duration_seconds"`
	Cost         float64   `json:"cost"`
	TranscriptID string    `json:"transcript_id"`
}

// DailyCost represents aggregated costs for a specific day
type DailyCost struct {
	Date           string  `json:"date"`
	TotalCost      float64 `json:"total_cost"`
	TotalDuration  float64 `json:"total_duration_seconds"`
	TranscriptCount int    `json:"transcript_count"`
}

// CostData holds all cost tracking information
type CostData struct {
	Entries       []CostEntry          `json:"entries"`
	DailyTotals   map[string]DailyCost `json:"daily_totals"`
	SessionStart  time.Time            `json:"session_start"`
	SessionCost   float64              `json:"session_cost"`
	TotalCost     float64              `json:"total_cost"`
	TotalDuration float64              `json:"total_duration_seconds"`
	LastUpdated   time.Time            `json:"last_updated"`
}

// CostTrackingService manages transcription cost tracking
type CostTrackingService struct {
	data     CostData
	dataFile string
}

// NewCostTrackingService creates a new cost tracking service
func NewCostTrackingService() *CostTrackingService {
	service := &CostTrackingService{
		dataFile: COST_DATA_FILE,
		data: CostData{
			Entries:      make([]CostEntry, 0),
			DailyTotals:  make(map[string]DailyCost),
			SessionStart: time.Now(),
			SessionCost:  0.0,
			TotalCost:    0.0,
			TotalDuration: 0.0,
			LastUpdated:  time.Now(),
		},
	}

	// Load existing data if file exists
	service.loadData()

	// Reset session data for new session
	service.data.SessionStart = time.Now()
	service.data.SessionCost = 0.0

	return service
}

// CalculateCost calculates the cost for a given duration in seconds
func (s *CostTrackingService) CalculateCost(durationSeconds float64) float64 {
	// OpenAI rounds to nearest second, so we round up any fraction
	roundedSeconds := math.Ceil(durationSeconds)
	return roundedSeconds * WHISPER_COST_PER_SECOND
}

// RecordTranscription records a new transcription cost
func (s *CostTrackingService) RecordTranscription(durationSeconds float64, transcriptID string) float64 {
	cost := s.CalculateCost(durationSeconds)

	entry := CostEntry{
		Timestamp:    time.Now(),
		DurationSec:  durationSeconds,
		Cost:         cost,
		TranscriptID: transcriptID,
	}

	// Add to entries
	s.data.Entries = append(s.data.Entries, entry)

	// Update totals
	s.data.SessionCost += cost
	s.data.TotalCost += cost
	s.data.TotalDuration += durationSeconds
	s.data.LastUpdated = time.Now()

	// Update daily totals
	s.updateDailyTotals(entry)

	// Save to file
	s.saveData()

	fmt.Printf("Transcription cost recorded: $%.4f (%.2f seconds)\n", cost, durationSeconds)
	return cost
}

// updateDailyTotals updates the daily cost aggregation
func (s *CostTrackingService) updateDailyTotals(entry CostEntry) {
	dateKey := entry.Timestamp.Format("2006-01-02")

	daily, exists := s.data.DailyTotals[dateKey]
	if !exists {
		daily = DailyCost{
			Date:           dateKey,
			TotalCost:      0.0,
			TotalDuration:  0.0,
			TranscriptCount: 0,
		}
	}

	daily.TotalCost += entry.Cost
	daily.TotalDuration += entry.DurationSec
	daily.TranscriptCount++

	s.data.DailyTotals[dateKey] = daily
}

// GetSessionCost returns the current session cost
func (s *CostTrackingService) GetSessionCost() float64 {
	return s.data.SessionCost
}

// GetTotalCost returns the total accumulated cost
func (s *CostTrackingService) GetTotalCost() float64 {
	return s.data.TotalCost
}

// GetCostSummary returns a summary of costs
func (s *CostTrackingService) GetCostSummary() map[string]interface{} {
	today := time.Now().Format("2006-01-02")
	todayCost := 0.0

	if daily, exists := s.data.DailyTotals[today]; exists {
		todayCost = daily.TotalCost
	}

	return map[string]interface{}{
		"session_cost":        s.data.SessionCost,
		"session_start":       s.data.SessionStart.Format("15:04:05"),
		"today_cost":          todayCost,
		"total_cost":          s.data.TotalCost,
		"total_duration_min":  s.data.TotalDuration / 60.0,
		"total_transcripts":   len(s.data.Entries),
		"cost_per_minute":     WHISPER_COST_PER_MINUTE,
		"last_updated":        s.data.LastUpdated.Format("15:04:05"),
	}
}

// GetDailyCosts returns daily cost breakdown for the last N days
func (s *CostTrackingService) GetDailyCosts(days int) []DailyCost {
	var costs []DailyCost

	// Get the last N days
	for i := days - 1; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		if daily, exists := s.data.DailyTotals[date]; exists {
			costs = append(costs, daily)
		} else {
			// Add empty day
			costs = append(costs, DailyCost{
				Date:           date,
				TotalCost:      0.0,
				TotalDuration:  0.0,
				TranscriptCount: 0,
			})
		}
	}

	return costs
}

// EstimateCost estimates cost for a given duration without recording it
func (s *CostTrackingService) EstimateCost(durationSeconds float64) float64 {
	return s.CalculateCost(durationSeconds)
}

// loadData loads cost data from the JSON file
func (s *CostTrackingService) loadData() error {
	if _, err := os.Stat(s.dataFile); os.IsNotExist(err) {
		// File doesn't exist, use defaults
		return nil
	}

	data, err := os.ReadFile(s.dataFile)
	if err != nil {
		fmt.Printf("Error reading cost data file: %v\n", err)
		return err
	}

	err = json.Unmarshal(data, &s.data)
	if err != nil {
		fmt.Printf("Error parsing cost data file: %v\n", err)
		return err
	}

	fmt.Printf("Loaded cost data: Total cost $%.4f, %d entries\n", s.data.TotalCost, len(s.data.Entries))
	return nil
}

// saveData saves cost data to the JSON file
func (s *CostTrackingService) saveData() error {
	// Ensure directory exists
	dir := filepath.Dir(s.dataFile)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory: %w", err)
		}
	}

	data, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal cost data: %w", err)
	}

	err = os.WriteFile(s.dataFile, data, 0644)
	if err != nil {
		return fmt.Errorf("failed to write cost data file: %w", err)
	}

	return nil
}

// ResetSessionCost resets the session cost counter
func (s *CostTrackingService) ResetSessionCost() {
	s.data.SessionStart = time.Now()
	s.data.SessionCost = 0.0
	s.saveData()
}
