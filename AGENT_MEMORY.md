# Project: Voice Worker

## System Description

This is a streamlined macOS desktop application built with Wails.io (Go backend, Vue.js frontend) that provides two main modes for audio transcription: **manual recording** and **folder monitoring**.

### Backend (Go)

- **`AudioService`**: Manages audio operations using the PortAudio library. It can list input devices, and start/stop recording from a specific device. It records 16-bit audio and buffers it until recording stops, then encodes it into WAV format for transcription. Now includes recording duration tracking for cost calculation.
- **`TranscriptionService`**: Sends audio data to the OpenAI Whisper API for transcription. It accepts audio buffers and retrieves the API key from a `.env` file at the project root.
- **`FileService`**: Saves the received transcript text to a `.txt` file in a `transcripts` directory. Returns the filename for cost tracking purposes.
- **`CostTrackingService`**: Tracks transcription costs based on OpenAI Whisper API pricing ($0.006/minute, rounded to nearest second). Persists cost data to `cost_data.json` with session tracking, daily totals, and historical data.
- **`FolderMonitorService`**: NEW - Monitors a selected folder for audio files, provides cost estimation for batch processing, and manages a processing queue. Uses `fsnotify` for real-time file system monitoring. Supports multiple audio formats (.wav, .mp3, .m4a, .aac, .flac, .ogg).
- **Lifecycle**: The services are initialized on startup. Recording is manually controlled from the UI with start/stop buttons. Transcription happens after recording stops (not during). Events communicate status, new transcripts, cost updates, and folder monitoring updates from backend to frontend.

### Frontend (Vue.js)

The interface now features **tab-based navigation** with two main modes:

#### 🎤 Record Tab (Original Functionality)

- Clean, simple user interface to control recording
- Displays the current application status with color-coded badges
- A dropdown menu lists all available microphones and allows the user to select one for recording
- "Start Recording" and "Stop Recording" buttons control the recording process
- Displays the most recently received transcript

#### 📁 Monitor Folder Tab (NEW)

- **Folder Selection**: Native folder picker dialog for selecting a dropzone folder
- **Cost Preview**: Real-time estimation showing file count, estimated duration, and cost before processing
- **File Discovery**: Automatic scanning of folder for supported audio formats
- **Processing Queue**: Visual queue management showing file status (pending, queued, processing, completed, failed)
- **Monitoring Controls**: Real-time folder monitoring with start/stop controls
- **Batch Processing**: "Process All Files" with user confirmation dialog showing estimated costs
- **Queue Management**: Individual file removal and bulk "clear completed" operations

#### 💰 Cost Monitor (Shared)

- Real-time cost tracking display showing session cost, today's cost, total cost, and usage statistics
- Updates automatically after each transcription from both recording and folder monitoring modes
- Session reset functionality

### Key Features Added

#### Folder Monitoring Workflow

1. **Folder Selection**: User browses and selects a folder to monitor
2. **File Discovery**: App scans for audio files and estimates costs upfront
3. **Cost Transparency**: User sees exact cost estimate before any processing
4. **Batch Processing**: User confirms processing with cost awareness
5. **Real-time Monitoring**: New files added to folder are automatically detected
6. **Queue Management**: Visual feedback on processing status with individual file control

#### Cost-First Design

- **Pre-flight Estimation**: All costs calculated and shown before processing
- **User Confirmation**: Explicit confirmation required for batch processing
- **Real-time Updates**: Cost tracking works seamlessly across both modes
- **No Surprise Billing**: Users always know costs upfront

#### Technical Implementation

- **File System Monitoring**: Uses `fsnotify` for real-time folder watching
- **Audio Format Support**: Handles WAV, MP3, M4A, AAC, FLAC, OGG files
- **Duration Estimation**: Estimates audio duration from file size and format
- **Concurrent Processing**: Asynchronous file processing with queue management
- **Event-Driven UI**: Real-time updates via WebSocket-like events between Go and Vue

## Key Design Decisions

- **Cost-Effective**: Transcription only happens after recording stops or with explicit user approval for batch processing
- **Cost Transparent**: Users always see estimated costs before any processing occurs
- **Simple UX**: Clean tab-based interface without complex configuration
- **Efficient**: No background processing without user consent - only processes when explicitly requested
- **Flexible**: Supports both real-time recording and bulk processing workflows
- **User Control**: Users can pause, resume, and manage processing queues with full visibility

## Architecture

The application maintains a clean separation between the two modes while sharing core services (transcription, file handling, cost tracking). The folder monitoring feature integrates seamlessly with existing cost tracking and doesn't interfere with the manual recording workflow.

## Original Brief:

<brief> I feel like there's always a hurdle to jump over to start recording these. And I think the fact that it requires editing is what stops me from proceeding. So, I really want to build this transcript mechanism that can take what I'm saying right now immediately and act upon it. And ideally, I could just stream it. So it's maybe just a buffer of recording, but I can talk directly into the computer at any time and it will create some impact upon the world. Maybe that's the input device, right? That has to be point of connection number one. So, how would we go about building that to be as efficient as possible? To go from a streaming input is receiving events. I'm going to then take that and run a function of my choosing or from the available list, something like that. And then yeah, the streaming event of the user input process. So there needs to be like a continuous process running that processes the stream and when it hits a sort of start word, it starts to stream to a actual function that does stuff. That's what we need to build. I'm going to stop recording and ask you to build that right now.

I think one important piece of this is that the transcription itself might not be real time. We don't have to promise to show the text asap, that's not what we're building. We should basically just record in batches and then transcribe those. And then that text gets fed into the file system so other apps that are watching that file system can react to the transcripts. So this piece is just the mechanism that records these voice memos and gets to work.

This is certainly a macOS desktop app we're building, so let's stick to code you're good at and use wails.io so we can have our system/server in Go and our frontend in Vue.
</brief>
