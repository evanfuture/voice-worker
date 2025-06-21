import { config as dotenvConfig } from "dotenv";
dotenvConfig(); // Load environment variables from .env file

import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

import { DatabaseClient } from "./db/client.js";
import { QueueClient } from "./queue/client.js";
import { ParserLoader } from "./processors/loader.js";
import { ParserConfigManager } from "./lib/config-manager.js";
import { FileWatcher } from "./watcher/client.js";
import { PromptWatcher } from "./watcher/prompt-watcher.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(__dirname);

// Configuration
const config = {
  watchDir: join(projectRoot, "dropbox"),
  promptsDir: join(projectRoot, "prompts"),
  dbPath: join(projectRoot, "data.db"),
  redisHost: "127.0.0.1",
  redisPort: 6379,
  processorsDir: join(__dirname, "processors"),
};

// Function to sync database parse records with actual queue state
async function syncDatabaseWithQueue(db: DatabaseClient, queue: QueueClient) {
  try {
    const queueJobs = await queue.getJobs(["waiting", "active"]);
    const allFiles = db.getAllFiles();

    let synced = 0;
    let deletedFiles = 0;
    let removedJobs = 0;

    // First, check for files in database that no longer exist on disk
    for (const file of allFiles) {
      if (!existsSync(file.path)) {
        console.log(`  🗑️  File no longer exists: ${file.path}`);

        // Remove any pending jobs for this file
        const jobsToRemove = queueJobs.filter(
          (job) => job.data.path === file.path
        );
        for (const job of jobsToRemove) {
          console.log(
            `    ❌ Removing orphaned job ${job.id}: ${job.name} for ${file.path}`
          );
          try {
            await queue.removeJob(job.id!);
            removedJobs++;
          } catch (error) {
            console.warn(`    ⚠️  Failed to remove job ${job.id}:`, error);
          }
        }

        // Remove file from database (this will cascade delete parses, tags, metadata)
        db.deleteFile(file.path);
        deletedFiles++;
        continue;
      }

      // For existing files, check parse records
      const fileParses = db.getFileParses(file.id);

      for (const parse of fileParses) {
        // If database says "pending" but there's no job in queue, mark as failed
        if (parse.status === "pending") {
          const hasQueueJob = queueJobs.some(
            (job) => job.name === parse.parser && job.data.path === file.path
          );

          if (!hasQueueJob) {
            // Reset to allow re-queuing
            console.log(
              `  🔄 Resetting orphaned parse: ${parse.parser} for ${file.path}`
            );
            db.upsertParse(
              file.id,
              parse.parser,
              "failed",
              undefined,
              "Process interrupted during restart"
            );
            synced++;
          }
        }
      }
    }

    // Summary
    const changes = [];
    if (deletedFiles > 0)
      changes.push(`${deletedFiles} deleted files cleaned up`);
    if (removedJobs > 0) changes.push(`${removedJobs} orphaned jobs removed`);
    if (synced > 0) changes.push(`${synced} orphaned parse records synced`);

    if (changes.length > 0) {
      console.log(`  ✅ Cleanup complete: ${changes.join(", ")}`);
    } else {
      console.log(`  ✅ Database and queue are in sync`);
    }
  } catch (error) {
    console.warn(`  ⚠️  Failed to sync database with queue:`, error);
  }
}

async function main() {
  console.log("🚀 Starting Voice Worker System");

  // Ensure watch directory exists
  if (!existsSync(config.watchDir)) {
    mkdirSync(config.watchDir, { recursive: true });
    console.log(`📁 Created watch directory: ${config.watchDir}`);
  }

  // Ensure prompts directory exists
  if (!existsSync(config.promptsDir)) {
    mkdirSync(config.promptsDir, { recursive: true });
    console.log(`📝 Created prompts directory: ${config.promptsDir}`);
  }

  // Initialize components
  console.log("🔧 Initializing components...");

  const db = new DatabaseClient(config.dbPath);
  // Run migrations once at startup
  db.runMigrationsIfNeeded();

  const queue = new QueueClient(config.redisHost, config.redisPort);
  const parserLoader = new ParserLoader(config.processorsDir);

  // Load parsers
  console.log("📦 Loading parsers...");
  await parserLoader.loadParsers();

  const parsers = parserLoader.getAllParsers();
  console.log(
    `✅ Loaded ${parsers.size} parsers: ${Array.from(parsers.keys()).join(", ")}`
  );

  // Initialize parser configurations from hardcoded parsers
  console.log("🔧 Initializing parser configurations...");
  const configManager = new ParserConfigManager(db);
  await configManager.initializeDefaultConfigs(parsers);

  // Set up job completion handler
  const handleJobComplete = async (result: {
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

      // Check queue mode before auto-enqueuing follow-up parsers
      const queueMode = db.getSetting("queue_mode") || "auto";

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

          if (queueMode === "approval") {
            console.log(
              `📋 Approval mode: ${readyParser.name} waiting for approval`
            );
            // Create job as pending_approval - waiting for user approval
            db.upsertParse(fileRecord.id, readyParser.name, "pending_approval");
          } else {
            // Auto mode: enqueue immediately as before
            db.upsertParse(fileRecord.id, readyParser.name, "pending");
            queue.enqueueJob(readyParser.name, inputPath);
          }
        }
      }
    } else {
      console.error(
        `❌ No file record found for ${inputPath} in job completion handler`
      );
    }
  };

  // Set up job failure handler
  const handleJobFailure = (failure: {
    jobId: string;
    parser: string;
    inputPath: string;
    error: string;
  }) => {
    const { jobId, parser: parserName, inputPath, error } = failure;
    console.log(
      `💥 Job failure handler called for ${parserName}: ${inputPath} - ${error}`
    );

    // Find the file record
    const fileRecord = db.getFile(inputPath);
    if (fileRecord) {
      console.log(
        `🗃️  Found file record for ${inputPath}: id=${fileRecord.id}`
      );

      // Mark the parse as failed with error message
      console.log(
        `💾 Updating parse record: fileId=${fileRecord.id}, parser=${parserName}, status=failed, error=${error}`
      );
      db.upsertParse(fileRecord.id, parserName, "failed", undefined, error);

      // Verify the update worked
      const updatedParse = db.getParse(fileRecord.id, parserName);
      console.log(`🔍 Parse record after failure update:`, updatedParse);
      console.log(`❌ Failed ${parserName}: ${error}`);
    } else {
      console.error(
        `❌ No file record found for ${inputPath} in job failure handler`
      );
    }
  };

  // Start queue worker
  console.log("⚡ Starting queue worker...");
  await queue.startWorker(
    config.redisHost,
    config.redisPort,
    parsers,
    db,
    handleJobComplete,
    handleJobFailure
  );

  // Clean up database state to match queue state
  console.log("🧹 Syncing database with queue state...");
  await syncDatabaseWithQueue(db, queue);

  // Start file watcher
  const watcher = new FileWatcher(config.watchDir, db, queue, parserLoader);
  console.log("👀 Starting file watcher...");
  await watcher.start();

  // Start prompt watcher
  const promptWatcher = new PromptWatcher(config.promptsDir, db);
  console.log("📝 Starting prompt watcher...");
  await promptWatcher.start();

  // Set up prompt change callback to potentially invalidate cached prompts
  promptWatcher.onPromptChange((filename, content) => {
    console.log(`📋 Prompt ${filename} changed (${content.length} characters)`);
    // TODO: Future enhancements could invalidate cached prompts here
  });

  console.log(`
🎉 Voice Worker System is running!

📂 Drop files in: ${config.watchDir}
📝 Prompts directory: ${config.promptsDir}
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
    await promptWatcher.stop();
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
