# Agent Memory

## Project: File Monitoring & Parsing System

### Overview

TypeScript-based file monitoring system that:

- Watches a dropbox folder for files
- Catalogs files with metadata in SQLite
- Runs configurable parsers on files (transcription, summarization, etc.)
- Manages a job queue with pause/resume controls
- Handles file deletions by re-queuing dependent jobs
- Outputs parser results as new files alongside inputs
- **Provides modern Nuxt 3 web interface for queue control and cost management**
- **Uses hybrid parser system: hardcoded implementations + database configurations**

### Tech Stack

- TypeScript + Node.js (no Python)
- chokidar for file watching
- BullMQ + Redis for job queue
- better-sqlite3 for metadata storage
- Dynamic parser loading system
- FFmpeg for audio processing
- **Nuxt 3 + Vue.js for modern web interface**
- **WebSocket support via Nuxt experimental features**
- **VueUse composables for reactive state management**

### Architecture

- Pluggable parser interface
- Self-healing deletion recovery (CONFIRMED WORKING)
- Multi-stage processing support
- CLI controls for queue management
- Audio chunking for large files before transcription
- **Real-time web interface with cost controls (migrated to Nuxt 3)**
- **Hybrid parser configuration system bridging implementations with database configs**

### Current Transcription Workflow (June 2025)

**Unified transcribe processor handles all audio/video files with OpenAI Whisper:**

- Small files (≤10MB): Direct OpenAI Whisper-1 API transcription
- Large files (>10MB): Internal chunking → transcribe chunks with OpenAI → merge → cleanup temp files
- Always outputs: `audio.mp3` → `audio.mp3.transcript.txt`
- Chunking is internal implementation detail, invisible to user
- Automatic temp file cleanup with proper ES module imports
- Real transcription with timestamps, segments, and duration information
- **Intelligent multi-stream audio handling**: Automatically detects and mixes multiple audio streams from video files (e.g., OBS recordings with webcam, microphone, system audio)

**Key Implementation Details:**

- Uses FFmpeg for audio segmentation (5-minute chunks)
- Creates timestamped temp directories in `tmp/transcribe-{timestamp}/`
- OpenAI Whisper-1 API with verbose_json response format for detailed output
- Uses `toFile` helper from `openai/uploads` for proper audio file handling
- Environment variables loaded with dotenv (.env file)
- Error recovery continues with other chunks if one fails, includes fallback error reporting
- Uses `rmSync()` with recursive cleanup (not deprecated `require()`)

### Database Schema & Field Mapping

**Critical: Database uses snake_case, TypeScript uses camelCase**

- Database client includes proper field mapping in all methods
- `file_id` → `fileId`, `output_path` → `outputPath`, etc.
- All database methods convert field names to match TypeScript interfaces

### Hybrid Parser Configuration System

**Architecture Overview:**

The system now uses a hybrid approach that separates concerns:

- **Parser Implementations** (`src/processors/*.ts`): Contain the actual `run()` functions and logic
- **Parser Configurations** (Database): Control WHEN to run parsers and WHICH implementation to use
- **Bridge System** (`ParserConfigManager`): Connects configurations to implementations

**Parser Implementation Files:**

1. **transcribe**: All audio formats → transcript text (handles both small and large files internally)
2. **summarize**: Transcript → summary using OpenAI GPT-4 Turbo with real-time cost calculation

**Parser Configuration Records:**

- Each config specifies: input extensions, required tags, output format, dependencies
- Links to parser implementation via `parser_implementation` field
- Can have multiple configs using the same implementation with different triggers
- Supports user-selectable execution for manual file processing
- **NEW: allowDerivedFiles flag controls whether parser can process outputs from other parsers**
- **NEW: Delete functionality available in UI for removing parser configurations**

**Example Configuration Scenarios:**

- "auto-summarize-transcripts" → uses `summarize` implementation, triggered by `.txt` + `transcript` tag
- "manual-summarize-selected" → uses `summarize` implementation, only when user selects files
- "meeting-transcripts" → uses `transcribe` implementation, triggered by files with `meeting` tag

**File Processing Flow:**

1. File detected by watcher
2. Auto-tagged based on filename patterns (e.g., `.transcript.` → gets `transcript` tag)
3. System queries database for applicable parser configurations
4. Matches configurations based on file extension AND tags AND derived file permissions
5. Links configurations to parser implementations via `parser_implementation` field
6. Executes matched parsers with proper dependency ordering

**Key Technical Fixes (June 2025):**

- **Fixed compound extension matching**: `getFileExtension` method now properly recognizes `.transcript.txt`, `.summary.txt` etc.
- **Added derived file control**: Parser configurations can now specify whether they accept derived/generated files
- **Enhanced UI**: Parser configuration management includes delete functionality and derived file controls
- **Real AI Summarization**: Updated summarize parser to use OpenAI GPT-4 Turbo with professional prompting
- **Comprehensive Cost Tracking**: Extended job queue to calculate and track costs for both transcription (Whisper) and summarization (GPT-4) operations
- **Enhanced Dashboard**: Cost summary now shows both transcription and summarization job costs with token-level detail

### Modern Nuxt 3 Web Interface

**Three-Page Navigation Structure:**

- **Dashboard** (`/`): Queue status, job management, cost controls
- **Files & Tags** (`/files`): File listing, tagging, metadata management
- **Parser Configuration** (`/parsers`): Parser config creation and management

**Key Features:**

- Real-time queue status monitoring via WebSocket
- Pause/Resume queue controls for cost management
- File tagging and metadata management interface
- Parser configuration creation with implementation selection
- Cost estimation and display for transcription jobs
- Warning alerts when queue is paused with waiting high-cost jobs

**API Endpoints (Nitro):**

- `GET /api/status` - Queue status and pause state
- `GET /api/jobs` - List all jobs with status
- `GET /api/files-with-metadata` - Files with tags and metadata
- `GET /api/parser-configs` - Parser configurations with validation
- `GET /api/available-parsers` - Available parser implementations
- `POST /api/parser-configs` - Create/update parser configurations
- `POST/DELETE /api/files/:id/tags` - Tag management

**Parser Configuration UI:**

- Dropdown selection of available parser implementations (transcribe, summarize)
- Form auto-populates with implementation defaults when selected
- Clear separation between configuration name and implementation choice
- Validation of dependencies and circular dependency detection

### System Status

✅ **Complete and working:**

- File monitoring system with chokidar
- SQLite database with proper field mapping
- BullMQ job queue with Redis
- Unified transcription workflow for all file sizes
- Deletion recovery system
- Modern Nuxt 3 web interface with Vue.js and WebSocket support
- Real OpenAI Whisper-1 API integration with detailed transcription output
- Generic cost calculation system for LLM services
- **Hybrid parser configuration system with database storage**
- **File metadata and tagging system**
- **Parser configuration UI with implementation selection**
- **Bridge between hardcoded parsers and database configurations**

📋 **Current limitations:**

- Parser implementations must be hardcoded in TypeScript files
- Available parsers list is hardcoded in API (Nuxt can't load TS files directly)
- Database schema changes require manual migration for existing databases
- Parser configuration validation is basic

### Enhanced File Organization

**Beyond File Extensions:**

- Files can have multiple tags with optional values (e.g., "priority:high")
- Custom metadata fields with typed values (string, number, boolean, json)
- Tag-based parser selection (parsers can require specific tags)
- Automatic tagging based on filename patterns (e.g., `.transcript.` files get `transcript` tag)

**Configuration Examples:**

- Extension-based: `.mp3` files → transcribe parser
- Tag-based: files with `transcript` tag → summarize parser
- Hybrid: `.txt` files with `meeting` tag → specialized meeting summary parser

### Setup Instructions

1. Install dependencies: `npm install`
2. Create .env file with your OpenAI API key: `OPENAI_API_KEY=your_key_here`
3. Ensure FFmpeg is installed and available in PATH
4. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
5. Run system: `npm run dev`
6. Run web interface: `cd src/nuxt-web && npm run dev`
7. Open browser: `http://localhost:3000`
8. Drop audio files in ./dropbox folder
9. Use web interface to manage queue, files, and parser configurations
