import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get active jobs (queued or processing)
export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const queuedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    const processingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    return [...queuedJobs, ...processingJobs].sort(
      (a, b) => b.priority - a.priority || b.createdAt - a.createdAt
    );
  },
});

// Get active jobs with associated file and parser details
export const listActiveWithDetails = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("jobs")
      .filter((q) => q.neq(q.field("status"), "completed"))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    const jobsWithDetails = await Promise.all(
      jobs.map(async (job) => {
        const file = await ctx.db.get(job.fileId);
        const parser = await ctx.db.get(job.parserId);
        return {
          ...job,
          fileName: file?.name || "Unknown File",
          parserName: parser?.displayName || "Unknown Parser",
          fileType: file?.fileType || "unknown",
        };
      })
    );

    return jobsWithDetails.sort(
      (a, b) => b.priority - a.priority || a.createdAt - b.createdAt
    );
  },
});

// Get all jobs for a file
export const listByFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();
  },
});

// Get jobs by parser
export const listByParser = query({
  args: { parserId: v.id("parsers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_parser", (q) => q.eq("parserId", args.parserId))
      .collect();
  },
});

// Get jobs by status
export const listByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .collect();
  },
});

// Create a parsing job
export const createParsingJob = mutation({
  args: {
    fileId: v.id("files"),
    parserId: v.id("parsers"),
    relationshipId: v.optional(v.id("file_relationships")),
    priority: v.optional(v.number()),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("jobs", {
      fileId: args.fileId,
      parserId: args.parserId,
      relationshipId: args.relationshipId,
      jobType: "parse",
      status: "queued",
      priority: args.priority || 1,
      progress: 0,
      metadata: {
        estimatedCost: args.estimatedCost,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Create re-queue job (when output file is deleted)
export const createRequeueJob = mutation({
  args: {
    fileId: v.id("files"),
    parserId: v.id("parsers"),
    relationshipId: v.id("file_relationships"),
    priority: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("jobs", {
      fileId: args.fileId,
      parserId: args.parserId,
      relationshipId: args.relationshipId,
      jobType: "requeue",
      status: "queued",
      priority: args.priority || 2, // Higher priority for re-queue jobs
      progress: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Create parsing jobs for all unprocessed files that match a parser
export const createJobsForParser = mutation({
  args: {
    parserId: v.id("parsers"),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const parser = await ctx.db.get(args.parserId);
    if (!parser || !parser.isEnabled) {
      throw new Error("Parser not found or disabled");
    }

    // Get files that match this parser's input types
    let files;
    if (args.folderId) {
      files = await ctx.db
        .query("files")
        .withIndex("by_folder", (q) => q.eq("folderId", args.folderId!))
        .filter((q) => q.eq(q.field("isOutput"), false))
        .filter((q) => q.eq(q.field("status"), "unprocessed"))
        .collect();
    } else {
      files = await ctx.db
        .query("files")
        .withIndex("by_output_flag", (q) => q.eq("isOutput", false))
        .filter((q) => q.eq(q.field("status"), "unprocessed"))
        .collect();
    }

    // Filter files by type that this parser can handle
    const applicableFiles = files.filter((file) =>
      parser.inputFileTypes.includes(file.fileType)
    );

    const jobIds = [];
    const now = Date.now();

    for (const file of applicableFiles) {
      const jobId = await ctx.db.insert("jobs", {
        fileId: file._id,
        parserId: args.parserId,
        jobType: "parse",
        status: "queued",
        priority: 1,
        progress: 0,
        createdAt: now,
        updatedAt: now,
      });
      jobIds.push(jobId);

      // Update file status to "processing"
      await ctx.db.patch(file._id, {
        status: "processing",
        updatedAt: now,
      });
    }

    return jobIds;
  },
});

// Update job status and progress
export const updateProgress = mutation({
  args: {
    id: v.id("jobs"),
    status: v.optional(v.string()),
    progress: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    outputPath: v.optional(v.string()),
    actualCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const updates: any = { updatedAt: now };

    if (args.status !== undefined) {
      updates.status = args.status;

      if (args.status === "processing") {
        updates.startedAt = now;
      } else if (args.status === "completed" || args.status === "failed") {
        updates.completedAt = now;
      }
    }

    if (args.progress !== undefined) {
      updates.progress = args.progress;
    }

    if (args.errorMessage !== undefined) {
      updates.errorMessage = args.errorMessage;
    }

    // Update metadata
    const job = await ctx.db.get(args.id);
    if (job) {
      const metadata = job.metadata || {};
      if (args.outputPath !== undefined) {
        metadata.outputPath = args.outputPath;
      }
      if (args.actualCost !== undefined) {
        metadata.actualCost = args.actualCost;
      }
      updates.metadata = metadata;
    }

    await ctx.db.patch(args.id, updates);
  },
});

// Pause all jobs for a file
export const pauseFileJobs = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .filter(
        (q) =>
          q.eq(q.field("status"), "queued") ||
          q.eq(q.field("status"), "processing")
      )
      .collect();

    for (const job of jobs) {
      await ctx.db.patch(job._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
    }
  },
});

// Resume all paused jobs for a file
export const resumeFileJobs = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .filter((q) => q.eq(q.field("status"), "paused"))
      .collect();

    for (const job of jobs) {
      await ctx.db.patch(job._id, {
        status: "queued",
        updatedAt: Date.now(),
      });
    }
  },
});

// Cancel all jobs for a file
export const cancelFileJobs = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .filter(
        (q) =>
          q.neq(q.field("status"), "completed") &&
          q.neq(q.field("status"), "cancelled")
      )
      .collect();

    for (const job of jobs) {
      await ctx.db.patch(job._id, {
        status: "cancelled",
        updatedAt: Date.now(),
      });
    }
  },
});

// Clear completed jobs (cleanup)
export const clearCompleted = mutation({
  args: {},
  handler: async (ctx) => {
    const completedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .collect();

    for (const job of completedJobs) {
      await ctx.db.delete(job._id);
    }

    return completedJobs.length;
  },
});

// Get next job to process (highest priority, oldest first)
export const getNextJob = query({
  args: {},
  handler: async (ctx) => {
    const queuedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();

    if (queuedJobs.length === 0) {
      return null;
    }

    // Sort by priority (descending) and then creation time (ascending)
    const sortedJobs = queuedJobs.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });

    // Enrich with file and parser details
    const nextJob = sortedJobs[0];
    const file = await ctx.db.get(nextJob.fileId);
    const parser = await ctx.db.get(nextJob.parserId);

    return {
      ...nextJob,
      file,
      parser,
    };
  },
});

// Get job queue statistics
export const getQueueStats = query({
  args: {},
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("jobs").collect();

    const stats = {
      total: allJobs.length,
      pending: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      cancelled: 0,
    };

    for (const job of allJobs) {
      switch (job.status) {
        case "pending":
          stats.pending++;
          break;
        case "queued":
          stats.queued++;
          break;
        case "processing":
          stats.processing++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "failed":
          stats.failed++;
          break;
        case "paused":
          stats.paused++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
      }
    }

    return stats;
  },
});

// Retry a failed job
export const retry = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "queued",
      errorMessage: undefined,
      progress: 0,
      updatedAt: Date.now(),
    });
  },
});

// Cancel a specific job
export const cancel = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
  },
});

// Reset stale processing jobs back to queued
export const resetStale = mutation({
  handler: async (ctx) => {
    const staleJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();

    for (const job of staleJobs) {
      await ctx.db.patch(job._id, {
        status: "queued",
        progress: 0,
        updatedAt: Date.now(),
      });
    }
    return staleJobs.length;
  },
});

// Get active jobs for a specific file
export const getActiveJobsForFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .filter((q) => q.neq(q.field("status"), "completed"))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    // Enrich with parser details
    const jobsWithParsers = await Promise.all(
      jobs.map(async (job) => {
        const parser = await ctx.db.get(job.parserId);
        return {
          ...job,
          parser,
        };
      })
    );

    return jobsWithParsers;
  },
});
