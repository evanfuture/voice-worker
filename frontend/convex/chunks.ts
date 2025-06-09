import { v } from "convex/values";
import { mutation, internalMutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    fileId: v.id("files"),
    chunkIndex: v.number(),
    startTime: v.number(),
    endTime: v.number(),
    status: v.string(),
    chunkPath: v.string(),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("chunks", {
      fileId: args.fileId,
      chunkIndex: args.chunkIndex,
      startTime: args.startTime,
      endTime: args.endTime,
      status: args.status as any,
      chunkPath: args.chunkPath,
      progress: args.progress,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const get = query({
  args: { id: v.id("chunks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chunks")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();
  },
});
