package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create services
	fileService := NewFileService()
	transcriptionService, err := NewTranscriptionService()
	if err != nil {
		log.Fatalf("failed to create transcription service: %v", err)
	}
	costTrackingService := NewCostTrackingService()
	audioService := NewAudioService(transcriptionService, fileService, costTrackingService)

	// Create an instance of the app structure
	app := NewApp(audioService, transcriptionService, fileService, costTrackingService)

	// Create application with options
	err = wails.Run(&options.App{
		Title:  "voice-worker",
		Width:  1024,
		Height: 768,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnDomReady: func(ctx context.Context) {
			audioService.Initialize()
			app.startup(ctx)
		},
		OnShutdown: audioService.Teardown,
		Bind: []interface{}{
			app,
			audioService,
			costTrackingService,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
