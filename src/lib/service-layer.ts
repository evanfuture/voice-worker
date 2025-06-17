import { DatabaseClient } from "../db/client.js";
import { QueueClient } from "../queue/client.js";
import type { ServiceConfig } from "../types.js";

/**
 * Unified service layer that manages database and queue connections
 * Provides a single entry point for all data operations
 */
export class ServiceLayer {
  private dbClient: DatabaseClient;
  private queueClient: QueueClient;
  private config: ServiceConfig;
  private isInitialized = false;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.dbClient = new DatabaseClient(config.dbPath);
    this.queueClient = new QueueClient(config.redis.host, config.redis.port);
  }

  /**
   * Initialize the service layer and establish connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Database client initializes synchronously in constructor
      console.log("✅ Database client initialized");

      // Queue client may need async initialization
      console.log("✅ Queue client initialized");

      this.isInitialized = true;
      console.log("🚀 Service layer initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize service layer:", error);
      throw error;
    }
  }

  /**
   * Get the database client instance
   */
  get database(): DatabaseClient {
    this.ensureInitialized();
    return this.dbClient;
  }

  /**
   * Get the queue client instance
   */
  get queue(): QueueClient {
    this.ensureInitialized();
    return this.queueClient;
  }

  /**
   * Check if the service layer is properly initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Service layer not initialized. Call initialize() first."
      );
    }
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    console.log("🔄 Shutting down service layer...");

    try {
      await this.queueClient.close();
      console.log("✅ Queue client closed");

      this.dbClient.close();
      console.log("✅ Database client closed");

      this.isInitialized = false;
      console.log("✅ Service layer shutdown complete");
    } catch (error) {
      console.error("❌ Error during service layer shutdown:", error);
      throw error;
    }
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<{
    database: boolean;
    queue: boolean;
    overall: boolean;
  }> {
    const health = {
      database: false,
      queue: false,
      overall: false,
    };

    try {
      // Test database connection
      this.dbClient.getAllFiles();
      health.database = true;
    } catch (error) {
      console.warn("Database health check failed:", error);
    }

    try {
      // Test queue connection
      await this.queueClient.getJobCounts();
      health.queue = true;
    } catch (error) {
      console.warn("Queue health check failed:", error);
    }

    health.overall = health.database && health.queue;
    return health;
  }

  /**
   * Get service configuration
   */
  getConfig(): ServiceConfig {
    return { ...this.config };
  }
}
