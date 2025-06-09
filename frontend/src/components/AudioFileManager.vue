<template>
  <div class="audio-file-manager">
    <!-- Folder Selection Section -->
    <div class="section">
      <h3>📁 Folder Management</h3>

      <div class="folder-selection">
        <button @click="selectNewFolder" class="browse-btn">
          Browse Folder...
        </button>

        <div v-if="folders === undefined" class="loading">
          Loading folders...
        </div>
        <div v-else-if="folders && folders.length > 0" class="folder-list">
          <div
            v-for="folder in folders"
            :key="folder._id"
            class="folder-item"
            :class="{ selected: selectedFolderId === folder._id }"
            @click="selectFolder(folder._id)"
          >
            <div class="folder-info">
              <span class="folder-icon">📁</span>
              <div class="folder-details">
                <div class="folder-name">{{ folder.name }}</div>
                <div class="folder-path">{{ folder.path }}</div>
              </div>
            </div>
            <div class="folder-controls">
              <span :class="['status', { active: folder.isMonitoring }]">
                {{ folder.isMonitoring ? "Monitoring" : "Stopped" }}
              </span>
              <button
                @click.stop="toggleMonitoring(folder._id, !folder.isMonitoring)"
                class="toggle-btn"
                :class="{ active: folder.isMonitoring }"
              >
                {{ folder.isMonitoring ? "Stop" : "Start" }}
              </button>
              <button @click.stop="removeFolder(folder._id)" class="danger">
                Remove
              </button>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          No folders configured. Browse to add your first folder.
        </div>
      </div>
    </div>

    <!-- Files Section -->
    <div class="section" v-if="selectedFolder">
      <h3>📄 Files in {{ selectedFolder.name }}</h3>

      <div class="file-actions">
        <button
          @click="processAllFiles"
          :disabled="!pendingFiles.length"
          class="process-btn"
        >
          ⚠️ Process All Files ({{ pendingFiles.length }})
        </button>
      </div>

      <!-- Cost Estimate -->
      <div v-if="costEstimate" class="cost-estimate">
        <h4>💰 Cost Estimate</h4>
        <div class="cost-grid">
          <div class="cost-item">
            <span>Files: {{ costEstimate.fileCount }}</span>
          </div>
          <div class="cost-item">
            <span
              >Duration: {{ formatDuration(costEstimate.totalDuration) }}</span
            >
          </div>
          <div class="cost-item">
            <span
              >Estimated Cost: ${{
                (costEstimate.estimatedCost || 0).toFixed(4)
              }}</span
            >
          </div>
        </div>
      </div>

      <!-- File List -->
      <div v-if="files === undefined" class="loading">Loading files...</div>
      <div v-else-if="files && files.length > 0" class="file-list">
        <div v-for="file in files" :key="file._id" class="file-item">
          <div class="file-info">
            <span class="file-icon">📄</span>
            <div class="file-details">
              <div class="file-name">{{ file.name }}</div>
              <div class="file-meta">
                {{ formatFileSize(file.sizeBytes) }} •
                {{ formatDuration(file.estimatedDuration) }}
              </div>
              <div v-if="file.chunkStatus" class="chunk-progress-bar">
                <progress
                  :value="file.chunkStatus.progress"
                  max="100"
                ></progress>
                <span
                  >{{ file.chunkStatus.completed }} /
                  {{ file.chunkStatus.total }} chunks</span
                >
              </div>
            </div>
          </div>
          <div class="file-controls">
            <span :class="['status', file.status]">{{ file.status }}</span>
            <span
              v-if="file.needsChunking && !file.chunkStatus"
              class="chunk-indicator"
            >
              🔄 Needs Chunking
            </span>
            <button
              @click="processFile(file._id)"
              :disabled="file.status !== 'pending' && file.status !== 'failed'"
              class="process-file-btn"
            >
              Queue Job
            </button>
            <button @click="removeFile(file._id)" class="danger">Remove</button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">
        No files found. Use "Rescan Folder" to discover audio files.
      </div>
    </div>

    <!-- Job Queue Section -->
    <div class="section">
      <h3>⚙️ Processing Queue</h3>

      <div v-if="queueStats" class="queue-stats">
        <span class="stat-item">Total: {{ queueStats.total }}</span>
        <span class="stat-item">Queued: {{ queueStats.queued }}</span>
        <span class="stat-item">Processing: {{ queueStats.processing }}</span>
        <span class="stat-item">Completed: {{ queueStats.completed }}</span>
        <span class="stat-item">Failed: {{ queueStats.failed }}</span>
      </div>

      <div v-if="activeJobsWithFiles === undefined" class="loading">
        Loading jobs...
      </div>
      <div
        v-else-if="activeJobsWithFiles && activeJobsWithFiles.length > 0"
        class="job-list"
      >
        <div v-for="job in activeJobsWithFiles" :key="job._id" class="job-item">
          <div class="job-info">
            <span class="job-icon">⚙️</span>
            <div class="job-details">
              <div class="job-file-name">{{ job.fileName }}</div>
              <div class="job-type">{{ job.jobType }}</div>
              <div class="job-progress">
                <progress :value="job.progress" max="100">
                  {{ job.progress }}%
                </progress>
                <span class="progress-text">{{ job.progress }}%</span>
              </div>
              <div v-if="job.errorMessage" class="error-message">
                Error: {{ job.errorMessage }}
              </div>
            </div>
          </div>
          <div class="job-controls">
            <span :class="['status', job.status]">{{ job.status }}</span>
            <span class="priority">P{{ job.priority }}</span>
            <button
              v-if="job.status === 'failed'"
              @click="retryJob(job._id)"
              class="retry-btn"
            >
              Retry
            </button>
            <button
              v-if="job.status === 'queued' || job.status === 'processing'"
              @click="cancelJob(job._id)"
              class="danger"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      <div v-else class="empty-state">No active jobs in the queue.</div>

      <div class="queue-controls">
        <button @click="clearCompletedJobs" class="clear-btn">
          🗑️ Clear Completed
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useConvexQuery, useConvexMutation } from "@convex-vue/core";
import { api } from "../../convex/_generated/api";
import {
  SelectFolderToMonitor,
  SetSelectedFolder,
  ProcessAllFolderFiles,
  GetFolderFiles,
} from "../../wailsjs/go/main/CleanApp";

// Reactive state
const selectedFolderId = ref(null);
const isScanning = ref(false);

// Convex queries
const { data: folders, error: foldersError } = useConvexQuery(
  api.folders.list,
  {}
);

// Files query with conditional arguments
const filesArgs = computed(() => ({
  folderId: selectedFolderId.value || "",
}));
const { data: files, error: filesError } = useConvexQuery(
  api.files.listByFolderWithChunkStatus,
  filesArgs
);

// Cost estimate query
const costArgs = computed(() => ({
  folderId: selectedFolderId.value || "",
}));
const { data: costEstimate } = useConvexQuery(
  api.files.getCostEstimate,
  costArgs
);

// Job queries
const { data: activeJobsWithFiles } = useConvexQuery(
  api.jobs.listActiveWithFiles,
  {}
);
const { data: queueStats } = useConvexQuery(api.jobs.getQueueStats, {});

// Convex mutations
const { mutate: createFolder } = useConvexMutation(api.folders.create);
const { mutate: updateMonitoringStatus } = useConvexMutation(
  api.folders.updateMonitoringStatus
);
const { mutate: deleteFolder } = useConvexMutation(api.folders.remove);
const { mutate: upsertFile } = useConvexMutation(api.files.upsert);
const { mutate: deleteFile } = useConvexMutation(api.files.remove);
const { mutate: createTranscriptionJob } = useConvexMutation(
  api.jobs.createJob
);
const { mutate: clearCompleted } = useConvexMutation(api.jobs.clearCompleted);
const { mutate: cancelJobMutation } = useConvexMutation(api.jobs.cancel);
const { mutate: retryJobMutation } = useConvexMutation(api.jobs.retry);

// Computed values
const selectedFolder = computed(() => {
  if (!selectedFolderId.value || !folders?.value) return null;
  return folders.value.find((f) => f._id === selectedFolderId.value);
});

const pendingFiles = computed(() => {
  if (!files?.value) return [];
  return files.value.filter((file) => file.status === "pending");
});

// Methods
const selectNewFolder = async () => {
  try {
    const folderPath = await SelectFolderToMonitor();
    if (folderPath) {
      // Create folder in Convex
      const folderId = await createFolder({
        path: folderPath,
        name: folderPath.split("/").pop() || folderPath,
      });
      if (folderId) {
        // Set this as the active folder in the backend
        await SetSelectedFolder(folderId, folderPath);
        // Set as selected in the UI
        selectFolder(folderId);
      }
    }
  } catch (error) {
    console.error("Error selecting new folder:", error);
  }
};

const selectFolder = (folderId) => {
  selectedFolderId.value = folderId;
};

const toggleMonitoring = async (folderId, shouldMonitor) => {
  try {
    await updateMonitoringStatus({ id: folderId, isMonitoring: shouldMonitor });
    if (shouldMonitor) {
      // Potentially trigger backend to start watching
      console.log("Start monitoring on backend for", folderId);
    } else {
      // Potentially trigger backend to stop watching
      console.log("Stop monitoring on backend for", folderId);
    }
  } catch (error) {
    console.error("Error toggling monitoring status:", error);
  }
};

const removeFolder = async (folderId) => {
  if (confirm("Remove this folder and all its files?")) {
    try {
      await deleteFolder({ id: folderId });
      if (selectedFolderId.value === folderId) {
        selectedFolderId.value = null;
      }
    } catch (error) {
      console.error("Error removing folder:", error);
      alert(error.message);
    }
  }
};

const syncGoFilesToConvex = async () => {
  if (!selectedFolderId.value) return;

  try {
    // Get the scanned files from Go backend
    const scannedFiles = await GetFolderFiles();

    // Sync each file to Convex
    for (const file of scannedFiles) {
      await upsertFile({
        path: file.path,
        name: file.name,
        folderId: selectedFolderId.value,
        sizeBytes: file.size_bytes,
        estimatedDuration: file.duration,
        hash: `hash-${file.path}-${file.size_bytes}`, // Simple hash based on path and size
      });
    }

    console.log(`Synced ${scannedFiles.length} files to Convex`);
  } catch (error) {
    console.error("Error syncing files to Convex:", error);
    throw error;
  }
};

const scanSelectedFolder = async () => {
  if (!selectedFolder.value) return;

  isScanning.value = true;
  try {
    // Use the existing Go backend to scan the folder
    await ScanMonitoredFolder();

    // Sync the results to Convex
    await syncGoFilesToConvex();
  } catch (error) {
    console.error("Error scanning folder:", error);
    alert(error.message);
  } finally {
    isScanning.value = false;
  }
};

const processAllFiles = async () => {
  if (!selectedFolderId.value) {
    alert("Please select a folder first.");
    return;
  }
  try {
    await ProcessAllFolderFiles();
    alert("All pending files have been queued for processing.");
  } catch (error) {
    console.error("Error processing all files:", error);
    alert(`Error: ${error.message || error}`);
  }
};

const processFile = async (fileId) => {
  try {
    await createTranscriptionJob({ fileId, jobType: "transcribe" });
  } catch (error) {
    console.error(`Error queuing job for file ${fileId}:`, error);
  }
};

const removeFile = async (fileId) => {
  try {
    await deleteFile({ id: fileId });
  } catch (error) {
    console.error("Error removing file:", error);
    alert(error.message);
  }
};

const clearCompletedJobs = async () => {
  try {
    const count = await clearCompleted({});
    alert(`${count} completed jobs cleared.`);
  } catch (error) {
    console.error("Error clearing completed jobs:", error);
  }
};

const cancelJob = async (jobId) => {
  try {
    await cancelJobMutation({ id: jobId });
  } catch (error) {
    console.error(`Error cancelling job ${jobId}:`, error);
  }
};

const retryJob = async (jobId) => {
  try {
    await retryJobMutation({ id: jobId });
  } catch (error) {
    console.error(`Error retrying job ${jobId}:`, error);
  }
};

// Utility functions
const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

// Auto-select first folder when folders load
watch(
  folders,
  (newFolders) => {
    if (newFolders && newFolders.length > 0) {
      // If no folder selected, or selected folder no longer exists, select first one
      if (
        !selectedFolderId.value ||
        !newFolders.find((f) => f._id === selectedFolderId.value)
      ) {
        selectedFolderId.value = newFolders[0]._id;
      }
    } else {
      selectedFolderId.value = null;
    }
  },
  { immediate: true }
);

// Debug logging
watch(foldersError, (error) => {
  if (error) console.error("Folders query error:", error);
});

watch(filesError, (error) => {
  if (error) console.error("Files query error:", error);
});
</script>

<style scoped>
.audio-file-manager {
  padding: 20px;
  font-family: system-ui, sans-serif;
  color: #ffffff;
}

.section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid #4a5568;
  border-radius: 8px;
  background: #2d3748;
}

.section h3 {
  color: #ffffff;
  margin-top: 0;
  margin-bottom: 16px;
}

/* Folder Selection Styles */
.folder-selection {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.browse-btn {
  padding: 12px 20px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  align-self: flex-start;
}

.browse-btn:hover {
  background: #2c5aa0;
}

.folder-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.folder-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px;
  background: #1a202c;
  border: 2px solid #4a5568;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-item:hover {
  border-color: #3182ce;
}

.folder-item.selected {
  border-color: #3182ce;
  background: #2a4365;
}

.folder-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.folder-icon {
  font-size: 20px;
}

.folder-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.folder-name {
  font-weight: 600;
  color: #ffffff;
}

.folder-path {
  font-size: 14px;
  color: #a0aec0;
}

.folder-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* File Management Styles */
.file-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.scan-btn,
.process-btn {
  padding: 8px 16px;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.scan-btn:hover:not(:disabled) {
  background: #2d3748;
}

.scan-btn:disabled {
  background: #2d3748;
  cursor: not-allowed;
  opacity: 0.6;
}

.process-btn {
  background: #ed8936;
}

.process-btn:hover:not(:disabled) {
  background: #dd6b20;
}

.process-btn:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  background: #1a202c;
  border: 1px solid #4a5568;
  border-radius: 4px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.file-icon {
  font-size: 18px;
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex-grow: 1;
}

.file-name {
  font-weight: 500;
  color: #ffffff;
}

.file-meta {
  font-size: 12px;
  color: #a0aec0;
}

.file-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* Status and Controls */
.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: #ffffff;
  background: #4a5568;
}

.status.active {
  background: #48bb78;
}

.status.pending {
  background: #ed8936;
}

.status.processing {
  background: #3182ce;
}

.status.completed {
  background: #48bb78;
}

.status.failed {
  background: #e53e3e;
}

.toggle-btn {
  padding: 6px 12px;
  background: #4a5568;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.toggle-btn.active {
  background: #e53e3e;
}

.toggle-btn:hover {
  opacity: 0.8;
}

.danger {
  background: #e53e3e !important;
  color: white !important;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.process-file-btn {
  padding: 6px 12px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.process-file-btn:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

/* Cost Estimate */
.cost-estimate {
  background: #2a4365;
  color: #ffffff;
  padding: 15px;
  border-radius: 6px;
  margin: 15px 0;
  border: 1px solid #4a5568;
}

.cost-estimate h4 {
  color: #ffffff;
  margin: 0 0 12px 0;
}

.cost-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.cost-item {
  font-size: 14px;
  color: #e2e8f0;
}

/* Job Queue Styles */
.queue-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.stat-item {
  padding: 6px 12px;
  background: #4a5568;
  color: #ffffff;
  border-radius: 4px;
  font-size: 12px;
}

.job-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.job-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #334155;
  transition: background-color 0.2s;
}

.job-item:hover {
  background-color: #1f2937;
}

.job-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-grow: 1;
}

.job-icon {
  font-size: 1.5rem;
}

.job-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 100%;
}

.job-file-name {
  font-weight: 600;
  color: #e5e7eb;
}

.job-type {
  font-size: 0.9rem;
  color: #9ca3af;
  text-transform: capitalize;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.job-progress progress {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  border: none;
}

.job-progress progress::-webkit-progress-bar {
  background-color: #374151;
}

.job-progress progress::-webkit-progress-value {
  background-color: #3b82f6;
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.8rem;
  color: #d1d5db;
}

.job-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.job-controls .status {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: capitalize;
}

.priority {
  font-size: 0.8rem;
  color: #9ca3af;
  margin-right: 0.5rem;
}

.retry-btn {
  background-color: #22c55e;
  color: white;
}
.retry-btn:hover {
  background-color: #16a34a;
}

.queue-controls {
  display: flex;
  gap: 10px;
}

.clear-btn {
  background: #4a5568;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

.clear-btn:hover {
  background: #2d3748;
}

/* Utility Styles */
.chunk-indicator {
  background: #ed8936;
  color: #1a202c;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.loading {
  color: #a0aec0;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.empty-state {
  color: #a0aec0;
  text-align: center;
  padding: 20px;
  font-style: italic;
}

.chunk-progress-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.chunk-progress-bar progress {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  border: none;
}

.chunk-progress-bar progress::-webkit-progress-bar {
  background-color: #374151;
}

.chunk-progress-bar progress::-webkit-progress-value {
  background-color: #f59e0b; /* Amber color for chunking */
  transition: width 0.3s;
}

.chunk-progress-bar span {
  font-size: 0.75rem;
  color: #9ca3af;
  white-space: nowrap;
}
</style>
