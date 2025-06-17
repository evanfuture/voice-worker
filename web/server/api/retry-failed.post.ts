import { DatabaseClient } from "../../../db/client.js";
import { unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);
    const { fileId, parser } = body;

    if (!fileId || !parser) {
      throw createError({
        statusCode: 400,
        statusMessage: "fileId and parser are required",
      });
    }

    const db = new DatabaseClient(config.dbPath);

    // Get the file record
    const file = db.getFileById(fileId);
    if (!file) {
      db.close();
      throw createError({
        statusCode: 404,
        statusMessage: "File not found",
      });
    }

    // Get the failed parse record
    const parse = db.getParse(fileId, parser);
    if (!parse || parse.status !== "failed") {
      db.close();
      throw createError({
        statusCode: 400,
        statusMessage: "Parse is not in failed state",
      });
    }

    // Simply delete the output file (if it exists) - the file watcher will handle re-processing
    let deletedOutput = false;
    if (parse.outputPath && existsSync(parse.outputPath)) {
      try {
        await unlink(parse.outputPath);
        deletedOutput = true;
        console.log(
          `🗑️ Deleted output file to trigger retry: ${parse.outputPath}`
        );
      } catch (error) {
        console.warn(
          `Failed to delete output file: ${parse.outputPath}`,
          error
        );
      }
    }

    // Reset the parse to pending and clear the error - the file watcher will re-queue
    db.upsertParse(fileId, parser, "pending");

    db.close();

    return {
      success: true,
      message: deletedOutput
        ? `Deleted output file for ${parser} on ${file.path} - file watcher will re-process`
        : `Reset ${parser} status for ${file.path} - file watcher will re-process`,
    };
  } catch (error) {
    console.error("Failed to retry job:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to retry job",
    });
  }
});
