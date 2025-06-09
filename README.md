# Voice Worker

A TypeScript-based file monitoring and parsing system that watches a folder, catalogs files, and runs configurable parsers with dependency management.

## Features

- 📁 **File System Monitoring** - Watches a designated folder for file changes
- 🗄️ **SQLite Database** - Tracks file metadata and parsing status
- ⚡ **Job Queue** - BullMQ-based queue system with Redis for reliable job processing
- 🔌 **Pluggable Parsers** - Dynamic parser loading with dependency resolution
- 🔄 **Self-Healing** - Automatically re-queues jobs when output files are deleted
- 🎛️ **CLI Controls** - Pause, resume, retry, and monitor the system
- 🏗️ **Multi-Stage Processing** - Support for parser dependencies and pipelines

## Quick Start

### Prerequisites

- Node.js ≥18
- Redis server

### Installation

```bash
# Install dependencies
npm install

# Start Redis (using Docker)
docker run -d -p 6379:6379 redis:alpine

# Start the system
npm run dev
```

### Usage

1. **Drop files** into the `./dropbox` folder
2. **Watch the logs** as files are processed
3. **Check outputs** - processed files appear alongside inputs
4. **Use CLI** to monitor and control the system

```bash
# Check queue status
npm run cli status

# Pause processing
npm run cli pause

# Resume processing
npm run cli resume

# List current jobs
npm run cli jobs
```

## Architecture

### Components

- **File Watcher** (`chokidar`) - Monitors filesystem changes
- **Database** (`better-sqlite3`) - Stores file and parsing metadata
- **Queue System** (`bullmq` + Redis) - Manages job processing
- **Parser Loader** - Dynamic import and dependency resolution
- **CLI Tool** - Queue management and monitoring

### File Flow

```
Input File → File Watcher → Database Catalog → Parser Selection → Job Queue → Parser Execution → Output File
     ↑                                                                                              ↓
     └── Re-queue if output deleted ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

## Creating Parsers

Parsers are TypeScript files in `src/parsers/` that export a `parser` object:

```typescript
// src/parsers/my-parser.ts
import type { Parser } from "../types.js";

export const parser: Parser = {
  name: "my-parser",
  input: [".txt", ".md"], // File extensions to process
  outputExt: ".processed.txt", // Output file extension
  dependsOn: ["other-parser"], // Dependencies (optional)

  async run(inputPath: string): Promise<string> {
    // Your processing logic here
    const outputPath = inputPath + ".processed.txt";
    // ... do work ...
    return outputPath;
  },
};
```

### Built-in Parsers

#### `transcribe`

- **Input**: `.m4a`, `.wav`, `.mp3`, `.mp4`, `.mov`
- **Output**: `.transcript.txt`
- **Purpose**: Mock audio transcription (replace with real service)

#### `summarize`

- **Input**: `.transcript.txt`
- **Output**: `.summary.txt`
- **Dependencies**: `transcribe`
- **Purpose**: Generate summaries from transcripts

## CLI Commands

```bash
# Queue management
npm run cli status          # Show queue status
npm run cli pause           # Pause job processing
npm run cli resume          # Resume job processing
npm run cli jobs            # List current jobs
npm run cli retry <jobId>   # Retry a failed job
npm run cli remove <jobId>  # Remove a job
npm run cli clean           # Remove old completed jobs

# Database
npm run cli db-status       # Show database information
```

## Configuration

The system uses these default settings:

```typescript
const config = {
  watchDir: "./dropbox", // Folder to monitor
  dbPath: "./data.db", // SQLite database file
  redisHost: "127.0.0.1", // Redis host
  redisPort: 6379, // Redis port
};
```

## Database Schema

### Files Table

```sql
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  sha256 TEXT NOT NULL,
  kind TEXT CHECK (kind IN ('original', 'derivative')),
  created_at INTEGER,
  updated_at INTEGER
);
```

### Parses Table

```sql
CREATE TABLE parses (
  file_id INTEGER,
  parser TEXT,
  status TEXT CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  output_path TEXT,
  updated_at INTEGER,
  error TEXT,
  PRIMARY KEY (file_id, parser)
);
```

## Development

```bash
# Build TypeScript
npm run build

# Run in development with auto-reload
npm run dev

# Production mode
npm start
```

## Error Handling

- **Self-Healing**: If output files are deleted, the system automatically re-queues the jobs
- **Retry Logic**: Failed jobs are automatically retried with exponential backoff
- **Graceful Shutdown**: Handles SIGINT/SIGTERM for clean shutdown
- **Job Persistence**: Jobs survive system restarts via Redis persistence

## Extending the System

### Adding New Parsers

1. Create a new file in `src/parsers/`
2. Implement the `Parser` interface
3. Restart the system to load the new parser

### Parser Dependencies

Parsers can depend on other parsers:

```typescript
export const parser: Parser = {
  name: "advanced-analysis",
  input: [".summary.txt"],
  outputExt: ".analysis.txt",
  dependsOn: ["transcribe", "summarize"], // Runs after both complete
  // ...
};
```

### Custom Processing Stages

For complex pipelines, create intermediate parsers:

```typescript
// Chunking stage
export const parser: Parser = {
  name: "chunk",
  input: [".txt"],
  outputExt: ".chunked.txt",
  dependsOn: [],
  // ... chunking logic
};

// Analysis stage
export const parser: Parser = {
  name: "analyze",
  input: [".chunked.txt"],
  outputExt: ".analysis.txt",
  dependsOn: ["chunk"],
  // ... analysis logic
};
```

## Production Deployment

### Redis Setup

```bash
# Production Redis with persistence
docker run -d \
  --name voice-worker-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:alpine redis-server --appendonly yes
```

### Process Management

```bash
# Using PM2
npm install -g pm2
pm2 start npm --name "voice-worker" -- start
pm2 startup
pm2 save
```

### Monitoring

- Use BullMQ Arena for queue monitoring
- Monitor the SQLite database size
- Set up log rotation for application logs

## License

MIT
