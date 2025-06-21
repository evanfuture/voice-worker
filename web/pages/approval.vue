<template>
  <div class="approval-page">
    <div class="page-header">
      <h2>📋 Job Approval</h2>
      <p>Simple approval gate to control job processing</p>

      <div class="mode-controls">
        <div class="queue-mode">
          <strong>Queue Mode:</strong>
          <span :class="`mode mode-${queueMode}`">
            {{ queueMode.toUpperCase() }}
          </span>
          <button
            v-if="queueMode === 'auto'"
            @click="switchToApprovalMode"
            class="btn btn-secondary btn-small"
          >
            Switch to Approval Mode
          </button>
          <button
            v-else
            @click="switchToAutoMode"
            class="btn btn-secondary btn-small"
          >
            Switch to Auto Mode
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Loading pending jobs...</div>

    <div v-else-if="pendingJobs.length === 0" class="no-jobs">
      <h3>✅ No jobs waiting for approval</h3>
      <p v-if="queueMode === 'auto'">
        System is in auto mode - files will be processed automatically.
      </p>
      <p v-else>
        Drop files in the dropbox folder and they will appear here for approval.
      </p>
    </div>

    <div v-else>
      <!-- Selection Controls -->
      <div class="selection-controls">
        <h3>🎯 Jobs Waiting for Approval ({{ pendingJobs.length }})</h3>
        <div class="controls-row">
          <button @click="selectAll" class="btn btn-secondary btn-small">
            Select All
          </button>
          <button @click="selectNone" class="btn btn-secondary btn-small">
            Select None
          </button>
          <button
            @click="approveSelected"
            :disabled="selectedJobs.length === 0 || approving"
            class="btn btn-primary"
          >
            {{
              approving ? "Approving..." : `Approve ${selectedJobs.length} Jobs`
            }}
          </button>
        </div>
      </div>

      <!-- Jobs List -->
      <div class="jobs-list">
        <div
          v-for="job in pendingJobs"
          :key="`${job.fileId}-${job.parser}`"
          class="job-item"
        >
          <div class="job-header">
            <label class="job-checkbox">
              <input
                type="checkbox"
                :checked="isJobSelected(job.fileId, job.parser)"
                @change="
                  toggleJob(job.fileId, job.parser, $event.target.checked)
                "
              />
              <div class="job-info">
                <h4>{{ job.fileName }}</h4>
                <span class="job-details">{{ job.parser }} processor</span>
                <span class="file-path">{{ job.filePath }}</span>
                <div class="file-tags" v-if="job.fileTags.length > 0">
                  <span v-for="tag in job.fileTags" :key="tag" class="tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
            </label>
            <div class="job-meta">
              <span class="job-status">{{ job.status.replace("_", " ") }}</span>
              <span class="job-time">{{ formatTime(job.updatedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(true);
const approving = ref(false);
const queueMode = ref("auto");
const pendingJobs = ref([]);
const selectedJobs = ref([]);

// Load queue mode
async function loadQueueMode() {
  try {
    const response = await $fetch("/api/queue-mode");
    queueMode.value = response.queueMode;
  } catch (error) {
    console.error("Failed to load queue mode:", error);
  }
}

// Load pending approval jobs
async function loadPendingJobs() {
  try {
    loading.value = true;
    const response = await $fetch("/api/pending-approval");
    pendingJobs.value = response.jobs;
  } catch (error) {
    console.error("Failed to load pending jobs:", error);
  } finally {
    loading.value = false;
  }
}

// Switch queue modes
async function switchToApprovalMode() {
  try {
    await $fetch("/api/queue-mode", {
      method: "POST",
      body: { queueMode: "approval" },
    });
    queueMode.value = "approval";
  } catch (error) {
    console.error("Failed to switch to approval mode:", error);
  }
}

async function switchToAutoMode() {
  try {
    await $fetch("/api/queue-mode", {
      method: "POST",
      body: { queueMode: "auto" },
    });
    queueMode.value = "auto";
  } catch (error) {
    console.error("Failed to switch to auto mode:", error);
  }
}

// Job selection
function isJobSelected(fileId, parser) {
  return selectedJobs.value.some(
    (job) => job.fileId === fileId && job.parser === parser
  );
}

function toggleJob(fileId, parser, checked) {
  if (checked) {
    selectedJobs.value.push({ fileId, parser });
  } else {
    selectedJobs.value = selectedJobs.value.filter(
      (job) => !(job.fileId === fileId && job.parser === parser)
    );
  }
}

function selectAll() {
  selectedJobs.value = pendingJobs.value.map((job) => ({
    fileId: job.fileId,
    parser: job.parser,
  }));
}

function selectNone() {
  selectedJobs.value = [];
}

// Approve selected jobs
async function approveSelected() {
  if (selectedJobs.value.length === 0) return;

  try {
    approving.value = true;

    await $fetch("/api/approve-jobs", {
      method: "POST",
      body: { selectedJobs: selectedJobs.value },
    });

    // Clear selection and reload
    selectedJobs.value = [];
    await loadPendingJobs();

    console.log("Jobs approved successfully");
  } catch (error) {
    console.error("Failed to approve jobs:", error);
  } finally {
    approving.value = false;
  }
}

// Utility functions
function formatTime(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}

// Load data on mount
onMounted(async () => {
  await Promise.all([loadQueueMode(), loadPendingJobs()]);
});

// Auto-refresh every 10 seconds
onMounted(() => {
  if (import.meta.client) {
    setInterval(async () => {
      if (!approving.value) {
        await loadPendingJobs();
      }
    }, 10000);
  }
});
</script>

<style scoped>
.approval-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 30px;
}

.mode-controls {
  margin-top: 15px;
}

.queue-mode {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mode {
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 12px;
}

.mode-auto {
  background-color: #e3f2fd;
  color: #1976d2;
}

.mode-approval {
  background-color: #fff3e0;
  color: #f57c00;
}

.selection-controls {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.controls-row {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-top: 15px;
}

.jobs-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.job-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: white;
}

.job-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.job-checkbox {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  cursor: pointer;
  flex: 1;
}

.job-checkbox input[type="checkbox"] {
  margin-top: 4px;
}

.job-info h4 {
  margin: 0 0 5px 0;
  color: #111827;
}

.job-details {
  display: block;
  color: #6b7280;
  font-size: 14px;
  margin-bottom: 5px;
}

.file-path {
  display: block;
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 8px;
}

.file-tags {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.tag {
  background: #dbeafe;
  color: #1e40af;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.job-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
}

.job-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #fff3e0;
  color: #f57c00;
  text-transform: capitalize;
}

.job-time {
  font-size: 12px;
  color: #6b7280;
}

.loading,
.no-jobs {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s;
}

.btn-primary {
  background: var(--color-brand-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-primary:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}
</style>
