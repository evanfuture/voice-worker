import { DatabaseClient } from "../../../db/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);

    if (!body.name) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing required field: name",
      });
    }

    const db = new DatabaseClient(config.dbPath);

    // Check if configuration exists
    const existingConfig = db.getParserConfig(body.name);
    if (!existingConfig) {
      throw createError({
        statusCode: 404,
        statusMessage: "Parser configuration not found",
      });
    }

    // Delete the configuration
    db.deleteParserConfig(body.name);

    return {
      success: true,
      message: `Parser configuration "${body.name}" deleted successfully`,
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError errors
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to delete parser configuration",
    });
  }
});
