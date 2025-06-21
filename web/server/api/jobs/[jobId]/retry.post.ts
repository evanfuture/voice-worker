import { QueueClient } from "../../../../../core/queue/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const jobId = getRouterParam(event, "jobId");

  if (!jobId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Job ID is required",
    });
  }

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    await queue.retryJob(jobId);

    return {
      success: true,
      message: `Job ${jobId} retried`,
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retry job",
    });
  }
});
