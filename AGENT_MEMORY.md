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
- **Includes comprehensive design system with Figma synchronization capabilities**

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
- **Style Dictionary for design token management and Figma sync**

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
3. **convert-video**: Video formats → MP3 audio conversion using FFmpeg
4. **comprehend-video**: Video formats → shot boundary detection using OpenAI Vision API

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

- Dropdown selection of available parser implementations (transcribe, summarize, convert-video, comprehend-video)
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
- **Complete design system integration with Figma synchronization**
- **Codebase consolidation: 5 of 6 priority tasks completed**

📋 **Current limitations:**

- Parser implementations must be hardcoded in TypeScript files
- Available parsers list is hardcoded in API (Nuxt can't load TS files directly)
- Database schema changes require manual migration for existing databases
- Parser configuration validation is basic

### ✅ Recent Fixes (June 2025)

**Fixed Parser Loading Error:**

- Moved `ParserConfigManager` from `core/processors/` to `core/lib/` directory
- Issue: ParserLoader was incorrectly trying to load config-manager.ts as a parser
- Root cause: config-manager.ts was in processors directory but exports a utility class, not a parser
- Solution: Relocated to appropriate lib directory and updated all import paths
- Result: Parser loading now works cleanly with 4 parsers (convert-video, summarize, transcribe, comprehend-video)

### Enhanced File Organization

**Beyond File Extensions:**

- Files can have multiple tags with optional values (e.g., "priority:high")
- Custom metadata fields with typed values (string, number, boolean, json)
- Tag-based parser selection (parsers can require specific tags)
- Automatic tagging based on filename patterns (e.g., `.transcript.` files get `transcript` tag)

**Tag-Based Gating for Video Files ✅ IMPLEMENTED:**

- Video files (.mov, .mp4, etc.) are now cataloged but not auto-processed
- `convert-video` parser requires "process-video" tag to trigger conversion
- FileExplorer UI provides 🎬 Video button to add processing tag
- Clear separation between file cataloging and processing workflow
- Prevents unwanted automatic transcription of visual-only content

**Implementation Details (December 2024):**

- **Database Configuration**: Modified `convert-video` parser config with `input_tags = ["process-video"]`
- **UI Integration**: Updated `tagForVideoProcessing()` function in FileExplorer.vue to add "process-video" tag
- **Workflow Testing**: Verified complete workflow - files cataloged without processing until explicitly tagged
- **Cost Control**: Prevents unwanted OpenAI API charges for visual-only video content
- **User Experience**: 🎬 Video button serves as clear trigger for processing approval

**Technical Implementation:**

```sql
-- Parser configuration update applied:
UPDATE parser_configs SET input_tags = '["process-video"]' WHERE name = 'convert-video';
```

```javascript
// FileExplorer.vue function updated:
async function tagForVideoProcessing(fileId: number) {
  await $fetch(`/api/files/${fileId}/tags`, {
    method: "POST",
    body: { tag: "process-video", value: "ready" }
  });
}
```

**Verified Workflow:**

1. ✅ Drop .mov file → File cataloged in database (no processing)
2. ✅ No tags assigned initially → Parser configurations don't match
3. ✅ Click 🎬 Video button → Adds "process-video" tag
4. ✅ Tagged file triggers convert-video → normal processing chain begins
5. ✅ Cost control achieved → User explicit approval required

**Benefits Achieved:**

- **Selective Processing**: Only videos user explicitly approves get processed
- **Cost Management**: Prevents automatic transcription of visual-only content
- **Workflow Optimization**: Clear separation between cataloging and processing decisions
- **Future-Ready**: Prepared for "comprehend-video" processor mentioned by user

### Configuration Examples:

- Extension-based: `.mp3` files → transcribe parser
- Tag-based: files with `transcript` tag → summarize parser
- Hybrid: `.txt` files with `meeting` tag → specialized meeting summary parser

### **NEW: Design System & Figma Synchronization**

**Complete design system implementation for maintaining consistency between code and design:**

- **Design Tokens**: JSON-based single source of truth for colors, typography, spacing, shadows
- **Multi-format Generation**: CSS variables, SCSS, JavaScript/TypeScript, and Figma-compatible JSON
- **Style Dictionary Pipeline**: Automated token transformation and distribution
- **Figma Integration**: Direct sync via Figma Tokens plugin with automated GitHub Actions workflow
- **Token Extraction**: Automated analysis of existing Vue components to discover design tokens
- **Comprehensive Documentation**: Setup guides, usage examples, and troubleshooting

**Technical Implementation:**

- `src/design-system/tokens.json`: Master design token definitions
- `src/design-system/style-dictionary.config.js`: Build configuration for multiple output formats
- `src/design-system/extract-tokens.js`: Automated token extraction from Vue components
- `.github/workflows/design-tokens.yml`: CI/CD pipeline for automated token building and distribution
- Generated outputs: CSS custom properties, SCSS variables, JS/TS modules, Figma-compatible JSON

**Workflow Integration:**

1. Developer updates design tokens in JSON
2. GitHub Actions automatically builds all output formats
3. CSS variables available immediately in Nuxt application
4. Figma-compatible JSON downloadable from CI artifacts
5. Designer imports tokens into Figma via Figma Tokens plugin
6. Perfect synchronization between code implementation and design files

**Alternative Approaches Documented:**

- Storybook + component documentation approach for visual design system
- Custom token extraction and Figma plugin development options
- Hybrid approach combining Style Dictionary with Storybook for comprehensive design system

### **NEW: Simple Approval Gate System**

**Replaces Complex Batch System**: Simplified approval workflow for better user control.

**Core Changes:**

- **New "pending_approval" status** added to ParseRecord type
- **Jobs created but not queued** in approval mode
- **Simple checkbox interface** replaces complex batch approval UI
- **Database migration** automatically updates existing databases

**How it Works:**

1. **Approval Mode**: Jobs created as "pending_approval" status, not queued automatically
2. **Simple UI**: `/approval` page shows list of jobs with checkboxes
3. **Selective Approval**: User selects jobs and clicks "Approve Selected"
4. **Automatic Queuing**: Approved jobs change to "pending" and get queued for processing

**API Endpoints:**

- `GET /api/pending-approval` - Lists jobs waiting for approval
- `POST /api/approve-jobs` - Approves selected jobs and queues them

**Benefits:**

- **Prevents cascade explosions** - User can control which jobs run
- **Simple interface** - Just checkboxes, no complex batch management
- **Maintains existing workflow** - Approved jobs process normally
- **Database compatible** - Automatic migration preserves existing data

**User Experience:**

- Drop file → Jobs wait for approval (if in approval mode)
- Open `/approval` page → See pending jobs with checkboxes
- Select desired jobs → Click "Approve Selected" → Jobs process

**Status**: Fully implemented and ready for testing.

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

# Agent Memory - Voice Worker System

## Current System Architecture (As of June 2025)

### Core Components

- **File Monitoring**: TypeScript + chokidar file watcher with intelligent derivative file detection
- **Database**: SQLite with structured schema for files, parses, parser_configs, file_tags, file_metadata
- **Queue System**: BullMQ with Redis for job management
- **Web Interface**: Nuxt 3 application with real-time WebSocket updates
- **Processing**: OpenAI Whisper transcription, GPT-4 summarization, FFmpeg video conversion

### Parser Configuration System

The system uses a hybrid approach bridging hardcoded implementations with database-driven configurations:

- **Implementations**: TypeScript processors in `src/processors/` (transcribe.ts, summarize.ts, convert-video.ts, comprehend-video.ts)
- **Configurations**: Database records controlling when and how processors run
- **Bridge**: ParserConfigManager connects configs to implementations via explicit selection dropdowns
- **Matching**: Files processed based on extension patterns AND/OR file tags
- **Dependencies**: Parser configs can depend on other parsers completing first

### Batch Approval System (Complete Implementation)

**Database Schema Extensions:**

- `approval_batches` table: Tracks user approval sessions with selections and costs
- `predicted_jobs` table: Stores job chain predictions with cost estimates
- `system_settings` table: Global configuration including queue mode (auto/approval)
- Extended `parses` table: Added `approval_batch_id` foreign key for batch tracking
- Automatic migration system for existing databases

**Job Chain Prediction Engine:**

- Analyzes files to predict complete processing chains (.mov → .mp3 → .transcript.txt → .summary.txt)
- Calculates accurate costs for entire processing pipelines
- Integrates with existing ParserConfigManager for dependency resolution
- Updates predictions when new files are detected in approval mode

**API Endpoints:**

- `GET /api/predicted-jobs`: Returns files with processing chain predictions and costs
- `POST /api/approval-batches`: Creates approval batches from user selections
- `GET /api/approval-batches`: Lists all approval batches
- `GET /api/approval-batches/[id]/status`: Tracks batch progress with job counts
- `POST /api/approval-batches/[id]/execute`: Executes approved batches
- `GET/POST /api/queue-mode`: Manages queue mode switching

**Web Interface:**

- New `/approval` page with interactive batch selection interface
- Cost visualization showing individual step costs and total batch costs
- File selection with processing chain display and step-by-step approval
- Real-time progress tracking for active batches
- Queue mode switching controls (auto/approval)
- Integration with existing navigation and WebSocket updates

**Queue Integration:**

- File watcher respects queue mode: catalogs files but doesn't auto-process in approval mode
- Batch execution creates jobs with approval_batch_id for tracking
- Selective job execution based on user selections
- Progress monitoring linked to approval batches

### Key Features

**Cost Management:**

- Real-time cost calculation for transcription and summarization
- Batch cost estimation before approval
- Historical cost tracking for completed batches

**File Processing Chains:**

- Automatic video conversion (.mov/.mp4 → .mp3)
- Audio transcription with Whisper API
- Text summarization with GPT-4 Turbo
- Intelligent derivative file handling prevents processing loops

**User Control:**

- Queue mode switching: auto-processing vs. approval-based
- Selective job approval with cost visibility
- Progress monitoring for batch execution
- File organization with tagging system

### Recent Completions (June 2025)

1. **Batch Approval System**: Complete end-to-end implementation allowing users to review predicted processing chains with costs before approving selective execution

2. **Database Infrastructure**: Extended schema with proper foreign key relationships and automatic migration system

3. **Web Interface Enhancement**: Added approval page with modern UI for batch management and cost visualization

4. **Queue Mode Management**: Database-driven mode switching between automatic and approval-based processing

5. **Agentic System Foundation**: Externalized prompts system with file monitoring and agent-friendly editing APIs

### **NEW: Agentic System - Phase 1 Complete ✅**

**Prompt File Management System:**

- **PromptWatcher**: Monitors `prompts/` directory with chokidar for real-time file change detection
- **Parser Configuration Integration**: Detects which parsers reference changed prompts and logs impact
- **System Integration**: Fully integrated into main startup/shutdown process alongside FileWatcher

**Agent-Friendly APIs:**

- **GET /api/prompts**: Lists all prompt files with metadata (size, lines, last modified, preview)
- **GET /api/prompts/{filename}**: Returns prompt content with line numbers for precise editing
- **POST /api/prompts/{filename}/edit**: Line-based editing (insert/replace/delete operations)
- **POST /api/prompts/{filename}**: Full file replacement with atomic writes
- **Security**: Path traversal protection, file type validation, atomic operations

**Architecture Benefits:**

- **Event-Driven**: Prompt changes trigger system notifications and audit logging
- **Agent-Optimized**: Line-based editing prevents copy/edit/paste errors in tool calls
- **Audit Trail**: All prompt changes logged with parser configuration impact analysis
- **Safe Operations**: Atomic edits with validation prevent file corruption
- **Extensible**: Callback system allows future enhancements (caching, validation, etc.)

### Configuration Files

- `.env`: OpenAI API key configuration
- `package.json`: Dependencies and scripts
- Database: `./voice-worker.db` (auto-created)
- File monitoring: `./dropbox/` directory

### Current Status

The system is fully functional with both automatic and approval-based processing modes. Users can:

1. Switch between auto and approval modes via web interface
2. View predicted processing chains with accurate cost estimates
3. Selectively approve jobs for execution in batches
4. Monitor real-time progress of approved batches
5. Manage files and parser configurations through web interface

The 3 movie files mentioned by the user are ready for testing the batch approval workflow.

### Recent Bug Fixes (June 2025)

**Critical Database Path Issue Fixed:**

- **Problem**: Different Nuxt API endpoints were using inconsistent database paths (`"../../data.db"` vs `"../../../../../data.db"`)
- **Impact**: This caused multiple separate database files to be created, leading to "no such table: parser_configs" errors
- **Solution**: All endpoints now consistently use `config.dbPath` from Nuxt runtime configuration
- **Fixed Endpoints**: approval-batches, queue-mode, predicted-jobs, and their nested routes
- **Configuration**: Database path is set in `nuxt.config.ts` as `process.env.DB_PATH || "../../data.db"`

**TypeScript Loading Issue in ParserLoader Fixed:**

- **Problem**: ParserLoader tried to load `.ts` files directly in Nuxt runtime environment, causing "Unknown file extension .ts" errors
- **Impact**: Dynamic parser loading failed, falling back to hardcoded imports (Option C)
- **Solution**: Modified ParserLoader to prioritize `.js` files over `.ts` files in runtime environments
- **Graceful Handling**: Added specific error handling for TypeScript loading failures with informative warnings
- **Fallback Mechanism**: System designed with "Option C: Direct parser imports" fallback that works when dynamic loading fails

**Job Failure Handling and Error Visibility System:**

- **Problem**: Job failures in BullMQ queue weren't synchronized to database, leaving users unaware of processing errors
- **Impact**: Failed transcriptions (e.g., unsupported file formats) appeared to succeed but never completed
- **Solution**: Added comprehensive failure handling system:
  - Job failure handler in worker updates database parse records with error messages
  - New API endpoints (`/api/failed-jobs`, `/api/retry-failed`) for managing failures
  - Failed jobs section in web interface with prominent error display
  - **Elegant Retry Mechanism**: Instead of complex re-queuing, simply delete output file and let file watcher auto-reprocess
- **Design Insight**: Retry by deletion leverages existing deletion recovery system for consistency and simplicity

### **Codebase Consolidation & Refactoring (Partial)**

**Architectural consolidation work completed in June 2025:**

**Completed Tasks:**

- **Eliminated Redundant Web Interfaces** - Removed standalone Express server, consolidated to Nuxt 3 application
- **Simplified Design System Integration** - Moved design tokens into Nuxt project, streamlined pipeline
- **Consolidated Script Organization** - Created organized script structure with unified command interface
- **Resolved Parser/Processor Naming (Frontend Only)** - Updated user-facing interfaces to use "processor" terminology consistently
- **Consolidated Database/Queue Clients** - Created unified service layer with health checking

**Deferred Tasks (Significant Work Remaining):**

- **Complete Backend Terminology Alignment** - Core system still uses "parser" terminology in database schema, TypeScript interfaces, and class names
- **Directory Structure Flattening** - Deep nesting remains (`src/nuxt-web/server/api/...`)

**Current State:**

- Frontend consistently uses "processor" terminology
- Backend maintains "parser" terminology (hybrid approach to avoid database migrations)
- Single web interface with modern UI
- Unified command structure via centralized scripts
- Some architectural inconsistencies remain but system is functional

**Next Priority Tasks Defined:**

- Task A: Complete backend terminology alignment (high complexity, database migrations required)
- Task B: Flatten directory structure (high complexity, affects all import paths)
- Task C: Clean up remaining design-system package artifacts (low complexity)
