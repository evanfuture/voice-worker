/**
 * Shared utilities and services for Voice Worker
 * This module provides the unified service layer and configuration management
 */

export { ServiceLayer } from "./service-layer.js";
export { ConfigManager } from "./config.js";

// Re-export types for convenience
export type { ServiceConfig, SystemConfig } from "../types.js";
