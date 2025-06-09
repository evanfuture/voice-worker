import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all parsers
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("parsers").collect();
  },
});

// Get enabled parsers only
export const listEnabled = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("parsers")
      .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
      .collect();
  },
});

// Get parsers that can process a specific file type
export const getForFileType = query({
  args: { fileType: v.string() },
  handler: async (ctx, args) => {
    const parsers = await ctx.db
      .query("parsers")
      .withIndex("by_enabled", (q) => q.eq("isEnabled", true))
      .collect();

    return parsers.filter((parser) =>
      parser.inputFileTypes.includes(args.fileType)
    );
  },
});

// Create or update a parser
export const upsert = mutation({
  args: {
    name: v.string(),
    displayName: v.string(),
    inputFileTypes: v.array(v.string()),
    outputExtension: v.string(),
    outputSuffix: v.optional(v.string()),
    isEnabled: v.boolean(),
    configuration: v.optional(
      v.object({
        apiKey: v.optional(v.string()),
        model: v.optional(v.string()),
        costPerMinute: v.optional(v.number()),
        costPerWord: v.optional(v.number()),
        settings: v.optional(v.object({})),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if parser already exists
    const existing = await ctx.db
      .query("parsers")
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      // Update existing parser
      await ctx.db.patch(existing._id, {
        displayName: args.displayName,
        inputFileTypes: args.inputFileTypes,
        outputExtension: args.outputExtension,
        outputSuffix: args.outputSuffix,
        isEnabled: args.isEnabled,
        configuration: args.configuration,
        updatedAt: now,
      });
      return existing._id;
    } else {
      // Create new parser
      return await ctx.db.insert("parsers", {
        name: args.name,
        displayName: args.displayName,
        inputFileTypes: args.inputFileTypes,
        outputExtension: args.outputExtension,
        outputSuffix: args.outputSuffix,
        isEnabled: args.isEnabled,
        configuration: args.configuration,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Enable or disable a parser
export const setEnabled = mutation({
  args: {
    parserId: v.id("parsers"),
    isEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.parserId, {
      isEnabled: args.isEnabled,
      updatedAt: Date.now(),
    });
  },
});

// Initialize default parsers if none exist
export const initializeDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const existingParsers = await ctx.db.query("parsers").collect();
    if (existingParsers.length > 0) {
      return; // Already initialized
    }

    const now = Date.now();

    // Create default transcription parser
    await ctx.db.insert("parsers", {
      name: "transcription",
      displayName: "Audio Transcription",
      inputFileTypes: ["audio"],
      outputExtension: ".txt",
      outputSuffix: "",
      isEnabled: true,
      configuration: {
        model: "whisper-1",
        costPerMinute: 0.006, // OpenAI Whisper pricing
        settings: {},
      },
      createdAt: now,
      updatedAt: now,
    });

    // Create default summary parser
    await ctx.db.insert("parsers", {
      name: "summary",
      displayName: "Text Summarization",
      inputFileTypes: ["text"],
      outputExtension: ".txt",
      outputSuffix: "_summary",
      isEnabled: true,
      configuration: {
        model: "gpt-3.5-turbo",
        costPerWord: 0.0000015, // Approximate GPT-3.5 pricing per word
        settings: {
          maxLength: 200,
          style: "concise",
        },
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});
