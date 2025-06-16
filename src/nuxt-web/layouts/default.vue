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
            to="/approval"
            class="nav-link"
            :class="{ active: $route.path === '/approval' }"
          >
            📋 Batch Approval
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
  background: var(--color-background-page);
}

.connection-status {
  position: sticky;
  top: 0;
  z-index: 1000;
  padding: var(--size-spacing-xs) var(--size-spacing-lg);
  text-align: center;
  font-size: var(--typography-font-size-sm);
  font-weight: var(--typography-font-weight-medium);
  transition: all 0.3s ease;
}

.connection-status.connected {
  background: var(--color-status-success);
  color: white;
}

.connection-status.disconnected {
  background: var(--color-status-error);
  color: white;
}

.navbar {
  background: var(--color-background-card);
  border-bottom: 1px solid var(--color-neutral-200);
  padding: var(--size-spacing-lg) 0;
  box-shadow: var(--shadow-sm);
}

.nav-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--size-spacing-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-brand h1 {
  margin: 0;
  font-size: var(--typography-font-size-xl);
  color: var(--color-text-primary);
}

.nav-brand p {
  margin: 0;
  font-size: var(--typography-font-size-sm);
  color: var(--color-text-secondary);
}

.nav-links {
  display: flex;
  gap: var(--size-spacing-2xl);
}

.nav-link {
  text-decoration: none;
  color: var(--color-text-secondary);
  font-weight: var(--typography-font-weight-medium);
  padding: var(--size-spacing-sm) var(--size-spacing-lg);
  border-radius: var(--size-border-radius-md);
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: var(--color-text-primary);
  background: var(--color-background-hover);
}

.nav-link.active {
  color: var(--color-brand-primary);
  background: var(--color-background-active);
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--size-spacing-xl);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    gap: var(--size-spacing-lg);
  }

  .nav-links {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--size-spacing-md);
  }

  .nav-link {
    font-size: var(--typography-font-size-sm);
    padding: var(--size-spacing-xs) var(--size-spacing-md);
  }
}
</style>
