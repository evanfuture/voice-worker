import { DatabaseClient } from "../../../db/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);
    const { queueMode } = body as { queueMode: string };

    if (!queueMode || !["auto", "approval"].includes(queueMode)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid queue mode. Must be 'auto' or 'approval'.",
      });
    }

    const db = new DatabaseClient(config.dbPath);

    // Set the queue mode setting
    db.setSetting("queue_mode", queueMode);

    db.close();

    return {
      success: true,
      queueMode,
      message: `Queue mode set to ${queueMode}`,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to set queue mode:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to set queue mode",
    });
  }
});
