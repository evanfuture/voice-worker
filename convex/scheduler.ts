import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// A mapping from nodeType to the processor action that handles it.
const processorRouter = {
  video: internal.processors.convertVideo.run,
  audio: internal.processors.transcribe.run,
  transcript: internal.processors.summarize.run,
};

/**
 * An internal mutation that is called by a cron job to find and schedule
 * new nodes for processing.
 */
export const scheduleNewNodes = internalMutation({
  handler: async (ctx) => {
    // Find all nodes that are in the 'new' state.
    const newNodes = await ctx.db
      .query("nodes")
      .filter((q) => q.eq(q.field("state"), "new"))
      .collect();

    if (newNodes.length === 0) {
      return; // No new nodes to process
    }

    console.log(`[Scheduler] Found ${newNodes.length} new nodes to process.`);

    // Loop through the new nodes and schedule them for processing.
    for (const node of newNodes) {
      // Mark the node as 'processing' immediately to prevent re-scheduling.
      await ctx.db.patch(node._id, { state: "processing" });
      console.log(
        `  - Marked node ${node._id} (${node.artifactPath}) as 'processing'.`
      );

      const processor =
        processorRouter[node.nodeType as keyof typeof processorRouter];

      if (processor) {
        await ctx.scheduler.runAfter(0, processor, { nodeId: node._id });
        console.log(`  - Scheduled processor for node ${node._id}`);
      } else {
        console.warn(`  - No processor found for nodeType: '${node.nodeType}'`);
        // Optional: Mark node as failed if no processor is found
        await ctx.db.patch(node._id, {
          state: "failed",
          lastError: `No processor available for nodeType: ${node.nodeType}`,
        });
      }
    }
  },
});
