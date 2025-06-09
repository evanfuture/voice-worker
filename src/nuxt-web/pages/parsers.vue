<template>
  <div class="parsers-page">
    <div class="page-header">
      <h2>⚙️ Parser Configuration</h2>
      <p>
        Manage parser settings, dependencies, and create custom configurations
      </p>
    </div>

    <div v-if="loading" class="loading">Loading parser configurations...</div>

    <div v-else>
      <!-- Validation Warnings -->
      <div v-if="!validation.valid" class="validation-warnings">
        <h3>⚠️ Configuration Issues</h3>
        <ul>
          <li
            v-for="error in validation.errors"
            :key="error"
            class="error-item"
          >
            {{ error }}
          </li>
        </ul>
      </div>

      <!-- Parser Configurations List -->
      <div class="parsers-list">
        <div class="section-header">
          <h3>Current Parser Configurations</h3>
          <button @click="showCreateForm = true" class="btn btn-primary">
            ➕ Add New Parser
          </button>
        </div>

        <div class="parsers-grid">
          <div v-for="config in configs" :key="config.id" class="parser-card">
            <div class="parser-header">
              <div class="parser-title">
                <h4>{{ config.displayName }}</h4>
                <span class="parser-name">{{ config.name }}</span>
              </div>
              <div class="parser-status">
                <span
                  :class="`status-badge ${config.isEnabled ? 'enabled' : 'disabled'}`"
                >
                  {{ config.isEnabled ? "Enabled" : "Disabled" }}
                </span>
              </div>
            </div>

            <div class="parser-info">
              <p class="parser-description">
                {{ config.description || "No description" }}
              </p>

              <div class="parser-details">
                <div class="detail-group">
                  <strong>Input Extensions:</strong>
                  <div class="tags">
                    <span
                      v-for="ext in config.inputExtensions"
                      :key="ext"
                      class="tag"
                    >
                      {{ ext }}
                    </span>
                  </div>
                </div>

                <div v-if="config.inputTags.length > 0" class="detail-group">
                  <strong>Required Tags:</strong>
                  <div class="tags">
                    <span
                      v-for="tag in config.inputTags"
                      :key="tag"
                      class="tag tag-required"
                    >
                      {{ tag }}
                    </span>
                  </div>
                </div>

                <div class="detail-group">
                  <strong>Output:</strong>
                  <span class="output-ext">{{ config.outputExt }}</span>
                </div>

                <div v-if="config.dependsOn.length > 0" class="detail-group">
                  <strong>Dependencies:</strong>
                  <div class="tags">
                    <span
                      v-for="dep in config.dependsOn"
                      :key="dep"
                      class="tag tag-dependency"
                    >
                      {{ dep }}
                    </span>
                  </div>
                </div>

                <div class="detail-group">
                  <strong>User Selection:</strong>
                  <span
                    :class="`selection-mode ${config.allowUserSelection ? 'manual' : 'automatic'}`"
                  >
                    {{
                      config.allowUserSelection
                        ? "Manual Selection Allowed"
                        : "Automatic Only"
                    }}
                  </span>
                </div>

                <div class="detail-group">
                  <strong>Derived Files:</strong>
                  <span
                    :class="`selection-mode ${config.allowDerivedFiles ? 'allowed' : 'blocked'}`"
                  >
                    {{
                      config.allowDerivedFiles
                        ? "Can Process Derived Files"
                        : "Original Files Only"
                    }}
                  </span>
                </div>
              </div>
            </div>

            <div class="parser-actions">
              <button
                @click="editConfig(config)"
                class="btn btn-secondary btn-small"
              >
                Edit
              </button>
              <button
                @click="toggleEnabled(config)"
                :class="`btn btn-small ${config.isEnabled ? 'btn-warning' : 'btn-success'}`"
              >
                {{ config.isEnabled ? "Disable" : "Enable" }}
              </button>
              <button
                @click="deleteConfig(config)"
                class="btn btn-danger btn-small"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Create/Edit Form Modal -->
      <div
        v-if="showCreateForm || editingConfig"
        class="modal-overlay"
        @click="closeForm"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>
              {{
                editingConfig
                  ? "Edit Parser Configuration"
                  : "Create New Parser Configuration"
              }}
            </h3>
            <button @click="closeForm" class="close-btn">×</button>
          </div>

          <form @submit.prevent="saveConfig" class="config-form">
            <div class="form-group">
              <label>Parser Implementation:</label>
              <select
                v-model="formData.parserImplementation"
                required
                :disabled="!!editingConfig"
                @change="onParserImplementationChange"
              >
                <option value="">Select a parser implementation...</option>
                <option
                  v-for="parser in availableParsers"
                  :key="parser.name"
                  :value="parser.name"
                >
                  {{ parser.name }} ({{ parser.inputExtensions.join(", ") }} →
                  {{ parser.outputExt }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Configuration Name (unique identifier):</label>
              <input
                v-model="formData.name"
                type="text"
                required
                :disabled="!!editingConfig"
                placeholder="e.g., auto-summarize-transcripts"
              />
            </div>

            <div class="form-group">
              <label>Display Name:</label>
              <input v-model="formData.displayName" type="text" required />
            </div>

            <div class="form-group">
              <label>Description:</label>
              <textarea v-model="formData.description" rows="3"></textarea>
            </div>

            <div class="form-group">
              <label>Input Extensions (comma-separated):</label>
              <input
                v-model="inputExtensionsText"
                type="text"
                placeholder=".txt,.md,.pdf"
              />
            </div>

            <div class="form-group">
              <label>Required Tags (comma-separated):</label>
              <input
                v-model="inputTagsText"
                type="text"
                placeholder="reviewed,important"
              />
            </div>

            <div class="form-group">
              <label>Output Extension:</label>
              <input
                v-model="formData.outputExt"
                type="text"
                required
                placeholder=".summary.txt"
              />
            </div>

            <div class="form-group">
              <label>Dependencies (comma-separated parser names):</label>
              <input
                v-model="dependsOnText"
                type="text"
                placeholder="transcribe,analyze"
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input v-model="formData.allowUserSelection" type="checkbox" />
                Allow manual file selection by users
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input v-model="formData.allowDerivedFiles" type="checkbox" />
                Allow processing of derived/generated files (outputs from other
                parsers)
              </label>
            </div>

            <div class="form-actions">
              <button
                type="button"
                @click="closeForm"
                class="btn btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                {{ editingConfig ? "Update" : "Create" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
const loading = ref(true);
const configs = ref([]);
const validation = ref({ valid: true, errors: [] });
const availableParsers = ref([]);
const showCreateForm = ref(false);
const editingConfig = ref(null);

// Form data
const formData = ref({
  name: "",
  parserImplementation: "",
  displayName: "",
  description: "",
  outputExt: "",
  allowUserSelection: false,
  allowDerivedFiles: false,
});

const inputExtensionsText = ref("");
const inputTagsText = ref("");
const dependsOnText = ref("");

async function loadConfigs() {
  try {
    loading.value = true;
    const response = await $fetch("/api/parser-configs");
    configs.value = response.configs;
    validation.value = response.validation;
  } catch (error) {
    console.error("Failed to load parser configs:", error);
  } finally {
    loading.value = false;
  }
}

async function loadAvailableParsers() {
  try {
    const response = await $fetch("/api/available-parsers");
    availableParsers.value = response.parsers;
  } catch (error) {
    console.error("Failed to load available parsers:", error);
  }
}

function editConfig(config) {
  editingConfig.value = config;
  formData.value = {
    name: config.name,
    parserImplementation: config.name, // Assume config name matches parser implementation
    displayName: config.displayName,
    description: config.description,
    outputExt: config.outputExt,
    allowUserSelection: config.allowUserSelection,
    allowDerivedFiles: config.allowDerivedFiles,
  };
  inputExtensionsText.value = config.inputExtensions.join(", ");
  inputTagsText.value = config.inputTags.join(", ");
  dependsOnText.value = config.dependsOn.join(", ");
}

function onParserImplementationChange() {
  const selectedParser = availableParsers.value.find(
    (p) => p.name === formData.value.parserImplementation
  );

  if (selectedParser && !editingConfig.value) {
    // Pre-populate form with parser defaults
    formData.value.outputExt = selectedParser.outputExt;
    inputExtensionsText.value = selectedParser.inputExtensions.join(", ");
    dependsOnText.value = selectedParser.dependsOn.join(", ");

    // Generate a suggested config name
    if (!formData.value.name) {
      formData.value.name = `auto-${selectedParser.name}`;
    }
    if (!formData.value.displayName) {
      formData.value.displayName = `Auto ${selectedParser.name.charAt(0).toUpperCase() + selectedParser.name.slice(1)}`;
    }
  }
}

function closeForm() {
  showCreateForm.value = false;
  editingConfig.value = null;
  formData.value = {
    name: "",
    parserImplementation: "",
    displayName: "",
    description: "",
    outputExt: "",
    allowUserSelection: false,
    allowDerivedFiles: false,
  };
  inputExtensionsText.value = "";
  inputTagsText.value = "";
  dependsOnText.value = "";
}

async function saveConfig() {
  try {
    const configData = {
      ...formData.value,
      inputExtensions: inputExtensionsText.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      inputTags: inputTagsText.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
      dependsOn: dependsOnText.value
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s),
    };

    await $fetch("/api/parser-configs", {
      method: "POST",
      body: configData,
    });

    await loadConfigs();
    closeForm();
  } catch (error) {
    console.error("Failed to save config:", error);
    alert(
      "Failed to save configuration. Please check the console for details."
    );
  }
}

async function toggleEnabled(config) {
  try {
    await $fetch("/api/parser-configs", {
      method: "POST",
      body: {
        ...config,
        isEnabled: !config.isEnabled,
      },
    });
    await loadConfigs();
  } catch (error) {
    console.error("Failed to toggle config:", error);
  }
}

async function deleteConfig(config) {
  if (
    !confirm(
      `Are you sure you want to delete the parser configuration "${config.displayName}"? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    await $fetch("/api/parser-configs", {
      method: "DELETE",
      body: {
        name: config.name,
      },
    });
    await loadConfigs();
  } catch (error) {
    console.error("Failed to delete config:", error);
    alert(
      "Failed to delete configuration. Please check the console for details."
    );
  }
}

onMounted(() => {
  loadConfigs();
  loadAvailableParsers();
});
</script>

<style scoped>
.parsers-page {
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

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.validation-warnings {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 16px;
  margin-bottom: 24px;
}

.validation-warnings h3 {
  margin: 0 0 12px 0;
  color: #dc2626;
}

.validation-warnings ul {
  margin: 0;
  padding-left: 20px;
}

.error-item {
  color: #991b1b;
  margin-bottom: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h3 {
  margin: 0;
  color: #1f2937;
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

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-small {
  padding: 4px 8px;
  font-size: 0.875rem;
}

.parsers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.parser-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  background: #fafafa;
}

.parser-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.parser-title h4 {
  margin: 0 0 4px 0;
  color: #1f2937;
}

.parser-name {
  font-size: 0.875rem;
  color: #6b7280;
  font-family: monospace;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
}

.status-badge.enabled {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.disabled {
  background: #fee2e2;
  color: #991b1b;
}

.parser-description {
  color: #6b7280;
  font-size: 0.9em;
  margin-bottom: 16px;
}

.detail-group {
  margin-bottom: 12px;
}

.detail-group strong {
  display: block;
  color: #374151;
  font-size: 0.875rem;
  margin-bottom: 4px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  background: #e5e7eb;
  color: #374151;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.tag-required {
  background: #dbeafe;
  color: #1e40af;
}

.tag-dependency {
  background: #fef3c7;
  color: #92400e;
}

.output-ext {
  font-family: monospace;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.875rem;
}

.selection-mode {
  font-size: 0.875rem;
}

.selection-mode.manual {
  color: #059669;
}

.selection-mode.automatic {
  color: #6b7280;
}

.selection-mode.allowed {
  color: #059669;
}

.selection-mode.blocked {
  color: #dc2626;
}

.parser-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #1f2937;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6b7280;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.config-form {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #374151;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.875rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
}

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .parsers-grid {
    grid-template-columns: 1fr;
  }

  .section-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .parser-header {
    flex-direction: column;
    gap: 8px;
  }

  .modal-content {
    width: 95%;
    margin: 20px;
  }
}
</style>
