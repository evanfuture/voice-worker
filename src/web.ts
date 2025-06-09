#!/usr/bin/env node

import { config as dotenvConfig } from "dotenv";
dotenvConfig(); // Load environment variables from .env file

import { WebServer } from "./web/server.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Configuration
const config = {
  dbPath: join(projectRoot, "data.db"),
  redisHost: "127.0.0.1",
  redisPort: 6379,
  webPort: 3000,
};

async function main() {
  console.log("🌐 Starting Voice Worker Web Interface...");

  const webServer = new WebServer(config);

  try {
    await webServer.start(config.webPort);

    console.log(`
🎉 Voice Worker Web Interface is running!

🌐 Open your browser: http://localhost:${config.webPort}
🗄️  Database: ${config.dbPath}
🔄 Queue: Redis at ${config.redisHost}:${config.redisPort}

Features:
  • Real-time queue status monitoring
  • Pause/Resume transcription queue
  • View and manage individual jobs
  • Cost control for transcription services

Press Ctrl+C to stop...
    `);

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down web interface...");
      await webServer.stop();
      console.log("✅ Shutdown complete");
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("❌ Failed to start web interface:", error);
    process.exit(1);
  }
}

main().catch(console.error);
