import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all monitored folders
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("folders").collect();
  },
});

// Get a specific folder
export const get = query({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get folder by path
export const getByPath = query({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("folders")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();
  },
});

// Add a new folder to monitor
export const create = mutation({
  args: {
    path: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if folder already exists
    const existing = await ctx.db
      .query("folders")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();

    if (existing) {
      throw new Error("Folder is already being monitored");
    }

    return await ctx.db.insert("folders", {
      path: args.path,
      name: args.name,
      isMonitoring: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update folder monitoring status
export const updateMonitoringStatus = mutation({
  args: {
    id: v.id("folders"),
    isMonitoring: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isMonitoring: args.isMonitoring,
      updatedAt: Date.now(),
    });
  },
});

// Remove a folder from monitoring
export const remove = mutation({
  args: { id: v.id("folders") },
  handler: async (ctx, args) => {
    // Also remove all associated files and their chunks/jobs
    const files = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.id))
      .collect();

    for (const file of files) {
      // Remove chunks
      const chunks = await ctx.db
        .query("chunks")
        .withIndex("by_file", (q) => q.eq("fileId", file._id))
        .collect();

      for (const chunk of chunks) {
        await ctx.db.delete(chunk._id);
      }

      // Remove jobs
      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_file", (q) => q.eq("fileId", file._id))
        .collect();

      for (const job of jobs) {
        await ctx.db.delete(job._id);
      }

      // Remove file
      await ctx.db.delete(file._id);
    }

    // Remove folder
    await ctx.db.delete(args.id);
  },
});
