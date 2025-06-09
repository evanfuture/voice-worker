<template>
  <div class="dashboard">
    <div class="page-header">
      <h2>📊 Queue Dashboard</h2>
      <p>Monitor and control the transcription queue</p>
    </div>

    <!-- Controls -->
    <div class="controls">
      <button @click="pauseQueue" :disabled="isPaused" class="btn btn-danger">
        ⏸️ Pause Queue
      </button>
      <button
        @click="resumeQueue"
        :disabled="!isPaused"
        class="btn btn-primary"
      >
        ▶️ Resume Queue
      </button>
      <button @click="loadJobs" class="btn btn-secondary">🔄 Refresh</button>
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

    <!-- Cost Summary (only show when paused with waiting jobs) -->
    <div
      v-if="
        isPaused &&
        (costSummary.transcriptionJobCount > 0 ||
          costSummary.summarizationJobCount > 0)
      "
      class="cost-section"
    >
      <div class="cost-warning">
        <h3>💰 Estimated Costs for Waiting Jobs</h3>
        <div class="cost-details">
          <div v-if="costSummary.transcriptionJobCount > 0" class="cost-item">
            <span class="cost-label">Transcription Jobs:</span>
            <span class="cost-value">{{
              costSummary.transcriptionJobCount
            }}</span>
          </div>
          <div v-if="costSummary.summarizationJobCount > 0" class="cost-item">
            <span class="cost-label">Summarization Jobs:</span>
            <span class="cost-value">{{
              costSummary.summarizationJobCount
            }}</span>
          </div>
          <div
            v-if="costSummary.formattedTotalDuration !== '0m'"
            class="cost-item"
          >
            <span class="cost-label">Estimated Duration:</span>
            <span class="cost-value">{{
              costSummary.formattedTotalDuration
            }}</span>
          </div>
          <div class="cost-item">
            <span class="cost-label">Total Estimated Cost:</span>
            <span class="cost-value cost-amount">{{
              costSummary.formattedTotalCost
            }}</span>
          </div>
        </div>
        <div class="cost-note">
          ⚠️ These are estimated costs. Transcription costs based on file size,
          summarization costs based on content length. Actual costs may vary.
        </div>
      </div>
    </div>

    <!-- Jobs Table -->
    <div class="jobs-section">
      <h3>📋 Current Jobs</h3>

      <div v-if="loading" class="loading">Loading jobs...</div>

      <table v-else class="jobs-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Parser</th>
            <th>File</th>
            <th>Status</th>
            <th>Cost</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="jobs.length === 0">
            <td colspan="7" style="text-align: center; color: #6b7280">
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
            <td>
              <span
                v-if="job.data.estimatedCost && job.status === 'waiting'"
                class="cost-estimate"
              >
                {{ formatJobCost(job.data.estimatedCost) }}
              </span>
              <span v-else class="no-cost">-</span>
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
</template>

<script setup>
import { useWebSocket } from "@vueuse/core";

// Reactive state
const isPaused = ref(false);
const queueCounts = ref({
  waiting: 0,
  active: 0,
  completed: 0,
  failed: 0,
});
const jobs = ref([]);
const loading = ref(true);
const costSummary = ref({
  totalCost: 0,
  totalDurationMinutes: 0,
  transcriptionJobCount: 0,
  summarizationJobCount: 0,
  totalWaitingJobs: 0,
  formattedTotalCost: "$0.00",
  formattedTotalDuration: "0m",
  jobCosts: [],
});

// WebSocket connection for real-time updates
const wsProtocol =
  import.meta.client && window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = import.meta.client
  ? `${wsProtocol}//${window.location.host}/_ws`
  : "";

const { data } = useWebSocket(wsUrl, {
  autoReconnect: true,
  heartbeat: true,
});

// Watch for WebSocket data updates
watch(data, (newData) => {
  if (newData) {
    // Ignore ping/pong messages
    if (newData === "ping" || newData === "pong") {
      return;
    }

    try {
      const update = JSON.parse(newData);
      if (update.type === "status") {
        isPaused.value = update.data.isPaused;
        queueCounts.value = update.data.queue || {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
        };
      }
    } catch (error) {
      console.error("Failed to parse WebSocket data:", error);
    }
  }
});

// Computed properties
const queueStatusClass = computed(() => ({
  "queue-status": true,
  paused: isPaused.value,
  active: !isPaused.value,
}));

const queueStatusText = computed(() =>
  isPaused.value ? "⏸️ Paused" : "▶️ Active"
);

// API functions
async function pauseQueue() {
  try {
    await $fetch("/api/pause", { method: "POST" });
    await loadStatus();
  } catch (error) {
    console.error("Failed to pause queue:", error);
  }
}

async function resumeQueue() {
  try {
    await $fetch("/api/resume", { method: "POST" });
    await loadStatus();
  } catch (error) {
    console.error("Failed to resume queue:", error);
  }
}

async function loadJobs() {
  try {
    loading.value = true;
    const response = await $fetch("/api/jobs");
    jobs.value = Array.isArray(response) ? response : [];
  } catch (error) {
    console.error("Failed to load jobs:", error);
  } finally {
    loading.value = false;
  }
}

async function loadStatus() {
  try {
    const response = await $fetch("/api/status");
    isPaused.value = response.isPaused;
    queueCounts.value = response.queue || {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
    };

    // Load cost summary
    const costResponse = await $fetch("/api/cost-summary");
    costSummary.value = costResponse;
  } catch (error) {
    console.error("Failed to load status:", error);
  }
}

async function retryJob(jobId) {
  try {
    await $fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
    await loadJobs();
  } catch (error) {
    console.error("Failed to retry job:", error);
  }
}

async function removeJob(jobId) {
  try {
    await $fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    await loadJobs();
  } catch (error) {
    console.error("Failed to remove job:", error);
  }
}

async function clearCompleted() {
  try {
    await $fetch("/api/clear-completed", { method: "POST" });
    await loadJobs();
  } catch (error) {
    console.error("Failed to clear completed jobs:", error);
  }
}

// Utility functions
function getFileName(path) {
  return path.split("/").pop() || path;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function formatJobCost(cost) {
  return `$${cost.toFixed(3)}`;
}

// Initialize data on mount
onMounted(() => {
  loadStatus();
  loadJobs();
});
</script>

<style scoped>
.dashboard {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #1f2937;
}

.page-header p {
  margin: 0;
  color: #6b7280;
}

.controls {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #2563eb;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
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
}

.btn-small {
  padding: 4px 8px;
  font-size: 0.875rem;
}

.status-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.status-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 16px;
  text-align: center;
}

.status-card h3 {
  margin: 0 0 8px 0;
  font-size: 0.875rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-value {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
}

.queue-status {
  font-size: 1.25rem;
  font-weight: bold;
  padding: 8px 16px;
  border-radius: 4px;
  display: inline-block;
}

.queue-status.active {
  background: #d1fae5;
  color: #065f46;
}

.queue-status.paused {
  background: #fed7d7;
  color: #742a2a;
}

.cost-section {
  margin-bottom: 24px;
}

.cost-warning {
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 6px;
  padding: 16px;
}

.cost-warning h3 {
  margin: 0 0 16px 0;
  color: #c2410c;
}

.cost-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.cost-item {
  display: flex;
  justify-content: space-between;
}

.cost-label {
  color: #78716c;
}

.cost-value {
  font-weight: bold;
  color: #1f2937;
}

.cost-amount {
  color: #dc2626;
}

.cost-note {
  font-size: 0.875rem;
  color: #78716c;
  font-style: italic;
}

.jobs-section h3 {
  margin: 0 0 16px 0;
  color: #1f2937;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.jobs-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.jobs-table th,
.jobs-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

.jobs-table th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.job-status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-waiting {
  background: #dbeafe;
  color: #1e40af;
}

.status-active {
  background: #d1fae5;
  color: #065f46;
}

.status-completed {
  background: #f3f4f6;
  color: #374151;
}

.status-failed {
  background: #fee2e2;
  color: #991b1b;
}

.cost-estimate {
  color: #dc2626;
  font-weight: 500;
}

.no-cost {
  color: #9ca3af;
}

.job-actions {
  display: flex;
  gap: 8px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
  }

  .status-section {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .cost-details {
    grid-template-columns: 1fr;
  }

  .jobs-table {
    font-size: 0.875rem;
  }

  .jobs-table th,
  .jobs-table td {
    padding: 8px;
  }
}
</style>
