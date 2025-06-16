import { DatabaseClient } from "../../../db/client.js";

export default defineEventHandler(async (_event) => {
  try {
    const db = new DatabaseClient("../../data.db");

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
