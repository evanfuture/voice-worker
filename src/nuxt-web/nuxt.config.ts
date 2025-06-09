// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@vueuse/nuxt"],
  typescript: {
    strict: false,
    typeCheck: false,
  },
  nitro: {
    experimental: {
      wasm: true,
      websocket: true,
    },
  },
  runtimeConfig: {
    // Server-side environment variables
    redisHost: process.env.REDIS_HOST || "localhost",
    redisPort: process.env.REDIS_PORT || "6379",
    dbPath: process.env.DB_PATH || "../../../data.db",
    public: {
      // Client-side environment variables
    },
  },
});
