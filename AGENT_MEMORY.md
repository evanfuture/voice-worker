# Agent Memory

## Project: File Monitoring & Parsing System

### Overview

Building a TypeScript-based file monitoring system that:

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
- Self-healing on deletions (CONFIRMED WORKING)
- Multi-stage processing support
- CLI controls for queue management
- Audio chunking for large files before transcription

### Implementation Status

✅ Complete TypeScript implementation with:

- File monitoring system (chokidar)
- SQLite database with proper schema
- BullMQ job queue with Redis
- Dynamic parser loading system
- CLI tools for management
- Example parsers: audio-chunk, transcribe, summarize
- Comprehensive documentation

### User's Specific Workflow Requirements (Jan 2025)

**Requirements:**

1. Audio file → chunks (temp, not kept long term)
2. Each chunk → transcribed (temp transcripts, recoverable on failure)
3. Transcription files → merged into final output
4. Final output linked to input (delete input = delete output, delete output = re-parse)

**Current Implementation:**
✅ **Audio chunking**: Large files (>10MB) split using FFmpeg into `/chunks/` subfolder
✅ **Chunk transcription**: `chunk-processor` parser transcribes each chunk individually
✅ **Final combination**: Creates `.combined.transcript.txt` with all chunks merged
✅ **File linking**: Database tracks input→output relationships, handles deletion recovery
✅ **Cleanup option**: Temporary chunk files can be auto-deleted (currently commented out)

### Current Parsers

1. **audio-chunk**: Splits large audio files (>10MB) using FFmpeg
2. **transcribe**: Audio files → transcript text (for small files <10MB)
3. **chunk-processor**: Chunks manifest → transcribe each chunk → combined transcript
4. **summarize**: Transcript → summary (depends on transcribe/chunk-processor)

### Recent Fixes (Jan 2025)

✅ **Fixed Parser Loading Issue:**

- ParserLoader now excludes `loader.ts` from being processed as a parser
- No more "Invalid parser" warnings

✅ **Implemented User's Workflow:**

- `chunk-processor` now actually transcribes individual chunks instead of creating mock content
- Each chunk is transcribed separately with proper error handling
- Final transcript combines all chunks in order
- Optional cleanup mechanism for temporary files (commented out, easy to enable)
- Maintains file linking for deletion recovery

### Workflow Summary

**Small Files (<10MB):**
Audio file → `transcribe` → `.transcript.txt` → `summarize` → `.summary.txt`

**Large Files (>10MB):**
Audio file → `audio-chunk` → chunks + `.chunks.txt` → `chunk-processor` → `.combined.transcript.txt` → `summarize` → `.summary.txt`

### Next Steps for User

1. Install dependencies: `npm install`
2. Ensure FFmpeg is installed and available in PATH
3. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
4. Run system: `npm run dev`
5. Drop files in ./dropbox folder to test
6. Test both small (<10MB) and large (>10MB) audio files
7. Test deletion recovery by deleting output files
