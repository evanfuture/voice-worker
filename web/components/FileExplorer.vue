<template>
  <div class="file-explorer">
    <div class="explorer-header">
      <div class="search-controls">
        <input
          v-model="searchQuery"
          placeholder="Search files..."
          class="search-input"
        />
        <select v-model="selectedView" class="view-selector">
          <option value="chains">Processing Chains</option>
          <option value="cards">Card View</option>
          <option value="list">List View</option>
        </select>
        <button @click="loadFiles" class="refresh-btn">
          <span>↻</span> Refresh
        </button>
      </div>

      <div class="filter-controls">
        <input
          v-model="tagFilter"
          placeholder="Filter by tag..."
          class="tag-filter"
        />
        <select v-model="kindFilter" class="kind-filter">
          <option value="">All Files</option>
          <option value="original">Original Files</option>
          <option value="derivative">Generated Files</option>
        </select>
      </div>
    </div>

    <!-- Processing chains view -->
    <div class="processing-chains" v-if="selectedView === 'chains'">
      <div
        v-for="rootFile in filteredChains"
        :key="rootFile.id"
        class="processing-chain"
      >
        <!-- Root file card (largest) -->
        <div class="chain-file-card level-0" :class="`${rootFile.kind}-file`">
          <div class="chain-file-header">
            <div class="file-icon">{{ getFileIcon(rootFile.path) }}</div>
            <div class="file-info">
              <h3 class="file-name">{{ getFileName(rootFile.path) }}</h3>
              <p class="file-path">{{ getRelativePath(rootFile.path) }}</p>
              <div class="processing-info">
                <span class="file-kind-badge" :class="rootFile.kind">{{
                  rootFile.kind
                }}</span>
                <span class="chain-info" v-if="rootFile.children.length > 0">
                  → {{ rootFile.children.length }} derivative{{
                    rootFile.children.length > 1 ? "s" : ""
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- Tags for root file -->
          <div class="file-tags">
            <div class="existing-tags">
              <span
                v-for="tag in rootFile.tags"
                :key="tag.id"
                class="tag"
                :class="{ 'tag-with-value': tag.value }"
              >
                {{ tag.tag }}
                <span v-if="tag.value" class="tag-value"
                  >: {{ tag.value }}</span
                >
                <button
                  @click="removeTag(rootFile.id, tag.tag)"
                  class="remove-tag"
                >
                  ×
                </button>
              </span>
            </div>
            <div class="add-tag-section">
              <input
                v-model="newTags[rootFile.id]"
                placeholder="Add tag..."
                @keyup.enter="addTag(rootFile.id)"
                class="tag-input"
              />
              <input
                v-model="newTagValues[rootFile.id]"
                placeholder="Value"
                @keyup.enter="addTag(rootFile.id)"
                class="tag-value-input"
              />
              <button @click="addTag(rootFile.id)" class="add-tag-btn">
                +
              </button>
            </div>
          </div>

          <!-- Children cascade -->
          <div v-if="rootFile.children.length > 0" class="children-cascade">
            <div
              v-for="child in rootFile.children"
              :key="child.id"
              class="chain-file-card"
              :class="[`level-${child.level}`, `${child.kind}-file`]"
            >
              <div class="chain-connector"></div>
              <div class="chain-file-header">
                <div class="file-icon">{{ getFileIcon(child.path) }}</div>
                <div class="file-info">
                  <h4 class="file-name">{{ getFileName(child.path) }}</h4>
                  <p class="processing-chain-info">
                    <span class="processor-badge">{{
                      child.processingChain[child.processingChain.length - 1]
                    }}</span>
                    → {{ getRelativePath(child.path) }}
                  </p>
                </div>
                <button
                  v-if="isVideoFile(child.path)"
                  @click="tagForVideoProcessing(child.id)"
                  class="process-video-btn"
                  title="Tag for video processing"
                >
                  🎬
                </button>
              </div>

              <!-- Tags for child -->
              <div class="file-tags">
                <div class="existing-tags">
                  <span
                    v-for="tag in child.tags"
                    :key="tag.id"
                    class="tag"
                    :class="{ 'tag-with-value': tag.value }"
                  >
                    {{ tag.tag }}
                    <span v-if="tag.value" class="tag-value"
                      >: {{ tag.value }}</span
                    >
                    <button
                      @click="removeTag(child.id, tag.tag)"
                      class="remove-tag"
                    >
                      ×
                    </button>
                  </span>
                </div>
                <div class="add-tag-section">
                  <input
                    v-model="newTags[child.id]"
                    placeholder="Add tag..."
                    @keyup.enter="addTag(child.id)"
                    class="tag-input"
                  />
                  <input
                    v-model="newTagValues[child.id]"
                    placeholder="Value"
                    @keyup.enter="addTag(child.id)"
                    class="tag-value-input"
                  />
                  <button @click="addTag(child.id)" class="add-tag-btn">
                    +
                  </button>
                </div>
              </div>

              <!-- Recursive children -->
              <div v-if="child.children.length > 0" class="children-cascade">
                <div
                  v-for="grandchild in child.children"
                  :key="grandchild.id"
                  class="chain-file-card"
                  :class="[
                    `level-${grandchild.level}`,
                    `${grandchild.kind}-file`,
                  ]"
                >
                  <div class="chain-connector"></div>
                  <div class="chain-file-header">
                    <div class="file-icon">
                      {{ getFileIcon(grandchild.path) }}
                    </div>
                    <div class="file-info">
                      <h5 class="file-name">
                        {{ getFileName(grandchild.path) }}
                      </h5>
                      <p class="processing-chain-info">
                        <span class="processor-badge">{{
                          grandchild.processingChain[
                            grandchild.processingChain.length - 1
                          ]
                        }}</span>
                        → {{ getRelativePath(grandchild.path) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Folder structure view -->
    <div class="folder-structure" v-else-if="selectedView === 'cards'">
      <div
        v-for="(folder, folderPath) in organizedFiles"
        :key="folderPath"
        class="folder-section"
      >
        <div class="folder-header" @click="toggleFolder(folderPath)">
          <span class="folder-icon">
            {{ expandedFolders[folderPath] ? "📂" : "📁" }}
          </span>
          <h3 class="folder-name">{{ getFolderDisplayName(folderPath) }}</h3>
          <span class="file-count">({{ folder.length }} files)</span>
        </div>

        <div v-show="expandedFolders[folderPath]" class="folder-content">
          <div class="files-grid">
            <div
              v-for="file in folder"
              :key="file.id"
              class="file-card"
              :class="{
                'original-file': file.kind === 'original',
                'derivative-file': file.kind === 'derivative',
              }"
            >
              <div class="file-header">
                <div class="file-icon">{{ getFileIcon(file.path) }}</div>
                <div class="file-info">
                  <h4 class="file-name">{{ getFileName(file.path) }}</h4>
                  <p class="file-path">{{ getRelativePath(file.path) }}</p>
                </div>
                <div class="file-kind-badge" :class="file.kind">
                  {{ file.kind }}
                </div>
              </div>

              <div class="file-tags">
                <div class="existing-tags">
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
                    <button
                      @click="removeTag(file.id, tag.tag)"
                      class="remove-tag"
                    >
                      ×
                    </button>
                  </span>
                </div>

                <div class="add-tag-section">
                  <input
                    v-model="newTags[file.id]"
                    placeholder="Add tag..."
                    @keyup.enter="addTag(file.id)"
                    class="tag-input"
                  />
                  <input
                    v-model="newTagValues[file.id]"
                    placeholder="Value (optional)"
                    @keyup.enter="addTag(file.id)"
                    class="tag-value-input"
                  />
                  <button @click="addTag(file.id)" class="add-tag-btn">
                    +
                  </button>
                </div>
              </div>

              <div class="file-metadata" v-if="file.metadata.length > 0">
                <details class="metadata-details">
                  <summary>Metadata ({{ file.metadata.length }})</summary>
                  <div class="metadata-list">
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
                </details>
              </div>

              <div class="file-actions">
                <span class="file-date">{{ formatDate(file.createdAt) }}</span>
                <div class="action-buttons">
                  <button
                    v-if="isVideoFile(file.path)"
                    @click="tagForVideoProcessing(file.id)"
                    class="process-video-btn"
                    title="Tag for video processing"
                  >
                    🎬 Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- List view (fallback to existing component) -->
    <div v-else class="list-view">
      <FileMetadataManager />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from "vue";
import type { FileRecordWithMetadata } from "../../core/types.js";
import FileMetadataManager from "./FileMetadataManager.vue";

interface FileWithChain extends FileRecordWithMetadata {
  children: FileWithChain[];
  level: number;
  processingChain: string[];
  parentPath?: string;
}

// State
const files = ref<FileRecordWithMetadata[]>([]);
const chains = ref<FileWithChain[]>([]);
const searchQuery = ref("");
const tagFilter = ref("");
const kindFilter = ref("");
const selectedView = ref("chains");
const expandedFolders = reactive<Record<string, boolean>>({});
const newTags = reactive<Record<number, string>>({});
const newTagValues = reactive<Record<number, string>>({});

// Computed
const filteredFiles = computed(() => {
  let filtered = files.value;

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (file) =>
        file.path.toLowerCase().includes(query) ||
        file.tags.some(
          (tag) =>
            tag.tag.toLowerCase().includes(query) ||
            (tag.value && tag.value.toLowerCase().includes(query))
        )
    );
  }

  // Tag filter
  if (tagFilter.value) {
    const tagQuery = tagFilter.value.toLowerCase();
    filtered = filtered.filter((file) =>
      file.tags.some(
        (tag) =>
          tag.tag.toLowerCase().includes(tagQuery) ||
          (tag.value && tag.value.toLowerCase().includes(tagQuery))
      )
    );
  }

  // Kind filter
  if (kindFilter.value) {
    filtered = filtered.filter((file) => file.kind === kindFilter.value);
  }

  return filtered;
});

const organizedFiles = computed(() => {
  const organized: Record<string, FileRecordWithMetadata[]> = {};

  filteredFiles.value.forEach((file) => {
    const folderPath = getFolderPath(file.path);
    if (!organized[folderPath]) {
      organized[folderPath] = [];
    }
    organized[folderPath].push(file);
  });

  // Sort files within each folder
  Object.keys(organized).forEach((folderPath) => {
    organized[folderPath].sort((a, b) => a.path.localeCompare(b.path));
  });

  return organized;
});

const filteredChains = computed(() => {
  let filtered = chains.value;

  // Apply same filters as regular files
  if (searchQuery.value) {
    filtered = filterChainsBySearch(filtered, searchQuery.value);
  }

  if (tagFilter.value) {
    filtered = filterChainsByTag(filtered, tagFilter.value);
  }

  if (kindFilter.value) {
    filtered = filterChainsByKind(filtered, kindFilter.value);
  }

  return filtered;
});

// Filter functions for chains
function filterChainsBySearch(
  chainList: FileWithChain[],
  query: string
): FileWithChain[] {
  const lowerQuery = query.toLowerCase();
  return chainList.filter((chain) => {
    const matchesChain = (file: FileWithChain): boolean => {
      const matches =
        file.path.toLowerCase().includes(lowerQuery) ||
        file.tags.some(
          (tag) =>
            tag.tag.toLowerCase().includes(lowerQuery) ||
            (tag.value && tag.value.toLowerCase().includes(lowerQuery))
        );
      return matches || file.children.some(matchesChain);
    };
    return matchesChain(chain);
  });
}

function filterChainsByTag(
  chainList: FileWithChain[],
  tagQuery: string
): FileWithChain[] {
  const lowerQuery = tagQuery.toLowerCase();
  return chainList.filter((chain) => {
    const matchesChain = (file: FileWithChain): boolean => {
      const matches = file.tags.some(
        (tag) =>
          tag.tag.toLowerCase().includes(lowerQuery) ||
          (tag.value && tag.value.toLowerCase().includes(lowerQuery))
      );
      return matches || file.children.some(matchesChain);
    };
    return matchesChain(chain);
  });
}

function filterChainsByKind(
  chainList: FileWithChain[],
  kind: string
): FileWithChain[] {
  return chainList.filter((chain) => {
    const matchesChain = (file: FileWithChain): boolean => {
      return file.kind === kind || file.children.some(matchesChain);
    };
    return matchesChain(chain);
  });
}

// Methods
async function loadFiles() {
  try {
    const response = await $fetch("/api/files-with-metadata");
    files.value = response;

    // Also load chains data
    const chainsResponse = await $fetch("/api/files-with-chains");
    chains.value = chainsResponse;

    // Auto-expand folders on first load
    Object.keys(organizedFiles.value).forEach((folderPath) => {
      if (!(folderPath in expandedFolders)) {
        expandedFolders[folderPath] = true;
      }
    });
  } catch (error) {
    console.error("Failed to load files:", error);
  }
}

async function addTag(fileId: number) {
  const tag = newTags[fileId];
  if (!tag) return;

  try {
    await $fetch(`/api/files/${fileId}/tags`, {
      method: "POST",
      body: {
        tag: tag.trim(),
        value: newTagValues[fileId]?.trim() || undefined,
      },
    });

    newTags[fileId] = "";
    newTagValues[fileId] = "";
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

async function tagForVideoProcessing(fileId: number) {
  try {
    await $fetch(`/api/files/${fileId}/tags`, {
      method: "POST",
      body: {
        tag: "process-video",
        value: "ready",
      },
    });
    await loadFiles();
  } catch (error) {
    console.error("Failed to tag for video processing:", error);
  }
}

function toggleFolder(folderPath: string) {
  expandedFolders[folderPath] = !expandedFolders[folderPath];
}

function getFolderPath(filePath: string): string {
  const parts = filePath.split("/");
  return parts.slice(0, -1).join("/") || "Root";
}

function getFolderDisplayName(folderPath: string): string {
  if (folderPath === "Root") return "📁 Root Directory";
  return folderPath.split("/").pop() || folderPath;
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getRelativePath(path: string): string {
  // Remove the dropbox/ prefix if present for cleaner display
  return path.replace(/^dropbox\//, "");
}

function getFileIcon(path: string): string {
  const ext = path.toLowerCase().split(".").pop();

  const icons: Record<string, string> = {
    mp4: "🎬",
    mov: "🎬",
    avi: "🎬",
    mkv: "🎬",
    mp3: "🎵",
    wav: "🎵",
    m4a: "🎵",
    flac: "🎵",
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    pdf: "📄",
    txt: "📝",
    doc: "📄",
    docx: "📄",
    zip: "📦",
    rar: "📦",
    tar: "📦",
    gz: "📦",
  };

  return icons[ext || ""] || "📄";
}

function isVideoFile(path: string): boolean {
  const ext = path.toLowerCase().split(".").pop();
  return ["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(ext || "");
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

onMounted(() => {
  loadFiles();
});
</script>

<style scoped>
.file-explorer {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.explorer-header {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 24px;
  border: 1px solid #e9ecef;
}

.search-controls,
.filter-controls {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.filter-controls {
  margin-bottom: 0;
}

.search-input,
.tag-filter,
.view-selector,
.kind-filter {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-input {
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
  display: flex;
  align-items: center;
  gap: 4px;
}

.refresh-btn:hover {
  background: #0056b3;
}

.folder-section {
  margin-bottom: 32px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.folder-header {
  background: #f8f9fa;
  padding: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.folder-header:hover {
  background: #e9ecef;
}

.folder-name {
  margin: 0;
  color: #343a40;
  flex: 1;
}

.file-count {
  color: #6c757d;
  font-size: 0.9em;
}

.folder-content {
  padding: 16px;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.file-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  background: white;
  transition: all 0.2s ease;
}

.file-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

.file-card.original-file {
  border-left: 4px solid #28a745;
}

.file-card.derivative-file {
  border-left: 4px solid #17a2b8;
}

.file-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.file-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  margin: 0 0 4px 0;
  font-size: 1.1em;
  font-weight: 600;
  word-break: break-word;
}

.file-path {
  margin: 0;
  font-size: 0.85em;
  color: #6c757d;
  word-break: break-all;
}

.file-kind-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.75em;
  font-weight: 500;
  text-transform: uppercase;
  white-space: nowrap;
}

.file-kind-badge.original {
  background: #d4edda;
  color: #155724;
}

.file-kind-badge.derivative {
  background: #d1ecf1;
  color: #0c5460;
}

.file-tags {
  margin-bottom: 12px;
}

.existing-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 12px;
  font-size: 0.8em;
  border: 1px solid #dee2e6;
}

.tag.tag-with-value {
  background: #fff3cd;
  border-color: #ffeaa7;
}

.tag-value {
  color: #856404;
  font-weight: 500;
}

.remove-tag {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  font-size: 1.2em;
  line-height: 1;
  padding: 0;
  margin-left: 4px;
}

.remove-tag:hover {
  color: #c82333;
}

.add-tag-section {
  display: flex;
  gap: 4px;
}

.tag-input,
.tag-value-input {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85em;
}

.tag-input {
  flex: 1;
}

.tag-value-input {
  width: 80px;
}

.add-tag-btn {
  padding: 4px 8px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85em;
}

.add-tag-btn:hover {
  background: #218838;
}

.metadata-details {
  margin-bottom: 12px;
}

.metadata-details summary {
  cursor: pointer;
  font-size: 0.9em;
  color: #6c757d;
  margin-bottom: 8px;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 16px;
}

.metadata-item {
  font-size: 0.8em;
  display: flex;
  gap: 4px;
}

.meta-key {
  font-weight: 500;
  color: #495057;
}

.meta-value {
  color: #6c757d;
}

.meta-type {
  color: #adb5bd;
  font-style: italic;
}

.file-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #e9ecef;
}

.file-date {
  font-size: 0.8em;
  color: #6c757d;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.process-video-btn {
  padding: 4px 8px;
  background: #6f42c1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
}

.process-video-btn:hover {
  background: #5a32a3;
}

.list-view {
  margin-top: 24px;
}

/* Processing chains styles */
.processing-chains {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.processing-chain {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #e9ecef;
}

.chain-file-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #e0e0e0;
  transition: all 0.2s ease;
  position: relative;
}

.chain-file-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: #007bff;
}

/* Hierarchy levels with progressive sizing and indentation */
.chain-file-card.level-0 {
  font-size: 1.1em;
  border-width: 2px;
  margin-left: 0;
}

.chain-file-card.level-1 {
  font-size: 0.95em;
  margin-left: 32px;
  max-width: calc(100% - 32px);
}

.chain-file-card.level-2 {
  font-size: 0.85em;
  margin-left: 64px;
  max-width: calc(100% - 64px);
}

.chain-file-card.level-3 {
  font-size: 0.8em;
  margin-left: 96px;
  max-width: calc(100% - 96px);
}

/* File type styling */
.chain-file-card.original-file {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.chain-file-card.derivative-file {
  border-left: 4px solid #17a2b8;
  background: #f7fdff;
}

/* Chain connectors */
.chain-connector {
  position: absolute;
  left: -16px;
  top: 24px;
  width: 12px;
  height: 2px;
  background: #dee2e6;
}

.chain-connector::before {
  content: "";
  position: absolute;
  left: -16px;
  top: -12px;
  width: 2px;
  height: 24px;
  background: #dee2e6;
}

.chain-file-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.chain-file-header .file-icon {
  font-size: 1.5em;
  flex-shrink: 0;
}

.chain-file-header .file-info {
  flex: 1;
  min-width: 0;
}

.chain-file-header .file-name {
  margin: 0 0 4px 0;
  font-weight: 600;
  word-break: break-word;
}

.processing-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.chain-info {
  color: #6c757d;
  font-size: 0.9em;
  font-style: italic;
}

.processing-chain-info {
  margin: 0;
  font-size: 0.9em;
  color: #6c757d;
  display: flex;
  align-items: center;
  gap: 8px;
}

.processor-badge {
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: 500;
}

.children-cascade {
  margin-top: 16px;
  padding-left: 16px;
  border-left: 2px solid #e9ecef;
}

/* Responsive design for chains */
@media (max-width: 768px) {
  .chain-file-card.level-1,
  .chain-file-card.level-2,
  .chain-file-card.level-3 {
    margin-left: 16px;
    max-width: calc(100% - 16px);
  }

  .chain-file-header {
    flex-direction: column;
    gap: 8px;
  }

  .chain-file-header .file-info {
    order: 1;
  }
}
</style>
