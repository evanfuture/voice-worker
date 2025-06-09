package main

import (
	"fmt"
	"log"
)

type ParserManagerServiceImpl struct {
	convexClient *ConvexClient
	parsers      map[string]Parser
}

func NewParserManagerServiceImpl(convexClient *ConvexClient) *ParserManagerServiceImpl {
	pm := &ParserManagerServiceImpl{
		convexClient: convexClient,
		parsers:      make(map[string]Parser),
	}

	// Initialize built-in parsers
	pm.initializeBuiltInParsers()

	return pm
}

func (p *ParserManagerServiceImpl) initializeBuiltInParsers() {
	// Create transcription parser
	transcriptionParser := &TranscriptionParserImpl{
		id:              "transcription",
		name:            "Audio Transcription",
		inputTypes:      []string{"audio"},
		outputExtension: ".txt",
		outputSuffix:    "",
	}

	// Create summary parser
	summaryParser := &SummaryParserImpl{
		id:              "summary",
		name:            "Text Summarization",
		inputTypes:      []string{"text"},
		outputExtension: ".txt",
		outputSuffix:    "_summary",
	}

	p.parsers["transcription"] = transcriptionParser
	p.parsers["summary"] = summaryParser

	// Ensure parsers exist in Convex
	p.ensureParsersInConvex()
}

func (p *ParserManagerServiceImpl) ensureParsersInConvex() {
	for _, parser := range p.parsers {
		_, err := p.convexClient.CallMutation("parsers:createOrUpdate", map[string]interface{}{
			"name":             parser.GetID(),
			"displayName":      parser.GetName(),
			"inputFileTypes":   parser.GetInputTypes(),
			"outputExtension":  parser.GetOutputExtension(),
			"outputSuffix":     parser.GetOutputSuffix(),
			"isEnabled":        true,
			"configuration":    parser.GetConfiguration(),
		})
		if err != nil {
			log.Printf("Warning: failed to create/update parser %s: %v", parser.GetID(), err)
		}
	}
}

func (p *ParserManagerServiceImpl) GetAvailableParsers() ([]Parser, error) {
	var parsers []Parser
	for _, parser := range p.parsers {
		parsers = append(parsers, parser)
	}
	return parsers, nil
}

func (p *ParserManagerServiceImpl) GetEnabledParsers() ([]Parser, error) {
	// Get enabled parsers from Convex
	result, err := p.convexClient.CallQuery("parsers:getEnabled", map[string]interface{}{})
	if err != nil {
		return nil, fmt.Errorf("failed to get enabled parsers: %v", err)
	}

	var enabledParsers []Parser

	if parsersData, ok := result.([]interface{}); ok {
		for _, parserData := range parsersData {
			if parserMap, ok := parserData.(map[string]interface{}); ok {
				if name, ok := parserMap["name"].(string); ok {
					if parser, exists := p.parsers[name]; exists {
						enabledParsers = append(enabledParsers, parser)
					}
				}
			}
		}
	}

	return enabledParsers, nil
}

func (p *ParserManagerServiceImpl) EnableParser(parserId string) error {
	if _, exists := p.parsers[parserId]; !exists {
		return fmt.Errorf("parser %s not found", parserId)
	}

	_, err := p.convexClient.CallMutation("parsers:setEnabled", map[string]interface{}{
		"name":      parserId,
		"isEnabled": true,
	})

	return err
}

func (p *ParserManagerServiceImpl) DisableParser(parserId string) error {
	if _, exists := p.parsers[parserId]; !exists {
		return fmt.Errorf("parser %s not found", parserId)
	}

	_, err := p.convexClient.CallMutation("parsers:setEnabled", map[string]interface{}{
		"name":      parserId,
		"isEnabled": false,
	})

	return err
}

func (p *ParserManagerServiceImpl) ConfigureParser(parserId string, config map[string]interface{}) error {
	parser, exists := p.parsers[parserId]
	if !exists {
		return fmt.Errorf("parser %s not found", parserId)
	}

	// Update parser configuration
	err := parser.SetConfiguration(config)
	if err != nil {
		return fmt.Errorf("failed to set parser configuration: %v", err)
	}

	// Update configuration in Convex
	_, err = p.convexClient.CallMutation("parsers:updateConfiguration", map[string]interface{}{
		"name":          parserId,
		"configuration": config,
	})

	return err
}

func (p *ParserManagerServiceImpl) GetApplicableParsers(fileType string) ([]Parser, error) {
	enabledParsers, err := p.GetEnabledParsers()
	if err != nil {
		return nil, err
	}

	var applicableParsers []Parser
	for _, parser := range enabledParsers {
		for _, inputType := range parser.GetInputTypes() {
			if inputType == fileType {
				applicableParsers = append(applicableParsers, parser)
				break
			}
		}
	}

	return applicableParsers, nil
}

func (p *ParserManagerServiceImpl) GetParser(parserId string) (Parser, error) {
	parser, exists := p.parsers[parserId]
	if !exists {
		return nil, fmt.Errorf("parser %s not found", parserId)
	}
	return parser, nil
}
