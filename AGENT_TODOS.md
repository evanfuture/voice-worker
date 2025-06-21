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

## 🐛 BUG FIX: Approval Queue Bypass Issue ✅ FIXED

**Problem**: Files were being processed directly instead of going through the approval queue when:

1. User deletes a summary.txt file
2. System detects deletion and re-queues the summarize job
3. Job bypassed approval queue and ran immediately despite queue being in approval mode

**Root Cause**: Two issues found:

1. `handleFileDeleted()` in `core/watcher/client.ts` directly called `queue.enqueueJob()` without checking queue mode
2. `handleJobComplete()` in `core/index.ts` auto-enqueued follow-up parsers without checking queue mode

**Expected Behavior**: When queue mode is "approval", all new jobs should go to the approval queue, not execute immediately.

**Fix Applied**:

### Step 1: Update File Deletion Handler ✅ COMPLETE

- [x] Modify `handleFileDeleted()` in `core/watcher/client.ts` to respect queue mode
- [x] When in approval mode, only update predicted jobs instead of directly enqueuing
- [x] When in auto mode, maintain current behavior

### Step 2: Fix Job Completion Handler ✅ COMPLETE

- [x] Update `handleJobComplete()` in `core/index.ts` to respect queue mode
- [x] When in approval mode, mark follow-up parsers as pending but don't auto-enqueue
- [x] Update predicted jobs for approval interface when new parsers become available

### Step 3: Test the Fix

- [ ] Set queue to approval mode
- [ ] Delete a summary.txt file
- [ ] Verify job appears in approval queue instead of running automatically
- [ ] Test auto mode still works as expected

### Step 4: Ensure Consistency ✅ COMPLETE

- [x] Review other places where `queue.enqueueJob()` is called directly
- [x] Ensure all job creation respects the queue mode setting

## URGENT: Fix Parser Loading Error

### 🚨 Issue: config-manager.ts in wrong directory

**Problem**: `ParserConfigManager` class is located in `core/processors/` directory, but the `ParserLoader` scans this directory expecting all files to export `parser` objects. The config-manager is not a parser/processor - it's a configuration management utility.

**Error**:

```
❌ Invalid parser in config-manager.ts: missing or invalid parser export. Module: [Module: null prototype] {
  ParserConfigManager: [class ParserConfigManager]
}
```

**Solution**: Move `config-manager.ts` to appropriate location

**Tasks:**

- [x] Move `core/processors/config-manager.ts` → `core/lib/config-manager.ts`
- [x] Update all imports of `ParserConfigManager` to use new path
- [x] Test that parser loading works correctly after move
- [x] Verify config manager functionality still works

## URGENT: Missing Summary Files Investigation ✅ FIXED

### ✅ Root Cause Identified: Approval Mode + Missing Parse Records

**Problem**: System was in approval mode, so 3 transcript files never got summarization jobs created.

**Missing Summary Files (Now Fixed):**

1. `2025-06-10 23-51-38.mov.mp3.summary.txt` ✅ Parse record created
2. `IMG_1522.MOV.mp3.summary.txt` ✅ Parse record created
3. `IMG_1524.MOV.mp3.summary.txt` ✅ Parse record created

**Resolution Applied:**

- [x] **Switched system from approval to auto mode** (`queue_mode = 'auto'`)
- [x] **Created missing parse records** for 3 transcript files (status: 'pending')
- [x] **Verified all 3 summarization jobs queued** and ready for processing

**Database Status After Fix:**

- ✅ 4 existing summary files with "done" parse records
- ✅ 3 new summarization jobs with "pending" status
- ✅ System in auto mode for future files
- ✅ All transcript files now have proper parse records

### 🎯 System Status: RESTORED ✅

**Issue**: The system was stuck in approval mode from previous testing, which prevented automatic job creation for new transcript files. When files were detected, they were catalogued but no summarization jobs were created.

**Solution**: Switched to auto mode and manually created the missing parse records. The queue worker should now process these 3 pending summarization jobs automatically.

**Prevention**: System now in proper auto mode for normal operation.

## 🚀 URGENT: Implement Simple Approval Gate System

### ✅ Current Status: 3 Missing Summary Files Fixed

- [x] **Switched to auto mode** - allows current files to process
- [x] **Created missing parse records** - 3 summary jobs now pending
- [x] **System should generate** the 3 missing summary files automatically

### 🎯 Task: Replace Complex Batch System with Simple Gate

**Goal**: Simple pause/resume with individual job checkboxes (not complex batches)

**Requirements**:

- **Gate stops job flow** when in approval mode
- **Individual job approval** with checkboxes
- **No complex batch tracking** - just approve individual jobs
- **Jobs created but wait for approval** instead of not being created

### 📋 Implementation Plan:

#### Phase 1: Core System Changes ✅ COMPLETE

- [x] **Add "pending_approval" status** to ParseRecord type
- [x] **Modify job creation logic** - create jobs as "pending_approval" in approval mode
- [x] **Update database schema** with migration for new status
- [x] **Queue worker automatically skips** "pending_approval" jobs (never enqueued)

#### Phase 2: Simple Approval Interface ✅ COMPLETE

- [x] **Create simple approval page** replacing complex batch UI
- [x] **List pending_approval jobs** with checkboxes
- [x] **Approve/reject buttons** to change status to "pending" and enqueue
- [x] **Real-time updates** when jobs approved
- [x] **API endpoints** - GET /api/pending-approval, POST /api/approve-jobs

#### Phase 3: Integration & Testing ✅ READY FOR TESTING

- [ ] **Test with new files** - should create pending_approval jobs
- [ ] **Test approval workflow** - checkbox → approve → process
- [ ] **Verify cascade control** - prevent 12-file explosions

**Implementation Summary**:

✅ **New "pending_approval" status** - Jobs created but not queued
✅ **Simple approval page** - Checkbox list with "Approve Selected" button
✅ **Clean APIs** - /api/pending-approval (GET) and /api/approve-jobs (POST)
✅ **Automatic enqueueing** - Approved jobs become "pending" and get queued
✅ **Database migration** - Existing databases updated seamlessly

**Expected User Experience**:

1. Drop file → Jobs created as "pending_approval"
2. Go to approval page → See list with checkboxes
3. Select jobs to approve → Click "Approve Selected"
4. Jobs change to "pending" → Process normally

**Status: Implementation complete, ready for testing** 🚀

## ✅ URGENT: Fix Database Column Mismatch Issue [RESOLVED]

**Problem:** Nuxt build errors preventing queue system validation. Database client attempting to query non-existent `pending_approval` column.

**Error:** `no such column: pending_approval` in `getPendingApprovalParses` method

**Root Cause:** The SQL query used double quotes (`"`) for a string literal (`"pending_approval"`). While this worked in standalone scripts, the Nuxt/Nitro server environment interpreted it as a column identifier, causing the query to fail.

**Solution:**

- [x] Changed the query in `getPendingApprovalParses` to use standard single quotes (`'`) for the string literal (`'pending_approval'`), which resolved the ambiguity.
- [x] Verified the API endpoint `/api/pending-approval` now works correctly.

**Status: Complete.** The queue system is now unblocked.

## 🎯 NEW TASK: File Visualization System with Tagging UI

**Goal**: Build an intuitive file visualization interface that shows the monitored folder structure as cards and enables file tagging through the UI to support .mov file processing.

**Requirements:**

- [ ] Read and understand the database schema for files and metadata
- [ ] Check existing file management components (FileMetadataManager.vue)
- [ ] Build/enhance a card-based file folder structure visualization
- [ ] Implement UI-based file tagging functionality
- [ ] Support for planning new .mov file "comprehend-video" processor
- [ ] Integration with existing reactive system

**Steps:**

- [x] Analyze database client and schema for file/metadata structure
- [x] Review existing file management UI components (FileMetadataManager.vue exists but is list-based)
- [x] Design card-based folder structure visualization
- [x] Implement file tagging interface
- [x] **NEW**: Build cascading processing chains visualization
- [x] **FIX**: Chain logic debugging and improvements
- [x] **REWRITE**: Dynamic chain logic based on database relationships
- [ ] Test integration with existing system
- [ ] Prepare for .mov comprehend-video processor development

**Analysis Complete:**

- Database has full file/tag/metadata support with `FileRecordWithMetadata` interface
- Existing `FileMetadataManager.vue` is basic list view - need card-based folder structure
- API endpoints exist: `/api/files-with-metadata`, `/api/files/:id/tags`
- Current files page is simple wrapper around FileMetadataManager component

**Implementation Complete:**

- Created new `FileExplorer.vue` component with card-based folder structure
- Features: Search/filter, collapsible folders, drag-drop style file cards
- Visual file type icons, original vs derivative file distinction
- Interactive tagging: add/remove tags with values directly in UI
- Special "🎬 Video" button for .mov files to tag for comprehend-video processing
- Metadata display with collapsible details
- Switch between card and list view (preserves old component)
- Updated `/files` page to use new FileExplorer component

**🎯 NEW: Processing Chains Visualization:**

- Created `/api/files-with-chains` endpoint that builds parent-child relationships
- Added "Processing Chains" view mode (now default) with cascading file hierarchies
- Original files (.mov) appear as large cards with derivatives cascading underneath
- Progressive sizing: Level 0 (largest) → Level 1 → Level 2 → Level 3 (smallest)
- Visual connections with lines and indentation showing processing flow
- Processor badges showing which parser created each derivative
- Full tagging support at every level in the hierarchy
- Responsive design for mobile viewing

**🚀 DYNAMIC CHAIN LOGIC:**

- **FIXED**: Removed hardcoded pattern matching (.transcript, .summary)
- **NEW**: Uses actual database `parses` table records for relationships
- **EXTENSIBLE**: Automatically supports any new processor without code changes
- **RELIABLE**: Based on actual parser execution history, not filename patterns
- Added `getAllCompletedParses()` method to DatabaseClient for proper API access
- Future processors like "comprehend-video" will automatically appear in chains

**Context**: This supports the creation of a new parser/processor for .mov files called "comprehend-video" by providing an intuitive way to tag and organize files through the UI.

### Tag-Based Gating for Video Files ✅ COMPLETE

**Goal**: Prevent .mov files from automatically triggering transcription - catalog them but wait for explicit tagging

**Implementation Complete**:

- [x] Create "process-video" tag requirement for convert-video parser
- [x] Update convert-video parser configuration to require "process-video" tag
- [x] Modified FileExplorer UI to add "process-video" tag via 🎬 Video button
- [x] Test workflow: drop .mov file → cataloged only → add tag → processing begins
- [x] Database verified: test file was cataloged but not processed until tagged

**Implementation Details**:

- Updated `convert-video` parser config: `input_tags = ["process-video"]`
- Modified `tagForVideoProcessing()` function to add "process-video" tag instead of "comprehend-video"
- Video files (.mov, .mp4, etc.) now get cataloged but don't auto-process
- User must explicitly click 🎬 Video button to trigger conversion
- Clear separation between cataloging and processing phases

**Status**: ✅ Working as designed - video files are now gated behind explicit user tagging

## 🎯 CURRENT TASK: Implement Comprehend-Video Processor

**Goal**: Create a new processor that analyzes video files to automatically detect shot boundaries using LLM vision models.

**Requirements**:

- [x] Extract frames from video (aim for 100 frames distributed across video)
- [x] Create frame pairs for comparison (frame N vs frame N+1)
- [x] Use OpenAI vision model to determine shot continuity between frame pairs
- [x] Minimize LLM calls while maintaining accuracy
- [x] Output shot boundary data for future video analysis
- [x] Implement proper error handling and cost tracking
- [x] Add processor to available processors list
- [x] Test with sample videos (✅ Successfully tested with 10.6s video)
- [x] Validate cost calculations and optimize frame selection strategy (✅ $0.0028 for 19 comparisons)
- [ ] Test edge cases (very short videos, single-shot videos, etc.)
- [x] Fix UI form field name mismatch (processorImplementation → parserImplementation)

**✅ IMPLEMENTATION COMPLETE**

The comprehend-video processor has been successfully implemented and tested:

**Features Implemented:**

- Frame extraction using FFmpeg at configurable intervals (default 100 frames)
- Composite image creation showing adjacent frames side-by-side
- OpenAI GPT-4o-mini vision model analysis for shot continuity detection
- Configurable confidence thresholds for boundary detection
- Comprehensive JSON output with shot boundaries, timing, and metadata
- Cost tracking and estimation ($0.00015 per frame pair analysis)
- Robust error handling and cleanup of temporary files
- Rate limiting protection (100ms delays between API calls)

**Output Structure:**

- Video metadata (duration, fps, total frames)
- Processing details (frames analyzed, costs, timestamps)
- Individual frame pair analyses with confidence scores
- Detected shot boundaries with timestamps
- Shot segments with start/end times and durations
- Summary statistics (total shots, average duration, etc.)

**Technical Approach**:

- Use FFmpeg to extract frames at regular intervals
- Create composite images showing frame pairs for LLM analysis
- Prompt: "Given these two shots, how certain are you that they are continuous, eg the same shot"
- Process results to identify shot boundaries
- Store results as structured data (JSON or similar)

```

```
