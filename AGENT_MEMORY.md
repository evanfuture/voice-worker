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

### Tech Stack

- TypeScript + Node.js (no Python)
- chokidar for file watching
- BullMQ + Redis for job queue
- better-sqlite3 for metadata storage
- Dynamic parser loading system
- FFmpeg for audio processing

### Architecture

- Pluggable parser interface
- Self-healing deletion recovery (CONFIRMED WORKING)
- Multi-stage processing support
- CLI controls for queue management
- Audio chunking for large files before transcription

### Current Transcription Workflow (Jan 2025)

**Unified transcribe parser handles all audio files:**

- Small files (≤10MB): Direct transcription
- Large files (>10MB): Internal chunking → transcribe chunks → merge → cleanup temp files
- Always outputs: `audio.mp3` → `audio.mp3.transcript.txt`
- Chunking is internal implementation detail, invisible to user
- Automatic temp file cleanup with proper ES module imports

**Key Implementation Details:**

- Uses FFmpeg for audio segmentation (5-minute chunks)
- Creates timestamped temp directories in `tmp/transcribe-{timestamp}/`
- Mock transcription functions simulate API calls with 1.5s delay
- Error recovery continues with other chunks if one fails
- Uses `rmSync()` with recursive cleanup (not deprecated `require()`)

### Database Schema & Field Mapping

**Critical: Database uses snake_case, TypeScript uses camelCase**

- Database client includes proper field mapping in all methods
- `file_id` → `fileId`, `output_path` → `outputPath`, etc.
- All database methods convert field names to match TypeScript interfaces

**Files table:**

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  sha256 TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('original', 'derivative')),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);
```

**Parses table:**

```sql
CREATE TABLE parses (
  file_id INTEGER,
  parser TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  output_path TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  error TEXT,
  PRIMARY KEY (file_id, parser)
);
```

### Current Parsers

1. **transcribe**: All audio formats → transcript text (handles both small and large files internally)
2. **summarize**: Transcript → summary (depends on transcribe)

### Workflow Summary

**All audio files:**
Audio file → `transcribe` → `.transcript.txt` → `summarize` → `.summary.txt`

**Deletion recovery:**
Delete `.transcript.txt` → automatically re-queues transcription of original audio file

### System Status

✅ **Complete and working:**

- File monitoring system with chokidar
- SQLite database with proper field mapping
- BullMQ job queue with Redis
- Dynamic parser loading
- CLI management tools
- Unified transcription workflow for all file sizes
- Deletion recovery system
- Temp file cleanup
- Job completion handlers with database updates

### Setup Instructions

1. Install dependencies: `npm install`
2. Ensure FFmpeg is installed and available in PATH
3. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
4. Run system: `npm run dev`
5. Drop audio files in ./dropbox folder
6. Delete output files to test recovery system
