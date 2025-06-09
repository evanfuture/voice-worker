<template>
  <div class="file-metadata-manager">
    <h3>File Management</h3>

    <div class="filters">
      <input
        v-model="tagFilter"
        placeholder="Filter by tag..."
        class="filter-input"
      />
      <button @click="loadFiles" class="refresh-btn">Refresh</button>
    </div>

    <div class="files-list">
      <div v-for="file in filteredFiles" :key="file.id" class="file-item">
        <div class="file-info">
          <h4>{{ getFileName(file.path) }}</h4>
          <p class="file-path">{{ file.path }}</p>
          <p class="file-meta">
            {{ file.kind }} • Created {{ formatDate(file.createdAt) }}
          </p>
        </div>

        <div class="file-tags">
          <div class="tags-section">
            <strong>Tags:</strong>
            <div class="tags">
              <span
                v-for="tag in file.tags"
                :key="tag.id"
                class="tag"
                :class="{ 'tag-with-value': tag.value }"
              >
                {{ tag.tag }}
                <span v-if="tag.value" class="tag-value"
                  >: {{ tag.value }}</span
                >
                <button @click="removeTag(file.id, tag.tag)" class="remove-tag">
                  ×
                </button>
              </span>
            </div>

            <div class="add-tag">
              <input
                v-model="newTag[file.id]"
                placeholder="Add tag..."
                @keyup.enter="addTag(file.id)"
                class="tag-input"
              />
              <input
                v-model="newTagValue[file.id]"
                placeholder="Value (optional)"
                @keyup.enter="addTag(file.id)"
                class="tag-value-input"
              />
              <button @click="addTag(file.id)" class="add-tag-btn">Add</button>
            </div>
          </div>

          <div class="metadata-section">
            <strong>Metadata:</strong>
            <div class="metadata">
              <div
                v-for="meta in file.metadata"
                :key="meta.id"
                class="metadata-item"
              >
                <span class="meta-key">{{ meta.key }}:</span>
                <span class="meta-value">{{ meta.value }}</span>
                <span class="meta-type">({{ meta.type }})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { FileRecordWithMetadata } from "../../types.js";

const files = ref<FileRecordWithMetadata[]>([]);
const tagFilter = ref("");
const newTag = ref<Record<number, string>>({});
const newTagValue = ref<Record<number, string>>({});

const filteredFiles = computed(() => {
  if (!tagFilter.value) return files.value;

  return files.value.filter((file) =>
    file.tags.some(
      (tag) =>
        tag.tag.toLowerCase().includes(tagFilter.value.toLowerCase()) ||
        (tag.value &&
          tag.value.toLowerCase().includes(tagFilter.value.toLowerCase()))
    )
  );
});

async function loadFiles() {
  try {
    const response = await $fetch("/api/files-with-metadata");
    files.value = response;
  } catch (error) {
    console.error("Failed to load files:", error);
  }
}

async function addTag(fileId: number) {
  const tag = newTag.value[fileId];
  if (!tag) return;

  try {
    await $fetch(`/api/files/${fileId}/tags`, {
      method: "POST",
      body: {
        tag: tag.trim(),
        value: newTagValue.value[fileId]?.trim() || undefined,
      },
    });

    newTag.value[fileId] = "";
    newTagValue.value[fileId] = "";
    await loadFiles();
  } catch (error) {
    console.error("Failed to add tag:", error);
  }
}

async function removeTag(fileId: number, tag: string) {
  try {
    await $fetch(`/api/files/${fileId}/tags`, {
      method: "DELETE",
      body: { tag },
    });
    await loadFiles();
  } catch (error) {
    console.error("Failed to remove tag:", error);
  }
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.file-metadata-manager {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
  max-width: 300px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.refresh-btn:hover {
  background: #0056b3;
}

.file-item {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 16px;
  background: white;
}

.file-info h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.file-path {
  color: #666;
  font-size: 0.9em;
  margin: 4px 0;
}

.file-meta {
  color: #888;
  font-size: 0.8em;
  margin: 4px 0;
}

.tags-section,
.metadata-section {
  margin: 16px 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0;
}

.tag {
  background: #e7f3ff;
  color: #0066cc;
  padding: 4px 8px;
  border-radius: 16px;
  font-size: 0.85em;
  display: flex;
  align-items: center;
  gap: 4px;
}

.tag-with-value {
  background: #f0f8e7;
  color: #4a7c59;
}

.tag-value {
  font-weight: bold;
}

.remove-tag {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  padding: 0;
  margin-left: 4px;
}

.remove-tag:hover {
  color: #ff4444;
}

.add-tag {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}

.tag-input,
.tag-value-input {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9em;
}

.tag-input {
  width: 120px;
}

.tag-value-input {
  width: 100px;
}

.add-tag-btn {
  padding: 6px 12px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
}

.add-tag-btn:hover {
  background: #218838;
}

.metadata {
  margin: 8px 0;
}

.metadata-item {
  display: flex;
  gap: 8px;
  margin: 4px 0;
  font-size: 0.9em;
}

.meta-key {
  font-weight: bold;
  color: #555;
}

.meta-value {
  color: #333;
}

.meta-type {
  color: #888;
  font-size: 0.8em;
}
</style>
