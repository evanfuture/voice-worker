import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all files for a folder
export const listByFolder = query({
  args: { folderId: v.string() },
  handler: async (ctx, args) => {
    // Return empty array if no valid folder ID provided
    if (!args.folderId) {
      return [];
    }

    return await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId as any))
      .collect();
  },
});

// Get files by type (audio, text, other)
export const listByType = query({
  args: { fileType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_type", (q) => q.eq("fileType", args.fileType as any))
      .collect();
  },
});

// Get input files only (not outputs)
export const listInputFiles = query({
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("files")
      .withIndex("by_output_flag", (q) => q.eq("isOutput", false));

    if (args.folderId) {
      // Filter further by folder if provided
      const allFiles = await query.collect();
      return allFiles.filter((file) => file.folderId === args.folderId);
    }

    return await query.collect();
  },
});

// Get output files only
export const listOutputFiles = query({
  args: { folderId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("files")
      .withIndex("by_output_flag", (q) => q.eq("isOutput", true));

    if (args.folderId) {
      const allFiles = await query.collect();
      return allFiles.filter((file) => file.folderId === args.folderId);
    }

    return await query.collect();
  },
});

// Get files by status
export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .collect();
  },
});

// Get a specific file
export const get = query({
  args: { id: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get file by path
export const getByPath = query({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();
  },
});

// Create or update file record
export const upsert = mutation({
  args: {
    path: v.string(),
    name: v.string(),
    folderId: v.id("folders"),
    sizeBytes: v.number(),
    fileType: v.string(),
    extension: v.string(),
    hash: v.string(),
    isOutput: v.boolean(),
    metadata: v.optional(
      v.object({
        estimatedDuration: v.optional(v.number()),
        actualDuration: v.optional(v.number()),
        wordCount: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if file already exists
    const existing = await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();

    if (existing) {
      // Update existing file if hash changed
      if (existing.hash !== args.hash) {
        await ctx.db.patch(existing._id, {
          sizeBytes: args.sizeBytes,
          fileType: args.fileType as any,
          extension: args.extension,
          hash: args.hash,
          isOutput: args.isOutput,
          status: "unprocessed",
          metadata: args.metadata,
          updatedAt: now,
        });
      }
      return existing._id;
    } else {
      // Create new file
      return await ctx.db.insert("files", {
        path: args.path,
        name: args.name,
        folderId: args.folderId,
        sizeBytes: args.sizeBytes,
        fileType: args.fileType as any,
        extension: args.extension,
        hash: args.hash,
        isOutput: args.isOutput,
        status: "unprocessed",
        metadata: args.metadata,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Update file status
export const updateStatus = mutation({
  args: {
    fileId: v.id("files"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      status: args.status as any,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
  },
});

// Delete a file record
export const remove = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.fileId);
  },
});

// Get files with their processing status and relationships
export const getWithDetails = query({
  args: { folderId: v.string() },
  handler: async (ctx, args) => {
    if (!args.folderId) {
      return [];
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId as any))
      .collect();

    // Enrich with relationship information
    const enriched = await Promise.all(
      files.map(async (file) => {
        // Get input relationships (if this is an output file)
        const inputRelationship = await ctx.db
          .query("file_relationships")
          .withIndex("by_output", (q) => q.eq("outputFileId", file._id))
          .first();

        // Get output relationships (if this is an input file)
        const outputRelationships = await ctx.db
          .query("file_relationships")
          .withIndex("by_input", (q) => q.eq("inputFileId", file._id))
          .collect();

        // Get associated jobs
        const jobs = await ctx.db
          .query("jobs")
          .withIndex("by_file", (q) => q.eq("fileId", file._id))
          .collect();

        return {
          ...file,
          inputRelationship,
          outputRelationships,
          jobs,
        };
      })
    );

    return enriched;
  },
});

// Mark file as deleted (for handling output file deletions)
export const markDeleted = mutation({
  args: { path: v.string() },
  handler: async (ctx, args) => {
    const file = await ctx.db
      .query("files")
      .withIndex("by_path", (q) => q.eq("path", args.path))
      .first();

    if (!file) {
      return null; // File not tracked
    }

    // If this is an output file, mark its relationship as broken
    if (file.isOutput) {
      const relationship = await ctx.db
        .query("file_relationships")
        .withIndex("by_output", (q) => q.eq("outputFileId", file._id))
        .first();

      if (relationship) {
        await ctx.db.patch(relationship._id, {
          status: "broken",
          updatedAt: Date.now(),
        });
      }
    }

    // Remove the file record
    await ctx.db.delete(file._id);
    return file;
  },
});

// Calculate cost estimate for unprocessed files
export const getCostEstimate = query({
  args: { folderId: v.string() },
  handler: async (ctx, args) => {
    // Return zero estimate if no valid folder ID provided
    if (!args.folderId) {
      return {
        fileCount: 0,
        totalDuration: 0,
        durationMinutes: 0,
        estimatedCost: 0,
      };
    }

    const files = await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId as any))
      .filter((q) => q.eq(q.field("status"), "unprocessed"))
      .collect();

    const totalDuration = files.reduce((sum, file) => {
      return sum + (file.metadata?.estimatedDuration || 0);
    }, 0);

    const durationMinutes = totalDuration / 60;
    const cost = durationMinutes * 0.006; // OpenAI Whisper pricing

    return {
      fileCount: files.length,
      totalDuration: totalDuration,
      durationMinutes: durationMinutes,
      estimatedCost: cost,
    };
  },
});

// Get unprocessed files for a folder
export const listUnprocessedByFolder = query({
  args: { folderId: v.string() },
  handler: async (ctx, args) => {
    if (!args.folderId) {
      return [];
    }
    return await ctx.db
      .query("files")
      .withIndex("by_folder", (q) => q.eq("folderId", args.folderId as any))
      .filter((q) => q.eq(q.field("status"), "unprocessed"))
      .collect();
  },
});
