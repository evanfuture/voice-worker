<template>
  <div class="app-layout">
    <!-- Connection Status -->
    <div :class="connectionStatusClass">
      <span>{{ connectionStatusText }}</span>
    </div>

    <!-- Navigation Header -->
    <nav class="navbar">
      <div class="nav-container">
        <div class="nav-brand">
          <h1>🎙️ Voice Worker</h1>
          <p>File Processing & Queue Control</p>
        </div>

        <div class="nav-links">
          <NuxtLink
            to="/"
            class="nav-link"
            :class="{ active: $route.path === '/' }"
          >
            📊 Dashboard
          </NuxtLink>
          <NuxtLink
            to="/files"
            class="nav-link"
            :class="{ active: $route.path === '/files' }"
          >
            📁 Files & Tags
          </NuxtLink>
          <NuxtLink
            to="/parsers"
            class="nav-link"
            :class="{ active: $route.path === '/parsers' }"
          >
            ⚙️ Parser Config
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Page Content -->
    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { useWebSocket } from "@vueuse/core";

// Connection status management
const connected = ref(false);

// WebSocket connection for status
const wsProtocol =
  import.meta.client && window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = import.meta.client
  ? `${wsProtocol}//${window.location.host}/_ws`
  : "";

const { status } = useWebSocket(wsUrl, {
  autoReconnect: true,
  heartbeat: true,
});

// Watch WebSocket connection status
watch(status, (newStatus) => {
  connected.value = newStatus === "OPEN";
});

// Computed styles and text
const connectionStatusClass = computed(() => ({
  "connection-status": true,
  connected: connected.value,
  disconnected: !connected.value,
}));

const connectionStatusText = computed(() =>
  connected.value ? "🟢 Connected" : "🔴 Disconnected"
);
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #f8fafc;
}

.connection-status {
  position: sticky;
  top: 0;
  z-index: 1000;
  padding: 4px 16px;
  text-align: center;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: #10b981;
  color: white;
}

.connection-status.disconnected {
  background: #ef4444;
  color: white;
}

.navbar {
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 16px 0;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand h1 {
  margin: 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.nav-brand p {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.nav-links {
  display: flex;
  gap: 24px;
}

.nav-link {
  text-decoration: none;
  color: #6b7280;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #1f2937;
  background: #f3f4f6;
}

.nav-link.active {
  color: #2563eb;
  background: #dbeafe;
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    gap: 16px;
  }

  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }

  .nav-link {
    font-size: 0.875rem;
    padding: 6px 12px;
  }
}
</style>
