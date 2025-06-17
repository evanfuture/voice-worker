import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from root .env file
config({ path: resolve(__dirname, "../../.env") });

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@vueuse/nuxt"],
  css: ["~/assets/tokens/dist/tokens.css"],
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
    dbPath: process.env.DB_PATH || "../../data.db",
    openaiApiKey: process.env.OPENAI_API_KEY,
    public: {
      // Client-side environment variables
    },
  },
});
