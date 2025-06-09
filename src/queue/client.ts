import { Queue, Worker, QueueEvents, Job, type JobType } from "bullmq";
import { createClient } from "redis";
import type { RedisClientType } from "redis";
import type { JobData, Parser } from "../types.js";
import { calculateTranscriptionCost } from "../utils/cost-calculator.js";
import { statSync, existsSync } from "node:fs";

export class QueueClient {
  private queue: Queue;
  private worker: Worker | null = null;
  private queueEvents: QueueEvents;
  private redis: RedisClientType;

  constructor(redisHost: string, redisPort: number) {
    const connection = { host: redisHost, port: redisPort };

    this.queue = new Queue("parses", { connection });
    this.queueEvents = new QueueEvents("parses", { connection });
    this.redis = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });
    this.redis.connect().catch(console.error);
  }

  async enqueueJob(
    parser: string,
    filePath: string,
    priority = 0
  ): Promise<void> {
    const jobData: JobData = { path: filePath, parser };

    // Add cost calculation for transcription jobs
    if (parser === "transcribe" && existsSync(filePath)) {
      try {
        const stats = statSync(filePath);
        const costResult = calculateTranscriptionCost(filePath);

        jobData.fileSizeBytes = stats.size;
        jobData.estimatedCost = costResult.estimatedCost;
        jobData.estimatedDurationMinutes = costResult.estimatedDurationMinutes;

        console.log(
          `💰 Estimated cost for ${filePath}: $${costResult.estimatedCost.toFixed(4)} (${costResult.estimatedDurationMinutes.toFixed(1)}min)`
        );
      } catch (error) {
        console.warn(`Failed to calculate cost for ${filePath}:`, error);
      }
    }

    await this.queue.add(parser, jobData, {
      priority,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  async startWorker(
    redisHost: string,
    redisPort: number,
    parsers: Map<string, Parser>,
    onJobComplete?: (result: {
      outputPath: string;
      parser: string;
      inputPath: string;
    }) => void
  ): Promise<void> {
    if (this.worker) {
      throw new Error("Worker already started");
    }

    this.worker = new Worker<JobData>(
      "parses",
      async (job: Job<JobData>) => {
        const { path: filePath, parser: parserName } = job.data;
        const parser = parsers.get(parserName);

        if (!parser) {
          throw new Error(`Parser "${parserName}" not found`);
        }

        console.log(`Processing ${parserName} for ${filePath}`);
        const outputPath = await parser.run(filePath);
        console.log(`Completed ${parserName}: ${outputPath}`);

        return { outputPath, parser: parserName, inputPath: filePath };
      },
      {
        connection: this.queue.opts.connection,
        concurrency: 2,
      }
    );

    if (onJobComplete) {
      this.worker.on(
        "completed",
        (
          job: Job<JobData>,
          result: { outputPath: string; parser: string; inputPath: string }
        ) => {
          onJobComplete(result);
        }
      );
    }

    this.worker.on("failed", (job: Job<JobData> | undefined, err: Error) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
  }

  async getJobCounts() {
    return await this.queue.getJobCounts();
  }

  async isPaused(): Promise<boolean> {
    return await this.queue.isPaused();
  }

  async retryJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.retry();
    }
  }

  async removeJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
    }
  }

  async getJobs(
    types: JobType[] = ["waiting", "active", "completed", "failed"]
  ) {
    return await this.queue.getJobs(types);
  }

  async clearCompletedJobs(): Promise<number> {
    await this.queue.clean(0, 1000, "completed");
    await this.queue.clean(0, 1000, "failed");
    return 0; // BullMQ doesn't return count, but this signals success
  }

  async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    await this.queue.close();
    await this.queueEvents.close();
    await this.redis.quit();
  }
}
