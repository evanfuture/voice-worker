import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ServiceConfig, SystemConfig } from "../types.js";

// Load environment variables
config();

/**
 * Configuration management for the Voice Worker system
 * Provides centralized configuration loading and validation
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private serviceConfig: ServiceConfig;
  private systemConfig: SystemConfig;

  private constructor() {
    this.serviceConfig = this.loadServiceConfig();
    this.systemConfig = this.loadSystemConfig();
  }

  /**
   * Get the singleton instance of ConfigManager
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load service layer configuration
   */
  private loadServiceConfig(): ServiceConfig {
    const dbPath = process.env.DB_PATH || resolve(process.cwd(), "data.db");
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

    return {
      dbPath,
      redis: {
        host: redisHost,
        port: redisPort,
      },
    };
  }

  /**
   * Load full system configuration
   */
  private loadSystemConfig(): SystemConfig {
    const watchDir = process.env.WATCH_DIR || resolve(process.cwd(), "dropbox");
    const dbPath = process.env.DB_PATH || resolve(process.cwd(), "data.db");
    const redisHost = process.env.REDIS_HOST || "localhost";
    const redisPort = parseInt(process.env.REDIS_PORT || "6379", 10);

    return {
      watchDir,
      dbPath,
      redisHost,
      redisPort,
    };
  }

  /**
   * Get service configuration for the service layer
   */
  getServiceConfig(): ServiceConfig {
    return { ...this.serviceConfig };
  }

  /**
   * Get full system configuration
   */
  getSystemConfig(): SystemConfig {
    return { ...this.systemConfig };
  }

  /**
   * Validate configuration and environment
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required environment variables
    if (!process.env.OPENAI_API_KEY) {
      errors.push("OPENAI_API_KEY environment variable is required");
    }

    // Check if watch directory exists
    if (!existsSync(this.systemConfig.watchDir)) {
      errors.push(
        `Watch directory does not exist: ${this.systemConfig.watchDir}`
      );
    }

    // Validate Redis configuration
    if (
      this.serviceConfig.redis.port < 1 ||
      this.serviceConfig.redis.port > 65535
    ) {
      errors.push(`Invalid Redis port: ${this.serviceConfig.redis.port}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get environment-specific configuration values
   */
  getEnvValue(key: string, defaultValue?: string): string | undefined {
    return process.env[key] || defaultValue;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === "development";
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }
}
