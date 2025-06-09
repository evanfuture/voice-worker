import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// For development only: Clears chunks/jobs and resets file statuses.
export const cleanup = internalMutation({
  handler: async (ctx) => {
    // 1. Delete all chunks
    const allChunks = await ctx.db.query("chunks").collect();
    for (const chunk of allChunks) {
      await ctx.db.delete(chunk._id);
    }
    console.log(`Deleted ${allChunks.length} chunks.`);

    // 2. Delete all jobs
    const allJobs = await ctx.db.query("jobs").collect();
    for (const job of allJobs) {
      await ctx.db.delete(job._id);
    }
    console.log(`Deleted ${allJobs.length} jobs.`);

    // 3. Reset file statuses to "pending"
    const allFiles = await ctx.db.query("files").collect();
    for (const file of allFiles) {
      await ctx.db.patch(file._id, { status: "pending" });
    }
    console.log(`Reset ${allFiles.length} files to 'pending'.`);
  },
});
