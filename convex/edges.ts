import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates a new edge in the graph, representing a dependency.
 */
export const create = mutation({
  args: {
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    // Avoid creating duplicate edges
    const existingEdge = await ctx.db
      .query("edges")
      .filter((q) =>
        q.and(
          q.eq(q.field("sourceNodeId"), args.sourceNodeId),
          q.eq(q.field("targetNodeId"), args.targetNodeId)
        )
      )
      .first();

    if (existingEdge) {
      return existingEdge._id;
    }

    return await ctx.db.insert("edges", {
      sourceNodeId: args.sourceNodeId,
      targetNodeId: args.targetNodeId,
    });
  },
});
