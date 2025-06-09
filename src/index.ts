import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { DatabaseClient } from "./db/client.js";
import { QueueClient } from "./queue/client.js";
import { ParserLoader } from "./parsers/loader.js";
import { FileWatcher } from "./watcher/client.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Configuration
const config = {
  watchDir: join(projectRoot, "dropbox"),
  dbPath: join(projectRoot, "data.db"),
  redisHost: "127.0.0.1",
  redisPort: 6379,
  parsersDir: join(__dirname, "parsers"),
};

async function main() {
  console.log("🚀 Starting Voice Worker System");

  // Ensure watch directory exists
  if (!existsSync(config.watchDir)) {
    mkdirSync(config.watchDir, { recursive: true });
    console.log(`📁 Created watch directory: ${config.watchDir}`);
  }

  // Initialize components
  console.log("🔧 Initializing components...");

  const db = new DatabaseClient(config.dbPath);
  const queue = new QueueClient(config.redisHost, config.redisPort);
  const parserLoader = new ParserLoader(config.parsersDir);

  // Load parsers
  console.log("📦 Loading parsers...");
  await parserLoader.loadParsers();

  const parsers = parserLoader.getAllParsers();
  console.log(
    `✅ Loaded ${parsers.size} parsers: ${Array.from(parsers.keys()).join(", ")}`
  );

  // Set up job completion handler
  const handleJobComplete = (result: {
    outputPath: string;
    parser: string;
    inputPath: string;
  }) => {
    const { outputPath, parser: parserName, inputPath } = result;
    console.log(
      `🎯 Job completion handler called for ${parserName}: ${inputPath} → ${outputPath}`
    );

    // Find the file record
    const fileRecord = db.getFile(inputPath);
    if (fileRecord) {
      console.log(
        `🗃️  Found file record for ${inputPath}: id=${fileRecord.id}`
      );
      // Mark the parse as done
      console.log(
        `💾 Updating parse record: fileId=${fileRecord.id}, parser=${parserName}, status=done, outputPath=${outputPath}`
      );
      db.upsertParse(fileRecord.id, parserName, "done", outputPath);

      // Verify the update worked
      const updatedParse = db.getParse(fileRecord.id, parserName);
      console.log(`🔍 Parse record after update:`, updatedParse);
      console.log(`✅ Completed ${parserName}: ${outputPath}`);

      // Check if there are now other parsers that can be run
      const fileParses = db.getFileParses(fileRecord.id);
      const completedParsers = new Set(
        fileParses
          .filter((parse) => parse.status === "done")
          .map((parse) => parse.parser)
      );

      // Check for newly available parsers
      const readyParsers = parserLoader.getReadyParsers(
        inputPath,
        completedParsers
      );
      for (const readyParser of readyParsers) {
        const existingParse = db.getParse(fileRecord.id, readyParser.name);
        if (!existingParse || existingParse.status === "pending") {
          console.log(
            `🔄 Now ready to run ${readyParser.name} for ${inputPath}`
          );
          db.upsertParse(fileRecord.id, readyParser.name, "pending");
          queue.enqueueJob(readyParser.name, inputPath);
        }
      }
    } else {
      console.error(
        `❌ No file record found for ${inputPath} in job completion handler`
      );
    }
  };

  // Start queue worker
  console.log("⚡ Starting queue worker...");
  await queue.startWorker(
    config.redisHost,
    config.redisPort,
    parsers,
    handleJobComplete
  );

  // Start file watcher
  const watcher = new FileWatcher(config.watchDir, db, queue, parserLoader);
  console.log("👀 Starting file watcher...");
  await watcher.start();

  console.log(`
🎉 Voice Worker System is running!

📂 Drop files in: ${config.watchDir}
🗄️  Database: ${config.dbPath}
🔄 Queue: Redis at ${config.redisHost}:${config.redisPort}

Available parsers:
${Array.from(parsers.values())
  .map(
    (p) =>
      `  • ${p.name}: ${p.input.join(", ")} → ${p.outputExt}${p.dependsOn.length ? ` (depends on: ${p.dependsOn.join(", ")})` : ""}`
  )
  .join("\n")}

Press Ctrl+C to stop...
  `);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down...");
    await watcher.stop();
    await queue.close();
    db.close();
    console.log("✅ Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Error handling
process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("Failed to start system:", error);
  process.exit(1);
});
