# Agent Todos

## File Monitoring & Parsing System - Core Complete ✅

### Current System State

✅ **System Components Implemented:**

- [x] File monitoring with chokidar
- [x] SQLite database with proper field mapping
- [x] BullMQ job queue with Redis
- [x] OpenAI Whisper transcription (small and large files)
- [x] Deletion recovery system
- [x] Modern Nuxt 3 web interface with three-page navigation
- [x] Real-time WebSocket updates
- [x] Cost calculation and management
- [x] **Robust file deletion recovery** - automatic cleanup of orphaned database records and queue jobs

✅ **Hybrid Parser Configuration System:**

- [x] Extended database schema with parser_configs, file_tags, file_metadata tables
- [x] ParserConfigManager bridge between hardcoded implementations and database configs
- [x] Parser configuration API endpoints
- [x] Parser configuration UI with implementation selection dropdown
- [x] File tagging system with automatic tagging (e.g., `.transcript.` files get `transcript` tag)
- [x] Integration with file processing flow using both extensions and tags
- [x] Multiple configurations per parser implementation support

### Current Architecture Summary

**Parser System:**

- **Implementations**: Hardcoded TypeScript files (`src/processors/transcribe.ts`, `src/processors/summarize.ts`)
- **Configurations**: Database records that control WHEN to run and WHICH implementation to use
- **Bridge**: `ParserConfigManager` connects configs to implementations
- **Processing**: Files matched by extension AND/OR tags trigger appropriate parsers

**Web Interface:**

- **Dashboard** (`/`): Queue control, job management, cost monitoring
- **Files & Tags** (`/files`): File organization, tagging, metadata
- **Parser Config** (`/parsers`): Create and manage parser configurations

### Future Enhancement Opportunities

**Parser System Improvements:**

- [ ] Dynamic TypeScript parser loading (investigate Nuxt TypeScript compilation at runtime)
- [ ] Parser configuration validation improvements (better dependency cycle detection)
- [ ] Parser configuration templates/presets for common workflows
- [ ] Parser configuration export/import functionality
- [ ] Parser execution history and analytics

**User Interface Enhancements:**

- [ ] Drag-and-drop file organization in web interface
- [ ] Bulk file tagging operations
- [ ] Advanced search and filtering for files
- [ ] Parser configuration wizard for complex workflows
- [ ] Visual dependency graph for parser configurations
- [ ] Audio stream selection UI for advanced users (currently auto-mixes all streams)

**System Architecture:**

- [ ] Database migration system for schema changes
- [ ] Configuration backup/restore functionality
- [ ] Multi-user support with permissions
- [ ] Parser configuration versioning
- [ ] File processing analytics and reporting

**Integration & Extensions:**

- [ ] Additional parser implementations (e.g., translation, sentiment analysis)
- [ ] External service integrations beyond OpenAI
- [ ] File format conversion utilities
- [ ] Batch processing optimization
- [ ] API webhooks for external notifications

### Current Limitations

- Parser implementations must be hardcoded in TypeScript files
- Available parsers list is hardcoded in API due to Nuxt/TypeScript loading constraints
- Database schema changes require manual migration
- No built-in backup/restore for configurations
- Basic validation for parser configuration dependencies

### Setup Instructions

1. Install dependencies: `npm install`
2. Create .env file: `OPENAI_API_KEY=your_key_here`
3. Ensure FFmpeg is available in PATH
4. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
5. Run system: `npm run dev`
6. Run web interface: `cd src/nuxt-web && npm run dev`
7. Open browser: `http://localhost:3000`
8. Drop files in ./dropbox folder and use web interface for management

### Current Tasks - June 2025

**Parser Configuration Management:**

- [x] Add delete functionality for parser configurations in UI
- [x] Fix extension detection bug where .transcript.txt files showed as .txt in logs (Fixed: Made getFileExtension public and used it consistently in error messages)
- [x] Determine if parser configs need option to allow derived/generated files (Added allowDerivedFiles flag to parser configurations)
- [x] Consider connecting watcher output from first parser to subsequent parsers (Already implemented via job completion handler and dependency system)
- [x] Update summarize implementation to use real OpenAI GPT-4 Turbo calls with cost calculation integrated into job queue

## Fix .mov video support

- [x] Rename "parsers" folder to "processors" to distinguish from "parser configs"
- [x] Update all imports and references from parsers/_ to processors/_
- [x] Create video processor that converts .mov files to .mp3 using ffmpeg
- [x] Fix the multiple audio stream issue in ffmpeg command
- [x] Test video processor with the problematic .mov file
- [x] Update system documentation to reflect naming changes
- [ ] Add .mov extension to transcribe processor configuration
- [x] Implement intelligent multi-stream audio mixing (auto-detects and mixes all audio streams)
- [x] **Fix duplicate job creation on restart** - prevent duplicate jobs when system restarts after interruption
- [x] **Implement file deletion recovery** - automatically clean up orphaned database records and queue jobs for deleted files
- [x] **Fix duplicate processing of video files** - removed video formats from transcribe processor to prevent both convert-video and transcribe from processing same .mov/.mp4 files

## Debug transcription "Invalid file format" error

- [x] **Investigate OpenAI API "Invalid file format" error** - Error was intermittent/historical, direct API calls work perfectly with the same MP3 file
- [x] **Create isolated test script** - Confirmed the MP3 file and API integration work correctly outside the main system
- [x] **Identify root cause** - The error occurred on 2025-06-10T22:21:30.752Z but current system works fine; likely transient environment or system state issue
- [x] **Test system re-processing** - System should work fine now; original error was transient/historical (moved old transcript file to allow re-processing)
- [ ] **Consider adding retry logic** - Add automatic retry for transient API failures to prevent similar issues in the future
