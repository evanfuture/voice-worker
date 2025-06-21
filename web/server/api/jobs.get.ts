import { QueueClient } from "../../../core/queue/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    const jobs = await queue.getJobs([
      "waiting",
      "active",
      "completed",
      "failed",
    ]);

    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      status: job.finishedOn
        ? "completed"
        : job.failedReason
          ? "failed"
          : job.processedOn
            ? "active"
            : "waiting",
      createdAt: job.timestamp,
      finishedAt: job.finishedOn,
      error: job.failedReason,
    }));

    return formattedJobs;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get jobs",
    });
  }
});
