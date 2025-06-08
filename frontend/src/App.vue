<script setup>
import { ref, onMounted } from "vue";
import { EventsOn } from "../wailsjs/runtime";
import {
  GetDefaultInputDevice,
  GetInputDevices,
  StartRecording,
  StopRecording,
  GetCostSummary,
  ResetSessionCost,
  SelectFolderToMonitor,
  ScanMonitoredFolder,
  StartFolderMonitoring,
  StopFolderMonitoring,
  ProcessAllFolderFiles,
  GetSelectedFolder,
  GetFolderFiles,
  GetProcessingQueue,
  IsMonitoringFolder,
} from "../wailsjs/go/main/App";

const status = ref("Idle");
const lastTranscript = ref("");
const devices = ref([]);
const selectedDevice = ref("");
const isRecording = ref(false);

// Tab navigation
const activeTab = ref("record");

// Folder monitoring state
const selectedFolder = ref("");
const isMonitoring = ref(false);
const folderFiles = ref([]);
const estimatedCost = ref(0);
const estimatedDuration = ref(0);
const processingQueue = ref([]);

// Cost tracking state
const costSummary = ref({
  session_cost: 0,
  session_start: "00:00:00",
  today_cost: 0,
  total_cost: 0,
  total_duration_min: 0,
  total_transcripts: 0,
  cost_per_minute: 0.006,
  last_updated: "00:00:00",
});

onMounted(() => {
  GetInputDevices()
    .then((deviceList) => {
      devices.value = deviceList;
    })
    .catch((err) => {
      status.value = `Error: ${err}`;
    });

  GetDefaultInputDevice()
    .then((device) => {
      selectedDevice.value = device;
    })
    .catch((err) => {
      status.value = `Error: ${err}`;
    });

  // Load initial cost summary
  loadCostSummary();

  EventsOn("statusUpdate", (newStatus) => {
    status.value = newStatus;
    if (newStatus === "Recording...") {
      isRecording.value = true;
    } else {
      isRecording.value = false;
    }
  });

  EventsOn("newTranscript", (transcript) => {
    lastTranscript.value = transcript;
  });

  EventsOn("costUpdate", (newCostSummary) => {
    costSummary.value = newCostSummary;
  });

  // TODO: Add folder monitoring event listeners
  EventsOn("folderFilesUpdate", (files) => {
    folderFiles.value = files;
    calculateEstimates();
  });

  EventsOn("processingQueueUpdate", (queue) => {
    processingQueue.value = queue;
  });

  EventsOn("costEstimateUpdate", (estimate) => {
    estimatedCost.value = estimate.cost;
    estimatedDuration.value = estimate.duration;
  });
});

function startRecording() {
  if (!selectedDevice.value) {
    status.value = "Error: Please select a device";
    return;
  }
  StartRecording(selectedDevice.value);
}

function stopRecording() {
  StopRecording();
}

function loadCostSummary() {
  GetCostSummary()
    .then((summary) => {
      costSummary.value = summary;
    })
    .catch((err) => {
      console.error("Error loading cost summary:", err);
    });
}

function resetSession() {
  ResetSessionCost();
  loadCostSummary();
}

// Folder monitoring functions
function selectFolder() {
  SelectFolderToMonitor()
    .then((folderPath) => {
      selectedFolder.value = folderPath;
      // Files will be updated via event listener
    })
    .catch((err) => {
      console.error("Error selecting folder:", err);
      status.value = `Error: ${err}`;
    });
}

function scanFolder() {
  if (!selectedFolder.value) return;

  ScanMonitoredFolder()
    .then(() => {
      // Files will be updated via event listener
    })
    .catch((err) => {
      console.error("Error scanning folder:", err);
      status.value = `Error: ${err}`;
    });
}

function calculateEstimates() {
  const totalDuration = folderFiles.value.reduce(
    (sum, file) => sum + (file.duration || 0),
    0
  );
  estimatedDuration.value = totalDuration / 60; // Convert to minutes
  estimatedCost.value =
    estimatedDuration.value * costSummary.value.cost_per_minute;
}

function startMonitoring() {
  if (!selectedFolder.value) {
    alert("Please select a folder first");
    return;
  }

  StartFolderMonitoring()
    .then(() => {
      isMonitoring.value = true;
    })
    .catch((err) => {
      console.error("Error starting monitoring:", err);
      isMonitoring.value = false;
      alert(`Error starting monitoring: ${err}`);
    });
}

function stopMonitoring() {
  StopFolderMonitoring()
    .then(() => {
      isMonitoring.value = false;
    })
    .catch((err) => {
      console.error("Error stopping monitoring:", err);
      alert(`Error stopping monitoring: ${err}`);
    });
}

function processAllFiles() {
  if (folderFiles.value.length === 0) {
    alert("No files to process");
    return;
  }

  const confirmed = confirm(
    `Process ${folderFiles.value.length} files for approximately $${estimatedCost.value.toFixed(4)}?`
  );
  if (confirmed) {
    ProcessAllFolderFiles()
      .then(() => {
        // Queue will be updated via event listener
      })
      .catch((err) => {
        console.error("Error processing files:", err);
        alert(`Error processing files: ${err}`);
      });
  }
}

function removeFromQueue(fileName) {
  processingQueue.value = processingQueue.value.filter(
    (file) => file.name !== fileName
  );
}

function clearCompleted() {
  processingQueue.value = processingQueue.value.filter(
    (file) => file.status !== "completed" && file.status !== "failed"
  );
}

function getStatusIcon(status) {
  switch (status) {
    case "pending":
      return "⏳";
    case "queued":
      return "📝";
    case "processing":
      return "🔄";
    case "completed":
      return "✅";
    case "failed":
      return "❌";
    default:
      return "⏳";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "pending":
      return "#a4a4a4";
    case "queued":
      return "#4a90e2";
    case "processing":
      return "#50e3c2";
    case "completed":
      return "#50e3c2";
    case "failed":
      return "#e35050";
    default:
      return "#a4a4a4";
  }
}
</script>

<template>
  <div class="container">
    <div class="card">
      <div class="card-header">
        <h1>Voice Worker</h1>
        <p>Simple voice recording with automatic transcription.</p>

        <!-- Tab Navigation -->
        <div class="tab-nav">
          <button
            :class="{ active: activeTab === 'record' }"
            @click="activeTab = 'record'"
            class="tab-button"
          >
            🎤 Record
          </button>
          <button
            :class="{ active: activeTab === 'monitor' }"
            @click="activeTab = 'monitor'"
            class="tab-button"
          >
            📁 Monitor Folder
          </button>
        </div>
      </div>

      <div class="card-body">
        <!-- Recording Tab -->
        <div v-if="activeTab === 'record'" class="tab-content">
          <div class="status-grid">
            <div><strong>Status:</strong></div>
            <div>
              <span
                class="status-badge"
                :class="status.toLowerCase().split(' ')[0]"
                >{{ status }}</span
              >
            </div>

            <div><strong>Audio Device:</strong></div>
            <div>
              <select v-model="selectedDevice" :disabled="isRecording">
                <option disabled value="">Please select a device</option>
                <option v-for="device in devices" :key="device" :value="device">
                  {{ device }}
                </option>
              </select>
            </div>
          </div>

          <div class="controls">
            <button
              @click="startRecording"
              :disabled="isRecording || !selectedDevice"
              class="start-btn"
            >
              Start Recording
            </button>
            <button
              @click="stopRecording"
              :disabled="!isRecording"
              class="stop-btn"
            >
              Stop Recording
            </button>
          </div>

          <div class="transcript-section">
            <h2>Last Transcript</h2>
            <div class="transcript-box">
              <p>{{ lastTranscript || "..." }}</p>
            </div>
          </div>
        </div>

        <!-- Folder Monitoring Tab -->
        <div v-if="activeTab === 'monitor'" class="tab-content">
          <!-- Folder Selection -->
          <div class="folder-section">
            <h2>📁 Select Folder to Monitor</h2>
            <div class="folder-selector">
              <button @click="selectFolder" class="browse-btn">
                Browse Folder...
              </button>
              <div v-if="selectedFolder" class="selected-folder">
                {{ selectedFolder }}
              </div>
            </div>

            <div v-if="selectedFolder" class="monitor-controls">
              <label class="monitor-checkbox">
                <input
                  type="checkbox"
                  v-model="isMonitoring"
                  @change="isMonitoring ? startMonitoring() : stopMonitoring()"
                />
                Monitor this folder for new audio files
              </label>
            </div>
          </div>

          <!-- Cost Preview -->
          <div v-if="folderFiles.length > 0" class="cost-preview">
            <h2>💰 Cost Estimation</h2>
            <div class="estimation-grid">
              <div class="estimation-item">
                <div class="estimation-label">Files Found</div>
                <div class="estimation-value">
                  {{ folderFiles.length }} audio files
                </div>
              </div>
              <div class="estimation-item">
                <div class="estimation-label">Estimated Duration</div>
                <div class="estimation-value">
                  ~{{ estimatedDuration.toFixed(1) }} minutes
                </div>
              </div>
              <div class="estimation-item">
                <div class="estimation-label">Estimated Cost</div>
                <div class="estimation-value">
                  ${{ estimatedCost.toFixed(4) }}
                </div>
              </div>
            </div>

            <div class="preview-controls">
              <button @click="scanFolder" class="scan-btn">
                🔄 Rescan Folder
              </button>
              <button
                @click="processAllFiles"
                class="process-btn"
                :disabled="folderFiles.length === 0"
              >
                ⚠️ Process All Files
              </button>
            </div>
          </div>

          <!-- Processing Queue -->
          <div v-if="processingQueue.length > 0" class="queue-section">
            <h2>📋 Processing Queue</h2>
            <div class="queue-list">
              <div
                v-for="file in processingQueue"
                :key="file.name"
                class="queue-item"
                :style="{
                  borderLeft: `4px solid ${getStatusColor(file.status)}`,
                }"
              >
                <div class="queue-item-info">
                  <span class="queue-status">{{
                    getStatusIcon(file.status)
                  }}</span>
                  <span class="queue-filename">{{ file.name }}</span>
                  <span class="queue-size">({{ file.size }})</span>
                </div>
                <div class="queue-item-status">
                  <span :style="{ color: getStatusColor(file.status) }">
                    {{
                      file.status.charAt(0).toUpperCase() + file.status.slice(1)
                    }}
                  </span>
                  <button
                    v-if="file.status === 'pending' || file.status === 'failed'"
                    @click="removeFromQueue(file.name)"
                    class="remove-btn"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>

            <div class="queue-controls">
              <button
                @click="stopMonitoring"
                :disabled="!isMonitoring"
                class="pause-btn"
              >
                ⏸️ Pause Processing
              </button>
              <button @click="clearCompleted" class="clear-btn">
                🗑️ Clear Completed
              </button>
            </div>
          </div>
        </div>

        <!-- Cost Monitor Section (shared between tabs) -->
        <div class="cost-section">
          <h2>💰 Cost Monitor</h2>
          <div class="cost-grid">
            <div class="cost-item">
              <div class="cost-label">Session Cost</div>
              <div class="cost-value cost-session">
                ${{ costSummary.session_cost.toFixed(4) }}
              </div>
              <div class="cost-subtitle">
                Since {{ costSummary.session_start }}
              </div>
            </div>

            <div class="cost-item">
              <div class="cost-label">Today's Cost</div>
              <div class="cost-value cost-today">
                ${{ costSummary.today_cost.toFixed(4) }}
              </div>
            </div>

            <div class="cost-item">
              <div class="cost-label">Total Cost</div>
              <div class="cost-value cost-total">
                ${{ costSummary.total_cost.toFixed(4) }}
              </div>
              <div class="cost-subtitle">
                {{ costSummary.total_transcripts }} transcripts
              </div>
            </div>

            <div class="cost-item">
              <div class="cost-label">Total Duration</div>
              <div class="cost-value">
                {{ costSummary.total_duration_min.toFixed(1) }}m
              </div>
            </div>
          </div>

          <div class="cost-controls">
            <button @click="resetSession" class="reset-btn">
              Reset Session
            </button>
            <div class="cost-info">
              ${{ costSummary.cost_per_minute.toFixed(4) }}/min • Updated
              {{ costSummary.last_updated }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
:root {
  --background-color: #1b2636;
  --card-background: #253347;
  --text-color: #e0e0e0;
  --primary-color: #4a90e2;
  --success-color: #50e3c2;
  --error-color: #e35050;
  --idle-color: #a4a4a4;
  --warning-color: #ffa500;
  --font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial,
    sans-serif;
}

body {
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--font-family);
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px 0;
}

.container {
  width: 90%;
  max-width: 700px;
}

.card {
  background: var(--card-background);
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.card-header {
  padding: 24px;
  border-bottom: 1px solid #3a4a60;
}

.card-header h1 {
  margin: 0 0 8px 0;
  font-size: 24px;
}

.card-header p {
  margin: 0 0 20px 0;
  color: #a0b0c0;
}

/* Tab Navigation Styles */
.tab-nav {
  display: flex;
  gap: 8px;
}

.tab-button {
  background-color: transparent;
  color: #a0b0c0;
  border: 1px solid #3a4a60;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.tab-button:hover {
  background-color: #3a4a60;
  color: var(--text-color);
}

.tab-button.active {
  background-color: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.card-body {
  padding: 24px;
}

.tab-content {
  min-height: 300px;
}

.status-grid {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-weight: bold;
  color: #fff;
  text-transform: capitalize;
}
.status-badge.recording {
  background-color: var(--primary-color);
}
.status-badge.transcribing {
  background-color: var(--success-color);
}
.status-badge.idle {
  background-color: var(--idle-color);
}
.status-badge.error {
  background-color: var(--error-color);
}

.controls {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  justify-content: center;
}

.controls button {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 16px 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 140px;
}

.controls button:hover:not(:disabled) {
  background-color: #5a9ee5;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.3);
}

.controls button:disabled {
  background-color: #555;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.start-btn:not(:disabled) {
  background-color: var(--success-color);
}

.start-btn:hover:not(:disabled) {
  background-color: #45d4b8;
}

.stop-btn:not(:disabled) {
  background-color: var(--error-color);
}

.stop-btn:hover:not(:disabled) {
  background-color: #e84545;
}

.transcript-section {
  margin-top: 24px;
}

.transcript-box {
  background: var(--background-color);
  border: 1px solid #3a4a60;
  border-radius: 5px;
  padding: 16px;
  min-height: 100px;
  color: #c0d0e0;
}

.transcript-box p {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.status-grid select {
  width: 100%;
  padding: 8px;
  background-color: var(--background-color);
  color: var(--text-color);
  border: 1px solid #3a4a60;
  border-radius: 5px;
  font-family: var(--font-family);
}

/* Folder Monitoring Styles */
.folder-section {
  margin-bottom: 24px;
}

.folder-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.folder-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.browse-btn {
  background-color: var(--primary-color);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  align-self: flex-start;
}

.browse-btn:hover {
  background-color: #5a9ee5;
  transform: translateY(-1px);
}

.selected-folder {
  padding: 8px 12px;
  background: var(--background-color);
  border: 1px solid #3a4a60;
  border-radius: 5px;
  color: #c0d0e0;
  font-family: monospace;
  font-size: 13px;
}

.monitor-controls {
  margin-top: 16px;
}

.monitor-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-color);
  cursor: pointer;
}

.monitor-checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

/* Cost Preview Styles */
.cost-preview {
  margin-bottom: 24px;
  padding: 20px;
  background: var(--background-color);
  border: 1px solid #3a4a60;
  border-radius: 8px;
}

.cost-preview h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.estimation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.estimation-item {
  text-align: center;
  padding: 12px;
  background: var(--card-background);
  border-radius: 6px;
  border: 1px solid #3a4a60;
}

.estimation-label {
  font-size: 12px;
  color: #a0b0c0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.estimation-value {
  font-size: 16px;
  font-weight: bold;
  color: var(--text-color);
}

.preview-controls {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #3a4a60;
}

.scan-btn {
  background-color: #555;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.scan-btn:hover {
  background-color: #666;
}

.process-btn {
  background-color: var(--warning-color);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.process-btn:hover:not(:disabled) {
  background-color: #ff8c00;
}

.process-btn:disabled {
  background-color: #555;
  cursor: not-allowed;
}

/* Processing Queue Styles */
.queue-section {
  margin-bottom: 24px;
}

.queue-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.queue-list {
  background: var(--background-color);
  border: 1px solid #3a4a60;
  border-radius: 6px;
  overflow: hidden;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #3a4a60;
}

.queue-item:last-child {
  border-bottom: none;
}

.queue-item-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.queue-status {
  font-size: 16px;
}

.queue-filename {
  font-weight: 600;
  color: var(--text-color);
}

.queue-size {
  color: #a0b0c0;
  font-size: 12px;
}

.queue-item-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.remove-btn:hover {
  background-color: #3a4a60;
}

.queue-controls {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.pause-btn,
.clear-btn {
  background-color: #555;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.pause-btn:hover:not(:disabled),
.clear-btn:hover {
  background-color: #666;
}

.pause-btn:disabled {
  background-color: #333;
  cursor: not-allowed;
}

/* Cost Monitor Styles */
.cost-section {
  margin: 24px 0;
  padding: 20px;
  background: var(--background-color);
  border: 1px solid #3a4a60;
  border-radius: 8px;
}

.cost-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--text-color);
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.cost-item {
  text-align: center;
  padding: 12px;
  background: var(--card-background);
  border-radius: 6px;
  border: 1px solid #3a4a60;
}

.cost-label {
  font-size: 12px;
  color: #a0b0c0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.cost-value {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-color);
  margin-bottom: 2px;
}

.cost-session {
  color: var(--primary-color);
}

.cost-today {
  color: var(--success-color);
}

.cost-total {
  color: #ffa500;
}

.cost-subtitle {
  font-size: 10px;
  color: #888;
}

.cost-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #3a4a60;
}

.reset-btn {
  background-color: #555;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.2s;
}

.reset-btn:hover {
  background-color: #666;
  transform: translateY(-1px);
}

.cost-info {
  font-size: 11px;
  color: #888;
}
</style>
