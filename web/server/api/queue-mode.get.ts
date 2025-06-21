import { DatabaseClient } from "../../../core/db/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const db = new DatabaseClient(config.dbPath);

    // Get queue mode setting (default to "auto" if not set)
    const queueMode = db.getSetting("queue_mode") || "auto";

    db.close();

    return {
      queueMode,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to get queue mode:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get queue mode",
    });
  }
});
