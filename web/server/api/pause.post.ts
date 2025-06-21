import { QueueClient } from "../../../core/queue/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    await queue.pauseQueue();

    return {
      success: true,
      message: "Queue paused",
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to pause queue",
    });
  }
});
