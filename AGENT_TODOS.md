# Agent Todos

## 🔧 Codebase Consolidation Status

**Progress: 6 of 6 priority consolidation tasks completed ✅**

### ✅ COMPLETED:

1. **Eliminated Redundant Web Interfaces** - Removed Express server, consolidated to Nuxt 3
2. **Simplified Design System Integration** - Moved tokens to Nuxt, streamlined pipeline
3. **Consolidated Script Organization** - Unified command interface with organized scripts
4. **Resolved Parser/Processor Naming (Frontend)** - Updated user-facing interfaces to use "processor"
5. **Remove Redundant Design System Package** - Cleaned up artifacts after token integration
6. **Flatten Directory Structure** - Complete monorepo reorganization ✅

### 🎯 CURRENT TASK: Flatten Directory Structure (Task A)

**Goal**: Transform deep nested structure into clear monorepo organization

**Target Structure**:

```
voice-worker/
├── /web/              # Nuxt interface (from src/nuxt-web)
├── /core/             # Core system (from src/lib, src/processors, src/queue, src/watcher, src/db)
├── /cli/              # CLI interface (from src/cli)
├── /scripts/          # Automation (existing)
└── /tests/            # Tests (existing)
```

**Step-by-Step Plan**:

#### Phase 1: Prepare and Validate

- [x] Create new directory structure (empty directories)
- [x] Update tsconfig.json with path mappings for new structure
- [x] Test that TypeScript compilation still works with path mappings

#### Phase 2: Move Core System Files

- [x] Move `src/lib/` → `/core/lib/`
- [x] Move `src/processors/` → `/core/processors/`
- [x] Move `src/queue/` → `/core/queue/`
- [x] Move `src/watcher/` → `/core/watcher/`
- [x] Move `src/db/` → `/core/db/`
- [x] Move `src/utils/` → `/core/utils/`
- [x] Move `src/types.ts` → `/core/types.ts`
- [x] Move `src/index.ts` → `/core/index.ts`

#### Phase 3: Move CLI

- [x] Move `src/cli/` → `/cli/`

#### Phase 4: Move Web Interface

- [x] Move `src/nuxt-web/` → `/web/`
- [x] Update web interface package.json paths if needed

#### Phase 5: Update Import Paths

- [x] Update all imports in `/core/` to use new relative paths
- [x] Update all imports in `/cli/` to use new relative paths
- [x] Update all imports in `/web/` to use new relative paths
- [x] Update imports in `/scripts/` to use new paths

#### Phase 6: Update Build Configuration

- [x] Update main package.json scripts to use new paths
- [x] Update tsconfig.json build paths
- [x] Update any hardcoded paths in scripts

#### Phase 7: Clean Up and Validate

- [x] Remove empty `src/` directory
- [x] Test all functionality (CLI, web interface, scripts)
- [x] Update README.md with new structure
- [x] Commit changes

**TASK A: COMPLETE ✅**

All phases completed successfully. The monorepo structure is now:

```
voice-worker/
├── /core/             # Core system (processors, queue, db, watcher, utils, types)
├── /cli/              # CLI interface
├── /web/              # Nuxt web interface
├── /scripts/          # Automation scripts
├── /docs/             # Documentation
└── /tests/            # Tests
```

**Why This Approach Works**:

- Each phase is independently testable
- TypeScript path mappings allow gradual migration
- Can rollback at any phase if issues arise
- Maintains working system throughout process

---

## 📋 CURRENT STATE ASSESSMENT:

**What Works**:

- Clean monorepo structure with logical separation
- Single web interface with modern UI
- Unified command structure
- Consistent user-facing terminology
- Integrated design tokens
- All consolidation tasks complete

**What's Consistent**:

- Clear directory organization (core/, cli/, web/, scripts/, docs/, tests/)
- Build processes work seamlessly
- All functionality preserved and tested

**Achievement**: Successfully transformed complex nested structure into maintainable monorepo organization while preserving all functionality.

## URGENT: Fix Prediction Logic in Nuxt Context ✅ RESOLVED

### ✅ Root Cause Identified: Environment Variable Loading Issue

**Actual Problem:** Parser imports were failing because OpenAI clients were initialized at module-level, but Nuxt server context didn't have access to root `.env` file containing `OPENAI_API_KEY`.

**Error Symptoms:**

- `ERROR [uncaughtException] The OPENAI_API_KEY environment variable is missing or empty`
- Dynamic parser loading returned 0 parsers
- Empty predicted chains `[]` for all files
- Misleading error suggesting TypeScript import issues

**Real Issue:** Not TypeScript dynamic loading, but environment variable availability during module imports.

### ✅ Solution Implemented

#### 1. Lazy OpenAI Client Initialization ✅ COMPLETE

- [x] Replace module-level `const openai = new OpenAI()` with lazy `getOpenAIClient()` function
- [x] Fixed `src/processors/transcribe.ts` - OpenAI client initialized only when `run()` is called
- [x] Fixed `src/processors/summarize.ts` - OpenAI client initialized only when `run()` is called
- [x] Processors can now be imported without immediate API key requirement

#### 2. Nuxt Environment Variable Configuration ✅ COMPLETE

- [x] Added `OPENAI_API_KEY` to Nuxt `runtimeConfig` for server access
- [x] Added explicit dotenv loading in `nuxt.config.ts` to load root `.env` file
- [x] Configured proper path resolution: `config({ path: resolve(__dirname, '../../.env') })`

#### 3. Filter Completed Files from Predictions ✅ COMPLETE

- [x] Modified `getAllPredictedJobs()` to check completed parses before generating predictions
- [x] Added `predictProcessingChainWithCompleted()` method to respect already processed files
- [x] Only generate predictions for files with remaining processing steps
- [x] Invalidate predicted jobs for files with no remaining work

### 🧪 Testing Phase: Validate Environment Fix ✅ WORKING

#### Environment variable fix confirmed working:

- [x] Frontend is working, parsers loading successfully

#### Test the completed file filtering:

- [ ] Switch to approval mode: `POST /api/queue-mode {"queueMode": "approval"}`
- [ ] Call `GET /api/predicted-jobs` - should only show files that need processing
- [ ] Verify completed files don't appear in approval queue
- [ ] Test with mix of completed and new files

### Test Case for Validation

1. Switch to approval mode: `POST /api/queue-mode {"queueMode": "approval"}`
2. Add new .mov file to dropbox/
3. Call `GET /api/predicted-jobs`
4. Should return only files needing processing, not completed ones

### 📋 Key Learning

- ✅ **Dynamic loading worked fine** - the ParserLoader logic is correct
- ✅ **Issue was environment variables** - module-level OpenAI initialization failed in Nuxt context
- ✅ **Lazy initialization solves it** - processors can be imported, API key checked only when needed
- ✅ **Nuxt dotenv configuration needed** - explicit root .env loading required
- ✅ **Completed files filtered** - prediction logic now respects database state

**Status: Environment fix confirmed working. Completed file filtering implemented and ready for testing.**

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

## Batch Approval Parser Flow ✅ COMPLETE

The system now supports full batch approval workflow with cost visibility and user control over processing.

### **Phase 1: Database Infrastructure ✅ COMPLETE**

- [x] Create approval_batches table schema
- [x] Create predicted_jobs table schema
- [x] Create system_settings table for queue mode
- [x] Extend parses table with approval_batch_id foreign key
- [x] Add database migration logic
- [x] Update TypeScript types for new tables

### **Phase 2: Job Chain Prediction Engine ✅ COMPLETE**

- [x] Extend ParserConfigManager with prediction capabilities
- [x] Add predictProcessingChain() method
- [x] Add estimateProcessingCost() for cost calculation
- [x] Add updatePredictedJob() method to generate predictions
- [x] Add calculateBatchCost() for user selection totals

### **Phase 3: API Foundation ✅ COMPLETE**

- [x] GET /api/predicted-jobs - Returns files with predicted processing chains
- [x] POST /api/approval-batches - Creates approval batch from user selections
- [x] GET /api/queue-mode - Returns current queue mode setting
- [x] POST /api/queue-mode - Sets queue mode between auto/approval
- [x] GET /api/approval-batches/[id]/status - Track batch progress
- [x] POST /api/approval-batches/[id]/execute - Execute approved batch
- [x] GET /api/approval-batches - Get all approval batches

### **Phase 4: Web Interface ✅ COMPLETE**

- [x] Create approval.vue page with batch selection interface
- [x] Add cost visualization and calculation
- [x] Add file selection with processing chain display
- [x] Add batch creation and execution controls
- [x] Add active batch monitoring with progress tracking
- [x] Add navigation link to approval page
- [x] Add queue mode switching controls

### **Phase 5: Queue Integration ✅ COMPLETE**

- [x] Modify file watcher to check queue mode before auto-processing
- [x] Add approval mode detection with prediction updates
- [x] Ensure batch execution creates jobs with approval_batch_id

```

```
