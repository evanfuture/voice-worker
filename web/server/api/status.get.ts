import { QueueClient } from "../../../queue/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    const counts = await queue.getJobCounts();
    const isPaused = await queue.isPaused();

    return {
      queue: counts,
      isPaused,
      timestamp: Date.now(),
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get status",
    });
  }
});
