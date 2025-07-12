import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Represents a single piece of content in the system, which corresponds
  // to an artifact on the file system.
  nodes: defineTable({
    artifactPath: v.string(),
    nodeType: v.optional(v.string()),
    state: v.string(), // e.g., 'new', 'processing', 'succeeded', 'failed', 'waiting_for_human_input', 'orphaned'
    costUSD: v.optional(v.float64()),
    lastError: v.optional(v.string()),
  }).index("by_artifactPath", ["artifactPath"]),

  // Represents the dependency relationship between two nodes.
  edges: defineTable({
    sourceNodeId: v.id("nodes"),
    targetNodeId: v.id("nodes"),
  })
    .index("by_source", ["sourceNodeId"])
    .index("by_target", ["targetNodeId"]),

  // Stores requests for human feedback that are blocking a node from proceeding.
  humanInputRequests: defineTable({
    nodeId: v.id("nodes"),
    prompt: v.string(),
    response: v.optional(v.any()), // Using v.any() for flexibility, can be tightened later.
    status: v.string(), // e.g., 'pending', 'completed', 'cancelled'
  }).index("by_nodeId", ["nodeId"]),
});
