import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Creates a new node in the graph.
 *
 * This function is idempotent. If a node with the same artifactPath already
 * exists, it will return the ID of the existing node without creating a new one.
 */
export const create = mutation({
  args: {
    artifactPath: v.string(),
    nodeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if a node with this path already exists.
    const existingNode = await ctx.db
      .query("nodes")
      .withIndex("by_artifactPath", (q) => q.eq("artifactPath", args.artifactPath))
      .unique();

    if (existingNode) {
      return existingNode._id;
    }

    // If it doesn't exist, create it.
    const nodeId = await ctx.db.insert("nodes", {
      artifactPath: args.artifactPath,
      nodeType: args.nodeType,
      state: "new",
    });

    return nodeId;
  },
});

/**
 * Updates the state of a specific node.
 * This is a central part of the processing lifecycle.
 */
export const updateState = mutation({
  args: {
    nodeId: v.id("nodes"),
    state: v.string(),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nodeId, {
      state: args.state,
      lastError: args.lastError,
    });
  },
});

/**
 * Retrieves a node by its unique artifactPath.
 * Used for testing and for checking for existing nodes.
 */
export const getByArtifactPath = query({
  args: {
    artifactPath: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nodes")
      .withIndex("by_artifactPath", (q) => q.eq("artifactPath", args.artifactPath))
      .unique();
  },
});

/**
 * Deletes a node by its ID.
 * Used for cleaning up after tests.
 */
export const deleteById = mutation({
  args: {
    id: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Retrieves a single node by its ID.
 */
export const get = query({
  args: { id: v.id("nodes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
