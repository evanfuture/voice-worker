#!/usr/bin/env node

import { config as dotenvConfig } from "dotenv";
dotenvConfig(); // Load environment variables from .env file

import { Command } from "commander";
import { QueueClient } from "../core/queue/client.js";
import { DatabaseClient } from "../core/db/client.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { JobType } from "bullmq";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = dirname(dirname(__dirname));

const program = new Command();

// Configuration
const config = {
  dbPath: join(projectRoot, "data.db"),
  redisHost: "127.0.0.1",
  redisPort: 6379,
};

program
  .name("voice-worker-cli")
  .description("CLI for managing the Voice Worker parsing system")
  .version("1.0.0");

program
  .command("status")
  .description("Show queue status and job counts")
  .action(async () => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      const counts = await queue.getJobCounts();
      console.log("Queue Status:");
      console.log(`  Waiting: ${counts.waiting}`);
      console.log(`  Active: ${counts.active}`);
      console.log(`  Completed: ${counts.completed}`);
      console.log(`  Failed: ${counts.failed}`);
      console.log(`  Delayed: ${counts.delayed}`);
    } catch (error) {
      console.error("Error getting queue status:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("pause")
  .description("Pause the job queue")
  .action(async () => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      await queue.pauseQueue();
      console.log("✅ Queue paused");
    } catch (error) {
      console.error("Error pausing queue:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("resume")
  .description("Resume the job queue")
  .action(async () => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      await queue.resumeQueue();
      console.log("✅ Queue resumed");
    } catch (error) {
      console.error("Error resuming queue:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("jobs")
  .description("List jobs in the queue")
  .option(
    "-t, --types <types>",
    "Job types to show (comma-separated)",
    "waiting,active,completed,failed"
  )
  .action(async (options: { types: string }) => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      const types = options.types.split(",") as JobType[];
      const jobs = await queue.getJobs(types);

      console.log(`Found ${jobs.length} jobs:`);
      for (const job of jobs) {
        console.log(
          `  ${job.id}: ${job.name} (${job.data.path}) - ${job.finishedOn ? "completed" : job.failedReason ? "failed" : "pending"}`
        );
      }
    } catch (error) {
      console.error("Error listing jobs:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("retry")
  .description("Retry a failed job")
  .argument("<jobId>", "Job ID to retry")
  .action(async (jobId) => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      await queue.retryJob(jobId);
      console.log(`✅ Job ${jobId} retried`);
    } catch (error) {
      console.error("Error retrying job:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("remove")
  .description("Remove a job from the queue")
  .argument("<jobId>", "Job ID to remove")
  .action(async (jobId) => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      await queue.removeJob(jobId);
      console.log(`✅ Job ${jobId} removed`);
    } catch (error) {
      console.error("Error removing job:", error);
    } finally {
      await queue.close();
    }
  });

program
  .command("db-status")
  .description("Show database status")
  .action(async () => {
    const db = new DatabaseClient(config.dbPath);
    try {
      // This would require adding methods to DatabaseClient
      console.log("Database Status:");
      console.log("(Database status commands would be implemented here)");
    } catch (error) {
      console.error("Error getting database status:", error);
    } finally {
      db.close();
    }
  });

program
  .command("clean")
  .description("Clean completed jobs and old data")
  .action(async () => {
    const queue = new QueueClient(config.redisHost, config.redisPort);
    try {
      // Clean old completed and failed jobs
      const jobs = await queue.getJobs(["completed", "failed"]);
      let cleaned = 0;
      for (const job of jobs) {
        if (
          job.finishedOn &&
          Date.now() - job.finishedOn > 24 * 60 * 60 * 1000
        ) {
          // older than 24h
          await queue.removeJob(job.id!);
          cleaned++;
        }
      }
      console.log(`✅ Cleaned ${cleaned} old jobs`);
    } catch (error) {
      console.error("Error cleaning:", error);
    } finally {
      await queue.close();
    }
  });

// Parse command line arguments
program.parse();
