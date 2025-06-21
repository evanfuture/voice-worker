import { QueueClient } from "../../../core/queue/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    await queue.clearCompletedJobs();

    return {
      success: true,
      message: "Completed and failed jobs cleared",
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to clear completed jobs",
    });
  }
});
