import { DatabaseClient } from "../../../db/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const db = new DatabaseClient(config.dbPath);

    // Get all files to correlate with their failed parses
    const allFiles = db.getAllFiles();
    const formattedFailures = [];

    for (const file of allFiles) {
      const fileParses = db.getFileParses(file.id);
      const failedParses = fileParses.filter(
        (parse) => parse.status === "failed"
      );

      for (const parse of failedParses) {
        formattedFailures.push({
          fileId: file.id,
          filePath: file.path,
          fileName: file.path.split("/").pop() || "Unknown",
          parser: parse.parser,
          status: parse.status,
          error: parse.error || "Unknown error",
          updatedAt: parse.updatedAt,
          approvalBatchId: parse.approvalBatchId,
          canRetry: true, // Most failures can be retried
        });
      }
    }

    // Sort by updated time (most recent first)
    formattedFailures.sort((a, b) => b.updatedAt - a.updatedAt);

    db.close();

    return {
      failures: formattedFailures,
      totalFailed: formattedFailures.length,
    };
  } catch (error) {
    console.error("Failed to get failed jobs:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get failed jobs",
    });
  }
});
