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

### Architecture

- Pluggable parser interface
- Self-healing on deletions
- Multi-stage processing support
- CLI controls for queue management

### Implementation Status

✅ Complete TypeScript implementation with:

- File monitoring system (chokidar)
- SQLite database with proper schema
- BullMQ job queue with Redis
- Dynamic parser loading system
- CLI tools for management
- Example parsers: transcribe, summarize, chunk
- Comprehensive documentation

### Next Steps for User

1. Install dependencies: `npm install`
2. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
3. Run system: `npm run dev`
4. Drop files in ./dropbox folder to test
