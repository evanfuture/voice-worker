import { resetDbClient, getDbClient } from "../utils/db.js";

export default defineEventHandler(async (_event) => {
  try {
    // Force refresh the singleton
    console.log("🔄 Resetting database client singleton...");
    resetDbClient();

    // Get fresh instance with detailed logging
    console.log("🔧 Getting fresh database client...");
    const db = getDbClient();

    // Test basic query
    console.log("🔍 Testing basic query...");
    const allFiles = db.getAllFiles();
    console.log("📂 Found", allFiles.length, "files");

    // Test the specific failing query
    console.log("🔍 Testing pending approval query...");
    const pendingApproval = db.getPendingApprovalParses();
    console.log("⏳ Found", pendingApproval.length, "pending approval jobs");

    db.close();

    return {
      success: true,
      filesCount: allFiles.length,
      pendingApprovalCount: pendingApproval.length,
    };
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }
});
