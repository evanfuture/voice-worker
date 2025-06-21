import { QueueClient } from "../../../core/queue/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    await queue.resumeQueue();

    return {
      success: true,
      message: "Queue resumed",
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to resume queue",
    });
  }
});
