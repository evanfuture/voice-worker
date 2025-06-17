#!/usr/bin/env node

/**
 * Test script for the unified service layer
 * Demonstrates configuration management and health checking
 */

import { ServiceLayer, ConfigManager } from "../../dist/core/lib/index.js";

async function testServiceLayer() {
  console.log("🧪 Testing Voice Worker Service Layer");
  console.log("=====================================");

  try {
    // Test configuration management
    const configManager = ConfigManager.getInstance();
    const serviceConfig = configManager.getServiceConfig();

    console.log("📋 Configuration:");
    console.log(`  Database: ${serviceConfig.dbPath}`);
    console.log(
      `  Redis: ${serviceConfig.redis.host}:${serviceConfig.redis.port}`
    );

    // Validate configuration
    const validation = configManager.validate();
    if (!validation.isValid) {
      console.log("❌ Configuration validation failed:");
      validation.errors.forEach((error) => console.log(`  - ${error}`));
      process.exit(1);
    }
    console.log("✅ Configuration validation passed");

    // Test service layer
    const serviceLayer = new ServiceLayer(serviceConfig);
    await serviceLayer.initialize();

    // Test health status
    const health = await serviceLayer.getHealthStatus();
    console.log("🏥 Health Status:");
    console.log(
      `  Database: ${health.database ? "✅ Healthy" : "❌ Unhealthy"}`
    );
    console.log(`  Queue: ${health.queue ? "✅ Healthy" : "❌ Unhealthy"}`);
    console.log(
      `  Overall: ${health.overall ? "✅ System Ready" : "❌ System Not Ready"}`
    );

    // Test basic operations
    console.log("🔄 Testing basic operations...");

    // Test database
    const files = serviceLayer.database.getAllFiles();
    console.log(`  Found ${files.length} files in database`);

    // Test queue
    const jobCounts = await serviceLayer.queue.getJobCounts();
    console.log(`  Queue status: ${JSON.stringify(jobCounts)}`);

    console.log("✅ Service layer test completed successfully");

    // Cleanup
    await serviceLayer.shutdown();
  } catch (error) {
    console.error("❌ Service layer test failed:", error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testServiceLayer();
}
