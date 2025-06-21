import { DatabaseClient } from "../../../core/db/client.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const db = new DatabaseClient(config.dbPath);

    const allBatches = db.getAllApprovalBatches();

    db.close();

    return allBatches.map((batch) => ({
      id: batch.id,
      name: batch.name,
      status: batch.status,
      totalEstimatedCost: batch.totalEstimatedCost,
      actualCost: batch.actualCost,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    }));
  } catch (error) {
    console.error("Failed to get approval batches:", error);

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get approval batches",
    });
  }
});
