import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Dropbox folders being monitored
  folders: defineTable({
    path: v.string(),
    name: v.string(),
    isMonitoring: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_path", ["path"]),

  // All files discovered in monitored folders (inputs + outputs)
  files: defineTable({
    path: v.string(),
    name: v.string(),
    folderId: v.id("folders"),
    sizeBytes: v.number(),
    fileType: v.union(
      v.literal("audio"), // .wav, .mp3, .m4a, etc.
      v.literal("text"), // .txt files (transcripts, summaries)
      v.literal("other") // other file types
    ),
    extension: v.string(), // .mp3, .txt, etc.
    status: v.union(
      v.literal("unprocessed"), // new file, no parsers applied
      v.literal("processing"), // currently being processed
      v.literal("completed"), // all applicable parsers completed
      v.literal("failed"), // parser failed
      v.literal("partial") // some parsers done, others pending/failed
    ),
    hash: v.string(), // for detecting file changes
    isOutput: v.boolean(), // true if this file is output from a parser
    errorMessage: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        estimatedDuration: v.optional(v.number()), // for audio files
        actualDuration: v.optional(v.number()),
        wordCount: v.optional(v.number()), // for text files
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_folder", ["folderId"])
    .index("by_status", ["status"])
    .index("by_path", ["path"])
    .index("by_type", ["fileType"])
    .index("by_output_flag", ["isOutput"]),

  // Parser definitions and configurations
  parsers: defineTable({
    name: v.string(), // "transcription", "summary", etc.
    displayName: v.string(), // "Audio Transcription", "Text Summarization"
    inputFileTypes: v.array(v.string()), // ["audio"] or ["text"]
    outputExtension: v.string(), // ".txt"
    outputSuffix: v.optional(v.string()), // "_summary" or "" (empty for transcription)
    isEnabled: v.boolean(),
    configuration: v.optional(
      v.object({
        apiKey: v.optional(v.string()),
        model: v.optional(v.string()),
        costPerMinute: v.optional(v.number()),
        costPerWord: v.optional(v.number()),
        settings: v.optional(v.object({})), // parser-specific settings
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_enabled", ["isEnabled"]),

  // Input file -> Output file relationships
  file_relationships: defineTable({
    inputFileId: v.id("files"),
    outputFileId: v.id("files"),
    parserId: v.id("parsers"),
    status: v.union(
      v.literal("pending"), // relationship created, not processed
      v.literal("completed"), // output file exists
      v.literal("broken") // output file was deleted
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_input", ["inputFileId"])
    .index("by_output", ["outputFileId"])
    .index("by_parser", ["parserId"])
    .index("by_status", ["status"]),

  // Processing jobs queue
  jobs: defineTable({
    fileId: v.id("files"), // input file to process
    parserId: v.id("parsers"),
    relationshipId: v.optional(v.id("file_relationships")),
    jobType: v.union(
      v.literal("parse"), // general parsing job
      v.literal("cleanup"), // cleanup/validation job
      v.literal("requeue") // re-queue due to output deletion
    ),
    status: v.union(
      v.literal("pending"), // in queue, not started
      v.literal("queued"), // ready to process
      v.literal("processing"), // currently processing
      v.literal("completed"), // finished successfully
      v.literal("failed"), // failed with error
      v.literal("paused"), // paused by user
      v.literal("cancelled") // cancelled by user
    ),
    priority: v.number(), // higher number = higher priority
    progress: v.number(), // 0-100
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        estimatedCost: v.optional(v.number()),
        actualCost: v.optional(v.number()),
        duration: v.optional(v.number()),
        outputPath: v.optional(v.string()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_file", ["fileId"])
    .index("by_parser", ["parserId"])
    .index("by_priority", ["priority"])
    .index("by_created", ["createdAt"]),

  // Cost tracking across all parsers
  cost_tracking: defineTable({
    sessionId: v.string(),
    parserId: v.id("parsers"),
    fileId: v.id("files"),
    jobId: v.id("jobs"),
    cost: v.number(),
    duration: v.optional(v.number()), // for time-based pricing
    units: v.optional(v.number()), // for unit-based pricing (words, etc.)
    filename: v.string(),
    outputPath: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_parser", ["parserId"])
    .index("by_file", ["fileId"])
    .index("by_date", ["createdAt"]),

  // Processing sessions for cost tracking
  sessions: defineTable({
    sessionId: v.string(),
    totalCost: v.number(),
    totalJobs: v.number(),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
  }).index("by_session", ["sessionId"]),

  // System events log for debugging and traceability
  events: defineTable({
    type: v.union(
      v.literal("file_added"),
      v.literal("file_deleted"),
      v.literal("file_modified"),
      v.literal("job_created"),
      v.literal("job_completed"),
      v.literal("parser_enabled"),
      v.literal("parser_disabled"),
      v.literal("output_deleted"), // triggers re-queuing
      v.literal("folder_scan")
    ),
    description: v.string(),
    entityId: v.optional(v.string()), // file ID, job ID, etc.
    metadata: v.optional(
      v.object({
        filePath: v.optional(v.string()),
        parserId: v.optional(v.string()),
        error: v.optional(v.string()),
        cost: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_date", ["createdAt"]),
});
