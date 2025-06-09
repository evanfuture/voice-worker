# Project: Voice Worker - File Processing Pipeline (Clean Rebuild)

## System Description

This is a macOS desktop application built with Wails.io (Go backend, Vue.js frontend) that provides a **file dropbox processing system**. Users select a folder to monitor, and the system catalogs files and processes them through configurable parsers with clear state management.

## Clean Architecture Implemented

The system has been rebuilt from the ground up with a clean, modular architecture that separates concerns and provides clear service boundaries.

### Core Service Architecture

**Main Services:**

- **`VoiceWorkerService`**: Main coordinator that orchestrates all services
- **`FileWatcherService`**: Monitors dropbox folder and syncs file state to Convex
- **`ParserManagerService`**: Manages parsers and their configurations
- **`JobQueueService`**: Processes parsing jobs in the background

**Parser Interface:**

- **`Parser`**: Clean interface for pluggable parser implementations
- **`TranscriptionParserImpl`**: OpenAI Whisper API integration for audio → text
- **`SummaryParserImpl`**: OpenAI GPT API for text → summary

### File Processing Pipeline

**Dropbox Concept:**

- Single monitored folder acts as processing workspace
- All files (inputs + outputs) tracked with metadata and processing state
- Configurable parsers process input files → output files in same folder
- Output deletion triggers re-queuing of input files
- Clear visibility into processing pipeline state

**Processing Flow:**

1. User selects dropbox folder
2. `FileWatcherService` scans and catalogs all files
3. `ParserManagerService` determines applicable parsers for each file type
4. `JobQueueService` processes jobs with parser routing and status updates
5. Output files created alongside inputs in same folder
6. Continuous monitoring for new files and deleted outputs

### Backend Services Implementation

**FileWatcherServiceImpl:**

- Uses `fsnotify` for real-time filesystem monitoring
- Calculates file hashes for change detection
- Determines file types (audio, text, other) and output status
- Syncs all file state changes to Convex database
- Handles file additions, modifications, and deletions

**ParserManagerServiceImpl:**

- Manages registry of available parsers
- Handles parser enable/disable states
- Configures parser-specific settings (API keys, models)
- Returns applicable parsers for specific file types

**JobQueueServiceImpl:**

- Background processing with configurable polling interval
- Thread-safe job processing with goroutines
- Handles job states: pending → processing → completed/failed
- Individual job controls (pause, resume, cancel, retry)
- Generates output file paths based on parser configuration

**Parser Implementations:**

- **TranscriptionParser**: OpenAI Whisper API for audio transcription
- **SummaryParser**: OpenAI GPT API for text summarization
- Both include cost estimation and configuration management

### Frontend Interface (CleanApp)

**Organized Method Groups:**

- **Folder Management**: Select, monitor, scan dropbox folder
- **Parser Management**: Enable/disable parsers, configure settings
- **Job Queue Management**: View queue status, control individual jobs
- **File Management**: Process files, view processing state
- **Cost Tracking**: Estimate and track processing costs

### Database Schema (Convex)

The existing Convex schema remains excellent and supports the clean architecture:

- **`folders`**: Dropbox folder configuration and monitoring status
- **`files`**: All files with metadata, processing state, relationship tracking
- **`parsers`**: Parser definitions, configurations, file type associations
- **`jobs`**: Processing queue with dependencies, priorities, status
- **`file_relationships`**: Input → output file mappings
- **`cost_tracking`**: Processing costs across all parser types
- **`events`**: System events log for debugging and traceability

### Clean Architecture Benefits

**Separation of Concerns:**

- Each service has a single, well-defined responsibility
- Interfaces enable easy testing and future extensibility
- Clear data flow between services

**Modular Design:**

- New parsers can be added by implementing the `Parser` interface
- Services can be independently tested and modified
- Clean dependency injection through service initialization

**Robust Error Handling:**

- Graceful degradation when services fail
- Comprehensive logging and error reporting
- State recovery mechanisms for interrupted processing

### Key Features

**File State Management:**

- `unprocessed`: New file, no applicable parsers run
- `processing`: Currently being processed by a parser
- `completed`: All applicable parsers completed successfully
- `failed`: Parser failed, needs attention
- `partial`: Some parsers completed, others pending/failed

**Output Dependency Tracking:**

- If transcript file deleted → audio file re-queued for transcription
- If summary file deleted → transcript file re-queued for summarization
- Automatic cascade re-processing when upstream outputs are missing

**Queue Management:**

- Real-time queue statistics and job monitoring
- Priority-based job processing
- Individual job controls (pause/resume/cancel/retry)
- Background processing with proper concurrency handling

**Parser Configuration:**

- API key management for external services
- Model selection and processing parameters
- Cost estimation before processing
- Enable/disable parsers as needed

## Technical Implementation

### Working Stack

- **Wails 2.x** (Go backend + Vue frontend)
- **Convex Cloud** (database + real-time subscriptions)
- **Vue 3** (reactive UI layer)
- **`fsnotify`** (filesystem monitoring)
- **OpenAI APIs** (Whisper for transcription, GPT for summarization)

### Clean Service Structure

```
CleanApp
├── VoiceWorkerService (coordinator)
│   ├── FileWatcherService (filesystem monitoring)
│   ├── ParserManagerService (parser registry)
│   └── JobQueueService (background processing)
└── ConvexClient (database operations)
```

### Processing Pipeline

```
Audio File → TranscriptionParser → .txt file → SummaryParser → _summary.txt file
```

## Design Goals Achieved

- **Clean Architecture**: Well-separated services with clear interfaces
- **Clear State**: Always know what files are processed/pending
- **Reliable Pipeline**: Parsers run consistently with proper error handling
- **Output Tracking**: Deletion of outputs properly triggers re-processing
- **Queue Control**: Can pause/resume/manage processing flow
- **Extensible**: Easy to add new parser types beyond transcription/summary
- **Real-time Feedback**: Live updates of file and job status
- **Cost Transparency**: Track processing costs across all operations

The rebuild provides a solid foundation for the file processing pipeline with excellent separation of concerns and clear service boundaries.
