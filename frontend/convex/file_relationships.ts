import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all relationships for an input file
export const getByInput = query({
  args: { inputFileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("file_relationships")
      .withIndex("by_input", (q) => q.eq("inputFileId", args.inputFileId))
      .collect();
  },
});

// Get relationship for an output file
export const getByOutput = query({
  args: { outputFileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("file_relationships")
      .withIndex("by_output", (q) => q.eq("outputFileId", args.outputFileId))
      .first();
  },
});

// Get all broken relationships (where output files were deleted)
export const getBroken = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("file_relationships")
      .withIndex("by_status", (q) => q.eq("status", "broken"))
      .collect();
  },
});

// Create a new file relationship
export const create = mutation({
  args: {
    inputFileId: v.id("files"),
    outputFileId: v.id("files"),
    parserId: v.id("parsers"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("file_relationships", {
      inputFileId: args.inputFileId,
      outputFileId: args.outputFileId,
      parserId: args.parserId,
      status: args.status as any,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update relationship status
export const updateStatus = mutation({
  args: {
    relationshipId: v.id("file_relationships"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.relationshipId, {
      status: args.status as any,
      updatedAt: Date.now(),
    });
  },
});

// Mark relationship as broken (output file deleted)
export const markBroken = mutation({
  args: {
    outputFileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const relationship = await ctx.db
      .query("file_relationships")
      .withIndex("by_output", (q) => q.eq("outputFileId", args.outputFileId))
      .first();

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        status: "broken",
        updatedAt: Date.now(),
      });
      return relationship;
    }
    return null;
  },
});

// Clean up relationships for deleted files
export const cleanup = mutation({
  args: {
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    // Find all relationships involving this file
    const inputRelationships = await ctx.db
      .query("file_relationships")
      .withIndex("by_input", (q) => q.eq("inputFileId", args.fileId))
      .collect();

    const outputRelationships = await ctx.db
      .query("file_relationships")
      .withIndex("by_output", (q) => q.eq("outputFileId", args.fileId))
      .collect();

    // Delete all relationships
    for (const rel of [...inputRelationships, ...outputRelationships]) {
      await ctx.db.delete(rel._id);
    }

    return inputRelationships.length + outputRelationships.length;
  },
});

// Get relationships with full file and parser details
export const getWithDetails = query({
  args: { inputFileId: v.optional(v.id("files")) },
  handler: async (ctx, args) => {
    let relationships;

    if (args.inputFileId) {
      relationships = await ctx.db
        .query("file_relationships")
        .withIndex("by_input", (q) => q.eq("inputFileId", args.inputFileId!))
        .collect();
    } else {
      relationships = await ctx.db.query("file_relationships").collect();
    }

    // Enrich with file and parser details - filter out any with missing references
    const enriched = [];
    for (const rel of relationships) {
      const inputFile = await ctx.db.get(rel.inputFileId);
      const outputFile = await ctx.db.get(rel.outputFileId);
      const parser = await ctx.db.get(rel.parserId);

      // Only include relationships where all referenced entities exist
      if (inputFile && outputFile && parser) {
        enriched.push({
          ...rel,
          inputFile,
          outputFile,
          parser,
        });
      }
    }

    return enriched;
  },
});
