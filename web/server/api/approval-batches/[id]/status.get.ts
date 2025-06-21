import { DatabaseClient } from "../../../../../core/db/client.js";

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

    const approvalBatch = db.getApprovalBatch(parseInt(batchId));

    if (!approvalBatch) {
      db.close();
      throw createError({
        statusCode: 404,
        statusMessage: "Approval batch not found",
      });
    }

    // Get related jobs for this batch
    const allParses = db.getPendingParses(); // This could be optimized with a query by approval_batch_id
    const batchJobs = allParses.filter(
      (parse) => parse.approvalBatchId === approvalBatch.id
    );

    // Calculate progress
    const totalJobs = batchJobs.length;
    const completedJobs = batchJobs.filter(
      (job) => job.status === "done"
    ).length;
    const failedJobs = batchJobs.filter(
      (job) => job.status === "failed"
    ).length;
    const activeJobs = batchJobs.filter(
      (job) => job.status === "processing"
    ).length;
    const pendingJobs = batchJobs.filter(
      (job) => job.status === "pending"
    ).length;

    db.close();

    return {
      approvalBatch: {
        id: approvalBatch.id,
        name: approvalBatch.name,
        status: approvalBatch.status,
        totalEstimatedCost: approvalBatch.totalEstimatedCost,
        actualCost: approvalBatch.actualCost,
        userSelections: approvalBatch.userSelections,
        createdAt: approvalBatch.createdAt,
        updatedAt: approvalBatch.updatedAt,
      },
      progress: {
        totalJobs,
        completedJobs,
        failedJobs,
        activeJobs,
        pendingJobs,
        percentComplete:
          totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      },
      jobs: batchJobs.map((job) => ({
        fileId: job.fileId,
        parser: job.parser,
        status: job.status,
        outputPath: job.outputPath,
        error: job.error,
        updatedAt: job.updatedAt,
      })),
    };
  } catch (error) {
    console.error("Failed to get approval batch status:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get approval batch status",
    });
  }
});
