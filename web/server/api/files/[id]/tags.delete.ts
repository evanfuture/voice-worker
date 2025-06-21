import { DatabaseClient } from "../../../../../core/db/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const fileId = getRouterParam(event, "id");

  try {
    const body = await readBody(event);
    const db = new DatabaseClient(config.dbPath);

    if (!fileId || isNaN(Number(fileId))) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid file ID",
      });
    }

    if (!body.tag) {
      throw createError({
        statusCode: 400,
        statusMessage: "Tag is required",
      });
    }

    db.removeFileTag(Number(fileId), body.tag);
    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to remove file tag",
    });
  }
});
