import { getDbClient } from "../utils/db.js";

export default defineEventHandler(async (_event) => {
  try {
    console.log("🔍 Getting database client...");
    const db = getDbClient();

    console.log("🔍 Calling getPendingApprovalParses...");
    let pendingApprovalParses;
    try {
      pendingApprovalParses = db.getPendingApprovalParses();
      console.log("🔍 Got results:", pendingApprovalParses.length, "records");
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
      throw dbError;
    }

    // Get file information for each parse
    const jobsWithFileInfo = pendingApprovalParses.map((parse) => {
      const file = db.getFileById(parse.fileId);
      const fileTags = db.getFileTags(parse.fileId);

      return {
        fileId: parse.fileId,
        fileName: file?.path.split("/").pop() || "Unknown",
        filePath: file?.path || "Unknown",
        fileTags: fileTags.map((tag) => tag.tag),
        parser: parse.parser,
        status: parse.status,
        outputPath: parse.outputPath,
        updatedAt: parse.updatedAt,
        error: parse.error,
      };
    });

    db.close();

    return {
      jobs: jobsWithFileInfo,
      totalJobs: jobsWithFileInfo.length,
    };
  } catch (error) {
    console.error("Failed to get pending approval jobs:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get pending approval jobs",
    });
  }
});
