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

### Current Transcription Workflow (June 2025)

**Unified transcribe parser handles all audio files with OpenAI Whisper:**

- Small files (≤10MB): Direct OpenAI Whisper-1 API transcription
- Large files (>10MB): Internal chunking → transcribe chunks with OpenAI → merge → cleanup temp files
- Always outputs: `audio.mp3` → `audio.mp3.transcript.txt`
- Chunking is internal implementation detail, invisible to user
- Automatic temp file cleanup with proper ES module imports
- Real transcription with timestamps, segments, and duration information

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

### Modern Nuxt 3 Web Interface (MIGRATED)

**New Architecture:**

- `src/nuxt-web/` - Complete Nuxt 3 application
- `src/nuxt-web/server/api/` - Nitro API routes replacing Express endpoints
- `src/nuxt-web/server/routes/_ws.ts` - WebSocket handler using experimental support
- `src/nuxt-web/app.vue` - Vue.js single-page application

**Features:**

- Real-time queue status monitoring via WebSocket (useWebSocket from VueUse)
- Pause/Resume queue controls for cost management
- Job listing with status, timestamps, and actions
- Individual job retry/remove functionality
- Clear all completed/failed jobs (safe for multi-Redis environments)
- Connection status indicator with auto-reconnect
- Responsive design for mobile/desktop
- Modern Vue.js reactive interface with TypeScript

**API Endpoints (Nitro):**

- `GET /api/status` - Queue status and pause state
- `POST /api/pause` - Pause transcription queue
- `POST /api/resume` - Resume transcription queue
- `GET /api/jobs` - List all jobs with status
- `POST /api/jobs/:id/retry` - Retry failed job
- `DELETE /api/jobs/:id` - Remove job
- `POST /api/clear-completed` - Clear completed/failed jobs safely
- `GET /api/files` - List database files

**WebSocket Support:**

- `ws://localhost:3000/_ws` - Real-time status updates
- Uses Nuxt 3 experimental WebSocket support with `defineWebSocketHandler`
- Automatic reconnection and heartbeat via VueUse
- Status broadcasts for real-time UI updates

**Running the New Interface:**

- `cd src/nuxt-web && npm run dev` - Development server
- `cd src/nuxt-web && npm run build && npm run start` - Production
- Available at `http://localhost:3000`
- WebSocket automatically connects for real-time updates

**Migration Notes:**

- Original Express server preserved in `src/web/` (archived)
- `src/web.ts` now shows migration notice and instructions
- Full feature parity with original interface
- Modern Vue.js architecture with reactive state management
- Enhanced with VueUse composables for better UX

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
- **Modern Nuxt 3 web interface with Vue.js and WebSocket support**
- **Real OpenAI Whisper-1 API integration with detailed transcription output**
- **Environment variable configuration with dotenv**
- **Error handling and fallback for API failures**

### Setup Instructions

1. Install dependencies: `npm install`
2. Create .env file with your OpenAI API key: `OPENAI_API_KEY=your_key_here`
3. Ensure FFmpeg is installed and available in PATH
4. Start Redis: `docker run -d -p 6379:6379 redis:alpine`
5. Run system: `npm run dev`
6. Run web interface: `cd src/nuxt-web && npm run dev`
7. Open browser: `http://localhost:3000`
8. Drop audio files in ./dropbox folder
9. Control queue via modern web interface
