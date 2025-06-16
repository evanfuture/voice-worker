<template>
  <div class="approval-page">
    <div class="page-header">
      <h2>📋 Batch Approval</h2>
      <p>Review and approve file processing with cost estimation</p>

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

    <div v-if="loading" class="loading">Loading predicted jobs...</div>

    <div v-else-if="predictedJobs.length === 0" class="no-jobs">
      <h3>📝 No files awaiting processing</h3>
      <p>
        Drop files in the dropbox folder to see processing predictions here.
      </p>
    </div>

    <div v-else>
      <!-- Cost Summary -->
      <div class="cost-summary">
        <h3>💰 Cost Summary</h3>
        <div class="cost-info">
          <div class="cost-item">
            <span class="label">Selected Jobs:</span>
            <span class="value">{{ selectedJobCount }}</span>
          </div>
          <div class="cost-item">
            <span class="label">Total Estimated Cost:</span>
            <span class="value cost-amount"
              >${{ totalSelectedCost.toFixed(4) }}</span
            >
          </div>
        </div>

        <div class="batch-controls">
          <input
            v-model="batchName"
            type="text"
            placeholder="Batch name (optional)"
            class="batch-name-input"
          />
          <button
            @click="createAndExecuteBatch"
            :disabled="selectedJobCount === 0 || executing"
            class="btn btn-primary"
          >
            {{
              executing
                ? "Creating Batch..."
                : `Approve & Run ${selectedJobCount} Jobs`
            }}
          </button>
        </div>
      </div>

      <!-- Files and Processing Chains -->
      <div class="files-section">
        <h3>📁 Files Awaiting Approval ({{ predictedJobs.length }})</h3>

        <div class="files-list">
          <div v-for="job in predictedJobs" :key="job.fileId" class="file-item">
            <div class="file-header">
              <div class="file-info">
                <h4>{{ job.fileName }}</h4>
                <span class="file-path">{{ job.filePath }}</span>
                <div class="file-tags" v-if="job.fileTags.length > 0">
                  <span v-for="tag in job.fileTags" :key="tag" class="tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
              <div class="file-cost">
                <span class="total-cost"
                  >${{ job.totalEstimatedCost.toFixed(4) }}</span
                >
              </div>
            </div>

            <div class="processing-chain">
              <h5>Processing Chain:</h5>
              <div class="chain-steps">
                <div
                  v-for="(step, index) in job.predictedChain"
                  :key="index"
                  class="step"
                >
                  <div class="step-content">
                    <label class="step-checkbox">
                      <input
                        type="checkbox"
                        :checked="isStepSelected(job.fileId, step.parser)"
                        @change="
                          toggleStep(
                            job.fileId,
                            step.parser,
                            $event.target.checked
                          )
                        "
                      />
                      <span class="step-name">{{ step.parser }}</span>
                    </label>
                    <div class="step-details">
                      <span class="step-cost"
                        >${{ step.estimatedCost.toFixed(4) }}</span
                      >
                      <span class="step-output"
                        >→ {{ step.outputPath.split("/").pop() }}</span
                      >
                    </div>
                  </div>

                  <div
                    v-if="index < job.predictedChain.length - 1"
                    class="step-arrow"
                  >
                    ↓
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Batches -->
      <div v-if="activeBatches.length > 0" class="active-batches">
        <h3>🔄 Active Approval Batches</h3>
        <div class="batches-list">
          <div
            v-for="batch in activeBatches"
            :key="batch.id"
            class="batch-item"
          >
            <div class="batch-header">
              <h4>{{ batch.name || `Batch #${batch.id}` }}</h4>
              <span :class="`status status-${batch.status}`">{{
                batch.status
              }}</span>
            </div>

            <div class="batch-progress" v-if="batch.progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{ width: batch.progress.percentComplete + '%' }"
                ></div>
              </div>
              <span class="progress-text">
                {{ batch.progress.completedJobs }}/{{
                  batch.progress.totalJobs
                }}
                jobs complete
              </span>
            </div>

            <div class="batch-cost">
              <span>Estimated: ${{ batch.totalEstimatedCost.toFixed(4) }}</span>
              <span v-if="batch.actualCost > 0">
                | Actual: ${{ batch.actualCost.toFixed(4) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(true);
const executing = ref(false);
const queueMode = ref("auto");
const predictedJobs = ref([]);
const activeBatches = ref([]);
const selectedSteps = ref(new Map()); // Map of fileId -> Set of selected parser names
const batchName = ref("");

const selectedJobCount = computed(() => {
  let count = 0;
  for (const stepSet of selectedSteps.value.values()) {
    count += stepSet.size;
  }
  return count;
});

const totalSelectedCost = computed(() => {
  let total = 0;
  for (const job of predictedJobs.value) {
    const fileSteps = selectedSteps.value.get(job.fileId) || new Set();
    for (const step of job.predictedChain) {
      if (fileSteps.has(step.parser)) {
        total += step.estimatedCost;
      }
    }
  }
  return total;
});

async function loadQueueMode() {
  try {
    const response = await $fetch("/api/queue-mode");
    queueMode.value = response.queueMode;
  } catch (error) {
    console.error("Failed to load queue mode:", error);
  }
}

async function loadPredictedJobs() {
  try {
    loading.value = true;
    const response = await $fetch("/api/predicted-jobs");
    predictedJobs.value = response.predictedJobs;

    // Initialize selection state for each file
    for (const job of predictedJobs.value) {
      if (!selectedSteps.value.has(job.fileId)) {
        selectedSteps.value.set(job.fileId, new Set());
      }
    }
  } catch (error) {
    console.error("Failed to load predicted jobs:", error);
  } finally {
    loading.value = false;
  }
}

async function loadActiveBatches() {
  try {
    const allBatches = await $fetch("/api/approval-batches");
    activeBatches.value = allBatches.filter(
      (batch) => batch.status === "processing" || batch.status === "pending"
    );

    // Load progress for processing batches
    for (const batch of activeBatches.value) {
      if (batch.status === "processing") {
        try {
          const progress = await $fetch(
            `/api/approval-batches/${batch.id}/status`
          );
          batch.progress = progress.progress;
        } catch (error) {
          console.error(
            `Failed to load progress for batch ${batch.id}:`,
            error
          );
        }
      }
    }
  } catch (error) {
    console.error("Failed to load active batches:", error);
  }
}

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

function isStepSelected(fileId, parserName) {
  return selectedSteps.value.get(fileId)?.has(parserName) || false;
}

function toggleStep(fileId, parserName, checked) {
  if (!selectedSteps.value.has(fileId)) {
    selectedSteps.value.set(fileId, new Set());
  }

  const fileSteps = selectedSteps.value.get(fileId);
  if (checked) {
    fileSteps.add(parserName);
  } else {
    fileSteps.delete(parserName);
  }
}

async function createAndExecuteBatch() {
  if (selectedJobCount.value === 0) return;

  try {
    executing.value = true;

    // Create user selections array
    const userSelections = [];
    for (const job of predictedJobs.value) {
      const fileSteps = selectedSteps.value.get(job.fileId);
      if (fileSteps && fileSteps.size > 0) {
        userSelections.push({
          fileId: job.fileId,
          filePath: job.filePath,
          selectedSteps: Array.from(fileSteps),
          totalCost: job.predictedChain
            .filter((step) => fileSteps.has(step.parser))
            .reduce((sum, step) => sum + step.estimatedCost, 0),
        });
      }
    }

    const batchNameToUse =
      batchName.value || `Batch ${new Date().toISOString().split("T")[0]}`;

    // Create approval batch
    const batchResponse = await $fetch("/api/approval-batches", {
      method: "POST",
      body: {
        name: batchNameToUse,
        userSelections,
      },
    });

    // Execute the batch immediately
    await $fetch(
      `/api/approval-batches/${batchResponse.approvalBatch.id}/execute`,
      {
        method: "POST",
      }
    );

    // Clear selections and reload
    selectedSteps.value.clear();
    batchName.value = "";

    await loadPredictedJobs();
    await loadActiveBatches();
  } catch (error) {
    console.error("Failed to create and execute batch:", error);
  } finally {
    executing.value = false;
  }
}

// Load data on mount
onMounted(async () => {
  await Promise.all([
    loadQueueMode(),
    loadPredictedJobs(),
    loadActiveBatches(),
  ]);
});

// Auto-refresh every 10 seconds (client-side only)
onMounted(() => {
  if (import.meta.client) {
    setInterval(async () => {
      await loadActiveBatches();
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

.cost-summary {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.cost-info {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
}

.cost-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cost-amount {
  font-size: 18px;
  font-weight: bold;
  color: #2563eb;
}

.batch-controls {
  display: flex;
  gap: 15px;
  align-items: center;
}

.batch-name-input {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.files-section {
  margin-bottom: 40px;
}

.file-item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 20px;
  background: white;
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #f3f4f6;
}

.file-info h4 {
  margin: 0 0 5px 0;
  color: #111827;
}

.file-path {
  color: #6b7280;
  font-size: 14px;
}

.file-tags {
  margin-top: 8px;
}

.tag {
  background: #dbeafe;
  color: #1e40af;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  margin-right: 5px;
}

.file-cost {
  text-align: right;
}

.total-cost {
  font-size: 18px;
  font-weight: bold;
  color: #059669;
}

.processing-chain {
  padding: 20px;
}

.processing-chain h5 {
  margin: 0 0 15px 0;
  color: #374151;
}

.step {
  margin-bottom: 15px;
}

.step-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px 16px;
}

.step-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.step-name {
  font-weight: 500;
  color: #374151;
}

.step-details {
  display: flex;
  align-items: center;
  gap: 15px;
  font-size: 14px;
  color: #6b7280;
}

.step-cost {
  font-weight: 500;
  color: #059669;
}

.step-arrow {
  text-align: center;
  color: #9ca3af;
  font-size: 18px;
  margin: 5px 0;
}

.active-batches {
  margin-top: 40px;
}

.batch-item {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 15px;
}

.batch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.batch-header h4 {
  margin: 0;
  color: #111827;
}

.status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-processing {
  background: #dbeafe;
  color: #1e40af;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-failed {
  background: #fee2e2;
  color: #dc2626;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #6b7280;
}

.batch-cost {
  margin-top: 10px;
  font-size: 14px;
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
  background: #2563eb;
  color: white;
}

.btn-primary:hover {
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
