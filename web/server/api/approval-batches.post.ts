import { DatabaseClient } from "../../../core/db/client.js";
import { ParserConfigManager } from "../../../core/lib/config-manager.js";
import type { UserSelection } from "../../../core/types.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);
    const { name, userSelections } = body as {
      name: string;
      userSelections: UserSelection[];
    };

    if (!name || !userSelections || !Array.isArray(userSelections)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Invalid request body. Expected name and userSelections array.",
      });
    }

    const db = new DatabaseClient(config.dbPath);
    const configManager = new ParserConfigManager(db);

    // Calculate total estimated cost for the batch
    const totalCost = configManager.calculateBatchCost(
      userSelections.map((sel) => ({
        fileId: sel.fileId,
        selectedSteps: sel.selectedSteps,
      }))
    );

    // Create the approval batch
    const approvalBatch = db.createApprovalBatch(
      name,
      { userSelections },
      totalCost
    );

    db.close();

    return {
      success: true,
      approvalBatch: {
        id: approvalBatch.id,
        name: approvalBatch.name,
        status: approvalBatch.status,
        totalEstimatedCost: approvalBatch.totalEstimatedCost,
        userSelections: approvalBatch.userSelections,
        createdAt: approvalBatch.createdAt,
      },
      message: `Approval batch "${name}" created with ${userSelections.length} file selections`,
    };
  } catch (error) {
    console.error("Failed to create approval batch:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to create approval batch",
    });
  }
});
