import { DatabaseClient } from "../../../../../core/db/client.js";
import { QueueClient } from "../../../../../core/queue/client.js";
import type { UserSelection } from "../../../../../core/types.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const batchId = getRouterParam(event, "id");

  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Batch ID is required",
    });
  }

  try {
    const db = new DatabaseClient(config.dbPath);
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));

    const approvalBatch = db.getApprovalBatch(parseInt(batchId));

    if (!approvalBatch) {
      db.close();
      await queue.close();
      throw createError({
        statusCode: 404,
        statusMessage: "Approval batch not found",
      });
    }

    if (approvalBatch.status !== "pending") {
      db.close();
      await queue.close();
      throw createError({
        statusCode: 400,
        statusMessage: `Batch is already ${approvalBatch.status} and cannot be executed`,
      });
    }

    // Update batch status to processing
    db.updateApprovalBatch(approvalBatch.id, "processing");

    const userSelections = approvalBatch.userSelections
      .userSelections as UserSelection[];
    let jobsCreated = 0;

    // Create jobs for each user selection
    for (const selection of userSelections) {
      const file = db.getFileById(selection.fileId);
      if (!file) {
        console.warn(`File not found for ID ${selection.fileId}, skipping`);
        continue;
      }

      // Create parse records and queue jobs for selected steps
      for (const parserName of selection.selectedSteps) {
        // Mark parse as pending with approval batch ID
        db.upsertParse(
          file.id,
          parserName,
          "pending",
          undefined, // no output path yet
          undefined, // no error
          approvalBatch.id // link to approval batch
        );

        // Add job to queue
        await queue.enqueueJob(parserName, file.path);
        jobsCreated++;

        console.log(
          `📝 Queued ${parserName} for ${file.path} (batch ${approvalBatch.id})`
        );
      }
    }

    db.close();
    await queue.close();

    return {
      success: true,
      message: `Approval batch executed: ${jobsCreated} jobs created`,
      batchId: approvalBatch.id,
      jobsCreated,
      status: "processing",
    };
  } catch (error) {
    console.error("Failed to execute approval batch:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to execute approval batch",
    });
  }
});
