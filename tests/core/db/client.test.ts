import { strict as assert } from "node:assert";
import { DatabaseClient } from "../../../core/db/client.js";
import "dotenv/config";
import { api } from "../../../convex/_generated/api.js";
import type { Id } from "../../../convex/_generated/dataModel.js";

async function runTest() {
  console.log("🚀 Starting database client integration test...");

  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable not set!");
  }

  const dbClient = new DatabaseClient(convexUrl);
  const testArtifactPath = `test/file-${Date.now()}.txt`;
  let nodeId: Id<"nodes"> | null = null;

  try {
    // 1. Create a new node
    console.log(`  - Creating node with path: ${testArtifactPath}`);
    nodeId = await dbClient.createNode(testArtifactPath, "test-file");
    assert.ok(nodeId, "Test Failed: createNode should return a valid ID.");
    console.log(`  - ✅ Node created successfully with ID: ${nodeId}`);

    // Wait for the query index to update.
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Fetch the node to verify creation
    console.log("  - Fetching node to verify creation...");
    // This shows how we can use the raw client for one-off queries
    const fetchedNode = await dbClient.convex.query(api.nodes.getByArtifactPath, {
      artifactPath: testArtifactPath,
    });
    assert.ok(fetchedNode, "Test Failed: getByArtifactPath should find the new node.");
    assert.strictEqual(fetchedNode.artifactPath, testArtifactPath, "Test Failed: Fetched node has incorrect path.");
    console.log("  - ✅ Node fetched successfully.");

  } finally {
    // 3. Clean up the test node
    if (nodeId) {
      console.log(`  - Cleaning up test node: ${nodeId}`);
      await dbClient.deleteNode(nodeId);
      console.log("  - ✅ Cleanup complete.");
    }
  }

  console.log("🎉 Integration test passed successfully!");
}

runTest().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});