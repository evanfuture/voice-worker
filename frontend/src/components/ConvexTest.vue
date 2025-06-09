<template>
  <div class="convex-test">
    <h2>🔄 Convex Integration Test</h2>

    <!-- Folder Management -->
    <div class="section">
      <h3>📁 Folders</h3>
      <div class="form-group">
        <input
          v-model="newFolderPath"
          placeholder="Enter folder path..."
          @keyup.enter="addFolder"
        />
        <button @click="addFolder" :disabled="!newFolderPath">
          Add Folder
        </button>
      </div>

      <div v-if="folders === undefined" class="loading">Loading folders...</div>
      <div v-else-if="folders && folders.length > 0" class="items">
        <div v-for="folder in folders" :key="folder._id" class="item">
          <span>📁 {{ folder.name }} ({{ folder.path }})</span>
          <span :class="['status', { active: folder.isMonitoring }]">
            {{ folder.isMonitoring ? "Monitoring" : "Stopped" }}
          </span>
          <button @click="toggleMonitoring(folder._id, !folder.isMonitoring)">
            {{ folder.isMonitoring ? "Stop" : "Start" }}
          </button>
          <button @click="removeFolder(folder._id)" class="danger">
            Remove
          </button>
        </div>
      </div>
      <div v-else class="empty-state">
        No folders yet. Add one above to get started.
      </div>
    </div>

    <!-- File Management -->
    <div class="section" v-if="selectedFolder">
      <h3>📄 Files in {{ selectedFolder.name }}</h3>

      <div class="form-group">
        <input v-model="newFileName" placeholder="Test file name..." />
        <input
          v-model="newFileSize"
          type="number"
          placeholder="Size in bytes..."
        />
        <input
          v-model="newFileDuration"
          type="number"
          placeholder="Duration in seconds..."
        />
        <button @click="addTestFile" :disabled="!newFileName">
          Add Test File
        </button>
      </div>

      <div v-if="files === undefined" class="loading">Loading files...</div>
      <div v-else-if="files && files.length > 0" class="items">
        <div v-for="file in files" :key="file._id" class="item">
          <span>📄 {{ file.name }}</span>
          <span class="status">{{ file.status }}</span>
          <span class="size">{{ formatFileSize(file.sizeBytes) }}</span>
          <span class="duration">{{
            formatDuration(file.estimatedDuration)
          }}</span>
          <span v-if="file.needsChunking" class="chunk-indicator"
            >🔄 Needs Chunking</span
          >
          <button
            @click="createJob(file._id)"
            :disabled="file.status !== 'pending'"
          >
            Queue Job
          </button>
          <button @click="removeFile(file._id)" class="danger">Remove</button>
        </div>
      </div>
      <div v-else class="empty-state">
        No files in this folder yet. Add some above.
      </div>

      <!-- Cost Estimate -->
      <div v-if="costEstimate" class="cost-estimate">
        <h4>💰 Cost Estimate</h4>
        <p>Files: {{ costEstimate.fileCount }}</p>
        <p>Duration: {{ formatDuration(costEstimate.totalDuration) }}</p>
        <p>
          Estimated Cost: ${{ (costEstimate.estimatedCost || 0).toFixed(4) }}
        </p>
      </div>
    </div>

    <!-- Job Queue -->
    <div class="section">
      <h3>⚙️ Job Queue</h3>
      <div v-if="queueStats" class="queue-stats">
        <span>Total: {{ queueStats.total }}</span>
        <span>Queued: {{ queueStats.queued }}</span>
        <span>Processing: {{ queueStats.processing }}</span>
        <span>Completed: {{ queueStats.completed }}</span>
        <span>Failed: {{ queueStats.failed }}</span>
      </div>

      <div v-if="activeJobs" class="items">
        <div v-for="job in activeJobs" :key="job._id" class="item">
          <span>⚙️ {{ job.jobType }}</span>
          <span class="status">{{ job.status }}</span>
          <progress :value="job.progress" max="100">
            {{ job.progress }}%
          </progress>
          <span>Priority: {{ job.priority }}</span>
        </div>
      </div>

      <button @click="clearCompletedJobs" class="clear-btn">
        Clear Completed
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useConvexQuery, useConvexMutation } from "@convex-vue/core";
import { api } from "../../convex/_generated/api";

// Reactive data
const newFolderPath = ref("");
const newFileName = ref("");
const newFileSize = ref(1024000); // 1MB default
const newFileDuration = ref(300); // 5 minutes default
const selectedFolderId = ref(null);

// Convex queries
const { data: folders, error: foldersError } = useConvexQuery(
  api.folders.list,
  {}
);

// Files query - provide empty string when no folder selected
const filesArgs = computed(() => ({
  folderId: selectedFolderId.value || "",
}));
const { data: files, error: filesError } = useConvexQuery(
  api.files.listByFolder,
  filesArgs
);

const { data: activeJobs } = useConvexQuery(api.jobs.listActive, {});
const { data: queueStats } = useConvexQuery(api.jobs.getQueueStats, {});

// Cost estimate query - provide empty string when no folder selected
const costArgs = computed(() => ({
  folderId: selectedFolderId.value || "",
}));
const { data: costEstimate } = useConvexQuery(
  api.files.getCostEstimate,
  costArgs
);

// Debug logging
watch(
  folders,
  (newFolders) => {
    console.log("Folders updated:", newFolders);
  },
  { immediate: true }
);

watch(
  files,
  (newFiles) => {
    console.log("Files updated:", newFiles);
  },
  { immediate: true }
);

watch(foldersError, (error) => {
  if (error) console.error("Folders query error:", error);
});

watch(filesError, (error) => {
  if (error) console.error("Files query error:", error);
});

// Convex mutations
const { mutate: createFolder } = useConvexMutation(api.folders.create);
const { mutate: updateMonitoringStatus } = useConvexMutation(
  api.folders.updateMonitoringStatus
);
const { mutate: deleteFolder } = useConvexMutation(api.folders.remove);
const { mutate: upsertFile } = useConvexMutation(api.files.upsert);
const { mutate: deleteFile } = useConvexMutation(api.files.remove);
const { mutate: createTranscriptionJob } = useConvexMutation(
  api.jobs.createTranscriptionJob
);
const { mutate: clearCompleted } = useConvexMutation(api.jobs.clearCompleted);

// Computed values
const selectedFolder = computed(() => {
  if (!selectedFolderId.value || !folders?.value) return null;
  return folders.value.find((f) => f._id === selectedFolderId.value);
});

// Methods
const addFolder = async () => {
  if (!newFolderPath.value) return;

  try {
    const folderId = await createFolder({
      path: newFolderPath.value,
      name: newFolderPath.value.split("/").pop() || "Unknown",
    });

    // Auto-select the new folder
    selectedFolderId.value = folderId;
    newFolderPath.value = "";
  } catch (error) {
    console.error("Error creating folder:", error);
    alert(error.message);
  }
};

const toggleMonitoring = async (folderId, isMonitoring) => {
  try {
    await updateMonitoringStatus({ id: folderId, isMonitoring });
  } catch (error) {
    console.error("Error updating monitoring status:", error);
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
    }
  }
};

const addTestFile = async () => {
  if (!newFileName.value || !selectedFolderId.value) return;

  try {
    await upsertFile({
      path: `/test/${newFileName.value}`,
      name: newFileName.value,
      folderId: selectedFolderId.value,
      sizeBytes: Number(newFileSize.value),
      estimatedDuration: Number(newFileDuration.value),
      hash: `hash-${Date.now()}`, // Mock hash
    });

    newFileName.value = "";
  } catch (error) {
    console.error("Error creating file:", error);
  }
};

const removeFile = async (fileId) => {
  try {
    await deleteFile({ id: fileId });
  } catch (error) {
    console.error("Error removing file:", error);
  }
};

const createJob = async (fileId) => {
  try {
    await createTranscriptionJob({
      fileId: fileId,
      priority: 1,
    });
  } catch (error) {
    console.error("Error creating job:", error);
  }
};

const clearCompletedJobs = async () => {
  try {
    const count = await clearCompleted({});
    console.log(`Cleared ${count} completed jobs`);
  } catch (error) {
    console.error("Error clearing jobs:", error);
  }
};

// Auto-select first folder when folders load (or previously selected folder)
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
        console.log("Auto-selected folder:", newFolders[0]);
      }
    } else {
      selectedFolderId.value = null;
    }
  },
  { immediate: true }
);

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
</script>

<style scoped>
.convex-test {
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

.form-group {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
}

.form-group input {
  padding: 8px;
  border: 1px solid #4a5568;
  border-radius: 4px;
  flex: 1;
  background: #1a202c;
  color: #ffffff;
}

.form-group input::placeholder {
  color: #a0aec0;
}

.form-group button {
  padding: 8px 16px;
  background: #3182ce;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.form-group button:hover:not(:disabled) {
  background: #2c5aa0;
}

.form-group button:disabled {
  background: #4a5568;
  cursor: not-allowed;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px;
  background: #1a202c;
  border: 1px solid #4a5568;
  border-radius: 4px;
  color: #ffffff;
}

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
  color: white;
}

.chunk-indicator {
  background: #ed8936;
  color: #1a202c;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.danger {
  background: #e53e3e !important;
  color: white !important;
}

.size,
.duration {
  color: #a0aec0;
  font-size: 14px;
}

.queue-stats {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
}

.queue-stats span {
  padding: 4px 8px;
  background: #4a5568;
  color: #ffffff;
  border-radius: 4px;
  font-size: 12px;
}

.cost-estimate {
  background: #2a4365;
  color: #ffffff;
  padding: 15px;
  border-radius: 4px;
  margin-top: 15px;
  border: 1px solid #4a5568;
}

.cost-estimate h4 {
  color: #ffffff;
  margin-top: 0;
}

.cost-estimate p {
  color: #e2e8f0;
  margin: 8px 0;
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

progress {
  width: 100px;
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
</style>
