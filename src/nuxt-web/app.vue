<template>
  <div>
    <!-- Connection Status -->
    <div :class="connectionStatusClass">
      <span>{{ connectionStatusText }}</span>
    </div>

    <div class="container">
      <!-- Header -->
      <div class="header">
        <h1>🎙️ Voice Worker</h1>
        <p>Transcription Queue Control Center</p>
      </div>

      <div class="main-content">
        <!-- Controls -->
        <div class="controls">
          <button
            @click="pauseQueue"
            :disabled="isPaused"
            class="btn btn-danger"
          >
            ⏸️ Pause Queue
          </button>
          <button
            @click="resumeQueue"
            :disabled="!isPaused"
            class="btn btn-primary"
          >
            ▶️ Resume Queue
          </button>
          <button @click="loadJobs" class="btn btn-secondary">
            🔄 Refresh
          </button>
          <button @click="clearCompleted" class="btn btn-secondary">
            🗑️ Clear Completed
          </button>
        </div>

        <!-- Status Cards -->
        <div class="status-section">
          <div class="status-card">
            <h3>Queue Status</h3>
            <div :class="queueStatusClass">
              {{ queueStatusText }}
            </div>
          </div>
          <div class="status-card">
            <h3>Waiting Jobs</h3>
            <div class="status-value">{{ queueCounts.waiting || 0 }}</div>
          </div>
          <div class="status-card">
            <h3>Active Jobs</h3>
            <div class="status-value">{{ queueCounts.active || 0 }}</div>
          </div>
          <div class="status-card">
            <h3>Completed Jobs</h3>
            <div class="status-value">{{ queueCounts.completed || 0 }}</div>
          </div>
          <div class="status-card">
            <h3>Failed Jobs</h3>
            <div class="status-value">{{ queueCounts.failed || 0 }}</div>
          </div>
        </div>

        <!-- Jobs Table -->
        <div class="jobs-section">
          <h2>📋 Current Jobs</h2>

          <div v-if="loading" class="loading">Loading jobs...</div>

          <table v-else class="jobs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Parser</th>
                <th>File</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="jobs.length === 0">
                <td colspan="6" style="text-align: center; color: #6b7280">
                  No jobs found
                </td>
              </tr>
              <tr v-for="job in jobs" :key="job.id">
                <td>{{ job.id }}</td>
                <td>{{ job.name || job.data.parser }}</td>
                <td :title="job.data.path">{{ getFileName(job.data.path) }}</td>
                <td>
                  <span :class="`job-status status-${job.status}`">
                    {{ job.status }}
                  </span>
                </td>
                <td>{{ formatDate(job.createdAt) }}</td>
                <td>
                  <div class="job-actions">
                    <button
                      v-if="job.status === 'failed'"
                      @click="retryJob(job.id)"
                      class="btn btn-primary btn-small"
                    >
                      Retry
                    </button>
                    <button
                      @click="removeJob(job.id)"
                      class="btn btn-danger btn-small"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useWebSocket } from "@vueuse/core";

// Reactive state
const connected = ref(false);
const isPaused = ref(false);
const queueCounts = ref({});
const jobs = ref([]);
const loading = ref(true);

// WebSocket connection
const wsProtocol =
  import.meta.client && window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = import.meta.client
  ? `${wsProtocol}//${window.location.host}/_ws`
  : "";

const { status, data } = useWebSocket(wsUrl, {
  autoReconnect: true,
  heartbeat: true,
});

// Watch WebSocket connection status
watch(status, (newStatus) => {
  connected.value = newStatus === "OPEN";
});

// Watch for incoming WebSocket messages
watch(data, (newData) => {
  if (!newData) return;

  // Handle ping/pong messages
  if (newData === "ping" || newData === "pong") {
    return; // Ignore ping/pong messages on client side
  }

  // Try to parse JSON messages
  try {
    const message = JSON.parse(newData);
    if (message.type === "status") {
      updateStatus(message.data);
    }
  } catch (error) {
    // Only log error if it's not a ping/pong message
    if (!["ping", "pong"].includes(newData)) {
      console.error("Error parsing WebSocket message:", newData, error);
    }
  }
});

// Computed properties
const connectionStatusClass = computed(() => [
  "connection-status",
  connected.value ? "connected" : "disconnected",
]);

const connectionStatusText = computed(() =>
  connected.value ? "🟢 Connected" : "🔴 Disconnected"
);

const queueStatusClass = computed(() => [
  "status-indicator",
  isPaused.value ? "status-paused" : "status-running",
]);

const queueStatusText = computed(() => (isPaused.value ? "Paused" : "Running"));

// Methods
function updateStatus(data) {
  queueCounts.value = data.queue || {};
  isPaused.value = data.isPaused || false;
}

async function refreshStatus() {
  try {
    const statusData = await $fetch("/api/status");
    updateStatus(statusData);
  } catch (error) {
    console.error("Failed to refresh status:", error);
  }
}

async function pauseQueue() {
  try {
    await $fetch("/api/pause", { method: "POST" });
    console.log("Queue paused successfully");
    // Manually refresh status after API call
    await refreshStatus();
  } catch (error) {
    console.error("Failed to pause queue:", error);
    alert("Failed to pause queue");
  }
}

async function resumeQueue() {
  try {
    await $fetch("/api/resume", { method: "POST" });
    console.log("Queue resumed successfully");
    // Manually refresh status after API call
    await refreshStatus();
  } catch (error) {
    console.error("Failed to resume queue:", error);
    alert("Failed to resume queue");
  }
}

async function loadJobs() {
  try {
    loading.value = true;
    jobs.value = await $fetch("/api/jobs");
  } catch (error) {
    console.error("Failed to load jobs:", error);
  } finally {
    loading.value = false;
  }
}

async function retryJob(jobId) {
  try {
    await $fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    console.log(`Job ${jobId} retried successfully`);
    await loadJobs();
  } catch (error) {
    console.error("Failed to retry job:", error);
    alert("Failed to retry job");
  }
}

async function removeJob(jobId) {
  if (!confirm("Are you sure you want to remove this job?")) {
    return;
  }

  try {
    await $fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    console.log(`Job ${jobId} removed successfully`);
    await loadJobs();
  } catch (error) {
    console.error("Failed to remove job:", error);
    alert("Failed to remove job");
  }
}

async function clearCompleted() {
  if (
    !confirm("Are you sure you want to clear all completed and failed jobs?")
  ) {
    return;
  }

  try {
    await $fetch("/api/clear-completed", { method: "POST" });
    console.log("Completed jobs cleared successfully");
    await loadJobs();
    await refreshStatus(); // Refresh status after clearing jobs
  } catch (error) {
    console.error("Failed to clear completed jobs:", error);
    alert("Failed to clear completed jobs");
  }
}

function getFileName(path) {
  return path ? path.split("/").pop() : "Unknown";
}

function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleString() : "-";
}

// Load jobs on mount
onMounted(() => {
  loadJobs();
});
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
    Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(90deg, #4f46e5, #7c3aed);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.header p {
  opacity: 0.9;
  font-size: 1.1rem;
}

.main-content {
  padding: 2rem;
}

.controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-primary {
  background: #10b981;
  color: white;
}

.btn-primary:hover {
  background: #059669;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.status-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.status-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 1.5rem;
  border-left: 4px solid #4f46e5;
}

.status-card h3 {
  color: #1f2937;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.status-value {
  font-size: 2rem;
  font-weight: bold;
  color: #4f46e5;
}

.status-indicator {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-running {
  background: #dcfce7;
  color: #166534;
}

.status-paused {
  background: #fef3c7;
  color: #92400e;
}

.jobs-section {
  margin-top: 2rem;
}

.jobs-section h2 {
  color: #1f2937;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
}

.jobs-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.jobs-table th,
.jobs-table td {
  padding: 1rem;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.jobs-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.jobs-table tr:hover {
  background: #f9fafb;
}

.job-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-waiting {
  background: #dbeafe;
  color: #1e40af;
}

.status-active {
  background: #fef3c7;
  color: #92400e;
}

.status-completed {
  background: #dcfce7;
  color: #166534;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.job-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
}

.connection-status {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  z-index: 1000;
}

.connected {
  background: #dcfce7;
  color: #166534;
}

.disconnected {
  background: #fee2e2;
  color: #dc2626;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
  }

  .status-section {
    grid-template-columns: 1fr;
  }

  .jobs-table {
    font-size: 0.875rem;
  }

  .jobs-table th,
  .jobs-table td {
    padding: 0.75rem 0.5rem;
  }
}
</style>
