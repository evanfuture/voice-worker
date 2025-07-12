import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api.js";
import type { Id } from "../../convex/_generated/dataModel.js";

/**
 * A client for interacting with the Convex database.
 *
 * This client provides a layer of abstraction over the raw Convex client,
 * making it easier to call our specific queries and mutations from the core application.
 */
export class DatabaseClient {
  private convex: ConvexHttpClient;

  constructor(deploymentUrl: string) {
    if (!deploymentUrl) {
      throw new Error("Convex deployment URL is required.");
    }
    this.convex = new ConvexHttpClient(deploymentUrl);
  }

  /**
   * Creates a new node in the graph.
   *
   * This function is idempotent. If a node with the same artifactPath already
   * exists, it will return the ID of the existing node.
   *
   * @param artifactPath - The path to the file artifact.
   * @param nodeType - The type of the node (e.g., 'video', 'transcript').
   * @returns The ID of the created or existing node.
   */
  async createNode(
    artifactPath: string,
    nodeType?: string
  ): Promise<Id<"nodes">> {
    return this.convex.mutation(api.nodes.create, { artifactPath, nodeType });
  }

  async getNode(id: Id<"nodes">) {
    return this.convex.query(api.nodes.get, { id });
  }

  async createEdge(sourceNodeId: Id<"nodes">, targetNodeId: Id<"nodes">) {
    return this.convex.mutation(api.edges.create, {
      sourceNodeId,
      targetNodeId,
    });
  }

  async updateNodeState(
    nodeId: Id<"nodes">,
    state: string,
    lastError?: string
  ) {
    return this.convex.mutation(api.nodes.updateState, {
      nodeId,
      state,
      lastError,
    });
  }

  /**
   * Deletes a node by its ID.
   * Used for cleaning up after tests.
   * @param id - The ID of the node to delete.
   */
  async deleteNode(id: Id<"nodes">): Promise<void> {
    await this.convex.mutation(api.nodes.deleteById, { id });
  }
}