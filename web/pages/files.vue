<template>
  <div class="files-page">
    <div class="page-header">
      <h2>📁 Files & Tags</h2>
      <p>Manage file metadata, tags, and organization</p>
    </div>

    <FileMetadataManager />
  </div>
</template>

<script setup>
// No additional logic needed - the component handles everything
</script>

<style scoped>
.files-page {
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
</style>
