# Voice Worker

A modern TypeScript-based file monitoring and processing system with web interface that watches folders, catalogs files, and runs configurable processors with intelligent dependency management.

## ✨ Features

- 📁 **File System Monitoring** - Real-time folder watching with intelligent file cataloging
- 🌐 **Modern Web Interface** - Nuxt 3 web app with real-time WebSocket updates
- 🗄️ **Graph Database (Convex)** - Node-based content graph with typed relationships
- ⚡ **Job Queue System** - BullMQ-based queue with Redis for reliable job processing
- 🔧 **Configurable Processors** - Database-driven processor configurations with UI management
- 🔗 **Dependency Resolution** - Smart processor dependencies and execution ordering
- 🔄 **Self-Healing** - Automatically re-queues jobs when output files are deleted
- 💰 **Cost Management** - Real-time cost calculation and batch approval workflows
- 🎯 **Batch Processing** - User-controlled approval mode with selective execution
- 🏷️ **File Organization** - Advanced tagging and metadata system
- 🎨 **Design System** - Integrated design tokens with Figma synchronization

## 🚀 Quick Start

### Prerequisites

- Node.js ≥18
- Redis server

### Installation

```bash
# Install dependencies
npm install

# Start Redis (using Docker)
docker run -d -p 6379:6379 redis:alpine

# Start Convex in a separate terminal
npx convex dev &

# Setup environment
cp scripts/env.example .env
# Edit .env with your configuration (OPENAI_API_KEY, CONVEX_URL, etc.)
# Use the URL output from `npx convex dev` for CONVEX_URL

# Initialize the system
npm run setup

# Start the full system
npm run dev
```

### Access Points

- **Web Interface**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api/\*
- **Files**: Drop files into `./dropbox` folder

## 🏗️ Modern Architecture

### Core Components

- **🌐 Nuxt 3 Web App** - Modern Vue.js interface with server-side rendering
- **📊 Real-time Dashboard** - WebSocket-powered queue monitoring and controls
- **⚙️ Processor Management** - Database-driven configuration with web UI
- **📁 File Watcher** (`chokidar`) - Intelligent filesystem monitoring
- **🗄️ Database Layer** (Convex) - Graph-based node and edge storage
- **⚡ Queue System** (`bullmq` + Redis) - Reliable job processing
- **🎨 Design System** - Style Dictionary + Figma token synchronization

### Processing Flow

```
Input File → File Watcher → Database Catalog → Processor Selection →
Job Queue → Processor Execution → Output File
     ↑                                                    ↓
     └── Auto-healing re-queue if output deleted ←←←←←←←←←←
```

### Web Interface Pages

- **📊 Dashboard** (`/`) - Queue status, job monitoring, cost controls
- **📁 Files & Tags** (`/files`) - File management, tagging, metadata
- **⚙️ Processor Config** (`/processors`) - Processor configuration management
- **✅ Approval Queue** (`/approval`) - Batch approval and cost visualization

## 🔧 Unified Command System

All operations use the centralized script runner:

```bash
# System Management
npm run dev              # Start full development system
npm run build           # Build all components
npm run start           # Production mode

# Maintenance & Setup
npm run setup           # Initial system setup
npm run test-services   # Validate service connections
npm run clean          # Clean temporary files

# Design System
npm run tokens:build    # Build design tokens
npm run tokens:extract  # Extract tokens from components
npm run tokens:sync    # Sync tokens with Figma

# Legacy CLI (still available)
npm run cli status     # Queue status via CLI
npm run cli pause      # Pause processing
npm run cli resume     # Resume processing
```

## 🎯 Creating Processors

Processors are TypeScript files in `src/processors/` that export a `processor` object:

```typescript
// src/processors/my-processor.ts
import type { Processor } from "../types.js";

export const processor: Processor = {
  name: "my-processor",
  input: [".txt", ".md"], // File extensions to process
  outputExt: ".processed.txt", // Output file extension
  dependsOn: ["other-processor"], // Dependencies (optional)

  async run(inputPath: string): Promise<string> {
    // Your processing logic here
    const outputPath = inputPath + ".processed.txt";
    // ... do work ...
    return outputPath;
  },
};
```

### Built-in Processors

#### `transcribe`

- **Input**: Audio/video files (`.m4a`, `.wav`, `.mp3`, `.mp4`, `.mov`)
- **Output**: `.transcript.txt`
- **Technology**: OpenAI Whisper-1 API with intelligent chunking for large files
- **Features**: Multi-stream audio handling, automatic cleanup, cost calculation

#### `summarize`

- **Input**: `.transcript.txt`
- **Output**: `.summary.txt`
- **Dependencies**: `transcribe`
- **Technology**: OpenAI GPT-4 Turbo with customizable prompts
- **Features**: Professional summarization, cost tracking, configurable templates

### Processor Configuration

The system uses a hybrid approach:

1. **Processor Implementations** - TypeScript files containing the actual processing logic
2. **Database Configurations** - Control when and how processors run
3. **Web Interface** - Manage configurations through the browser

Create configurations via the web interface at `/processors` or programmatically:

```typescript
// Database-driven processor configuration
const config = {
  name: "auto-summarize-transcripts",
  processorImplementation: "summarize",
  displayName: "Auto Summarize Transcripts",
  inputExtensions: [".transcript.txt"],
  inputTags: [], // Optional tag requirements
  outputExt: ".summary.txt",
  dependsOn: ["transcribe"],
  allowUserSelection: false, // Auto-run vs manual selection
  allowDerivedFiles: true, // Can process generated files
  config: { promptPath: "prompts/summarize.md" },
};
```

## 💰 Cost Management & Batch Processing

### Queue Modes

- **Auto Mode** (default) - Automatic processing when files are detected
- **Approval Mode** - User-controlled batch approval with cost preview

### Cost Features

- **Real-time Calculation** - Accurate cost estimation for OpenAI services
- **Batch Visualization** - Preview total costs before processing
- **Historical Tracking** - Complete cost history and analysis
- **Budget Controls** - Pause queue when high-cost jobs are waiting

### Batch Workflow

1. Switch to approval mode via web interface
2. Drop files into watched folder
3. System catalogs files and predicts processing chains
4. Review predicted costs and select desired processing steps
5. Create and execute approval batches
6. Monitor progress with real-time updates

## 🏷️ Advanced File Organization

### File Tagging System

- **Automatic Tagging** - Files auto-tagged based on patterns (`.transcript.` → `transcript` tag)
- **Manual Tagging** - Add custom tags via web interface
- **Tag-based Processing** - Processors can require specific tags
- **Metadata Storage** - Rich metadata with typed values

### Processing Examples

```typescript
// Extension-based processing
".mp3" files → transcribe processor

// Tag-based processing
files with "meeting" tag → specialized meeting processor

// Hybrid approach
".txt" files with "transcript" tag → summarize processor
```

## 🎨 Design System Integration

### Token-based Styling

The system includes a complete design system with Figma synchronization:

```vue
<template>
  <div class="status-card">
    <h3>System Status</h3>
    <span class="status-badge">Connected</span>
  </div>
</template>

<style scoped>
.status-card {
  background: var(--color-background-card);
  padding: var(--size-spacing-lg);
  border-radius: var(--size-border-radius-lg);
  box-shadow: var(--shadow-sm);
}

.status-badge {
  background: var(--color-status-success);
  color: white;
  padding: var(--size-spacing-xs) var(--size-spacing-sm);
  border-radius: var(--size-border-radius-pill);
}
</style>
```

### Design Token Workflow

1. Update tokens in `src/design-system/tokens.json`
2. Run `npm run tokens:build` to generate CSS variables
3. Sync with Figma using `npm run tokens:sync`
4. Perfect design-code consistency

## 🗄️ Database Schema

### Core Tables

- **files** - File metadata with path, hash, and classification
- **processor_configs** - Database-driven processor configurations
- **file_tags** - Flexible tagging system with optional values
- **file_metadata** - Typed metadata storage
- **approval_batches** - User approval sessions with cost tracking
- **predicted_jobs** - Processing chain predictions with cost estimates

### Self-Healing Features

- **Deletion Recovery** - Automatically re-queues jobs when outputs are deleted
- **Dependency Tracking** - Smart re-processing when intermediate files change
- **Orphaned Job Cleanup** - Removes stale jobs on system restart

## 🚀 Production Deployment

### Redis Setup

```bash
# Production Redis with persistence
docker run -d \
  --name voice-worker-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:alpine redis-server --appendonly yes
```

### Environment Configuration

```bash
# Copy and edit environment file
cp scripts/env.example .env

# Required environment variables
OPENAI_API_KEY=your_openai_api_key
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

### Process Management

```bash
# Build for production
npm run build

# Start with PM2
npm install -g pm2
pm2 start npm --name "voice-worker" -- start
pm2 startup
pm2 save
```

## 🔧 Development

### Development Setup

```bash
# Development with hot reload
npm run dev

# Run individual components
cd src/nuxt-web && npm run dev  # Web interface only
npm run cli status              # CLI tools
npm run test-services          # Test service connections
```

### Adding Features

1. **New Processors** - Add TypeScript files to `src/processors/`
2. **Web Interface** - Edit Vue components in `src/nuxt-web/`
3. **API Endpoints** - Add Nitro endpoints in `src/nuxt-web/server/api/`
4. **Database Changes** - Extend schema in `src/db/client.ts`

## 📊 Monitoring & Debugging

### Web Interface Monitoring

- Real-time job queue status via WebSocket
- Interactive cost summaries and trends
- Failed job management with retry controls
- File organization and tagging interface

### CLI Monitoring

```bash
npm run cli status     # Queue statistics
npm run cli jobs       # List active jobs
npm run cli failures   # View failed jobs
npm run test-services  # Health check all services
```

### Logs & Debugging

- **Console Logs** - Structured logging with processing details
- **WebSocket Updates** - Real-time status broadcasts
- **Error Tracking** - Comprehensive error capture and display
- **Cost Analytics** - Detailed cost breakdowns and trends

## 🔄 Upgrade Notes

This system represents a consolidation of previous architectures:

- **Eliminated** - Redundant Express server (now Nuxt-only)
- **Unified** - All scripts under centralized `npm run` commands
- **Modernized** - Parser → Processor terminology consistency
- **Enhanced** - Database-driven configuration vs hardcoded settings
- **Improved** - Modern web interface vs CLI-only management

## 📚 Documentation

- **Setup Guide** - `src/design-system/SETUP.md`
- **Figma Integration** - `src/design-system/FIGMA_INTEGRATION.md`
- **API Reference** - Auto-generated from Nuxt server routes
- **Architecture Notes** - `AGENT_MEMORY.md` (development documentation)
- **Database Schema** - `docs/DATABASE_SCHEMA.md`

## 🆘 Troubleshooting

### Common Issues

**Redis Connection Failed**

```bash
# Check Redis is running
docker ps | grep redis
# Restart if needed
docker restart voice-worker-redis
```

**OpenAI API Errors**

```bash
# Verify API key in .env
cat .env | grep OPENAI_API_KEY
# Test connection
npm run test-services
```

**Web Interface Not Loading**

```bash
# Check Nuxt development server
cd src/nuxt-web && npm run dev
# Check port 3000 is available
```

### Service Health Check

```bash
# Comprehensive service validation
npm run test-services

# Individual component checks
npm run cli status      # Queue system
curl localhost:3000     # Web interface
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit pull request

## 📄 License

MIT

---

**Modern TypeScript • Real-time Web Interface • Intelligent Processing • Cost-Aware Automation**
