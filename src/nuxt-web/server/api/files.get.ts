import { DatabaseClient } from "../../../db/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const db = new DatabaseClient(config.dbPath);
    const files = db.getAllFiles();

    return files;
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get files",
    });
  }
});
