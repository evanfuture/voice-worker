package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
)

// ConvexClient is a client for the Convex API.
type ConvexClient struct {
	deploymentURL string
	adminKey      string
	client        *http.Client
}

// NewConvexClient creates a new Convex client.
func NewConvexClient() (*ConvexClient, error) {
	deploymentURL := os.Getenv("CONVEX_URL")
	if deploymentURL == "" {
		// Fallback for development if not set in env
		deploymentURL = "https://dazzling-stingray-564.convex.cloud"
	}

	adminKey := os.Getenv("CONVEX_ADMIN_KEY")
	if adminKey == "" {
		// This should be set in production environments.
		// For local dev, you might get it from the Convex dashboard.
		fmt.Println("WARNING: CONVEX_ADMIN_KEY environment variable not set.")
	}

	return &ConvexClient{
		deploymentURL: deploymentURL,
		adminKey:      adminKey,
		client:        &http.Client{},
	}, nil
}

// CallMutation calls a mutation on the Convex API.
func (c *ConvexClient) CallMutation(functionName string, args map[string]interface{}) (interface{}, error) {
	url := fmt.Sprintf("%s/api/mutation", c.deploymentURL)

	payload := map[string]interface{}{
		"path":   functionName,
		"args":   args,
		"format": "json",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.adminKey != "" {
		req.Header.Set("Authorization", "Convex "+c.adminKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON response: %w", err)
	}

	if errorMsg, ok := result["error"]; ok {
		return nil, fmt.Errorf("convex mutation failed: %v", errorMsg)
	}

	return result["value"], nil
}

// CallQuery calls a query on the Convex API.
func (c *ConvexClient) CallQuery(functionName string, args map[string]interface{}) (interface{}, error) {
	url := fmt.Sprintf("%s/api/query", c.deploymentURL)

	payload := map[string]interface{}{
		"path":   functionName,
		"args":   args,
		"format": "json",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal JSON payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.adminKey != "" {
		req.Header.Set("Authorization", "Convex "+c.adminKey)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON response: %w", err)
	}

	if errorMsg, ok := result["error"]; ok {
		return nil, fmt.Errorf("convex query failed: %v", errorMsg)
	}

	return result["value"], nil
}
