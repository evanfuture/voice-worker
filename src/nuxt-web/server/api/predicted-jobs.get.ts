import { DatabaseClient } from "../../../db/client.js";
import { ParserConfigManager } from "../../../processors/config-manager.js";
import { ParserLoader } from "../../../processors/loader.js";

// OPTION C: Direct parser imports as backup for Nuxt context
import { parser as convertVideoParser } from "../../../processors/convert-video.js";
import { parser as transcribeParser } from "../../../processors/transcribe.js";
import { parser as summarizeParser } from "../../../processors/summarize.js";

export default defineEventHandler(async (_event) => {
  const _config = useRuntimeConfig();

  try {
    console.log("🔍 DEBUG: Starting predicted jobs API call");
    console.log(`🔍 DEBUG: Current working directory: ${process.cwd()}`);
    console.log(`🔍 DEBUG: ParserLoader path: ../processors`);
    console.log(`🔍 DEBUG: Database path: ../../data.db`);

    // Debug database path resolution
    const path = await import("node:path");
    const dbPath = path.resolve("../../data.db");
    const processorPath = path.resolve("../processors");
    console.log(`🔍 DEBUG: Resolved database path: ${dbPath}`);
    console.log(`🔍 DEBUG: Resolved processor path: ${processorPath}`);

    // Check if paths exist
    const fs = await import("node:fs");
    console.log(`🔍 DEBUG: Database exists: ${fs.existsSync(dbPath)}`);
    console.log(
      `🔍 DEBUG: Processor directory exists: ${fs.existsSync(processorPath)}`
    );

    const db = new DatabaseClient("../../data.db");
    const configManager = new ParserConfigManager(db);

    // Try both approaches: dynamic loading and direct imports
    const parserLoader = new ParserLoader("../processors");
    await parserLoader.loadParsers();
    let availableParsers = parserLoader.getAllParsers();

    console.log(
      `🔍 DEBUG: Dynamic loading result: ${availableParsers.size} parsers`
    );

    // If dynamic loading failed, use direct imports (Option C)
    if (availableParsers.size === 0) {
      console.log(
        "🔍 DEBUG: Dynamic loading failed, using direct imports (Option C)"
      );

      // Create parser map from direct imports
      availableParsers = new Map([
        [convertVideoParser.name, convertVideoParser],
        [transcribeParser.name, transcribeParser],
        [summarizeParser.name, summarizeParser],
      ]);

      console.log(
        `🔍 DEBUG: Direct imports result: ${availableParsers.size} parsers:`,
        Array.from(availableParsers.keys())
      );
    }

    // Load available parsers
    console.log("🔍 DEBUG: About to load parsers...");

    console.log(
      `🔍 DEBUG: Final available parsers: ${availableParsers.size}`,
      Array.from(availableParsers.keys())
    );

    if (availableParsers.size === 0) {
      console.error("🚨 DEBUG: Still no parsers available after fallback!");

      try {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const processorPath = path.resolve("../processors");
        console.log(`🔍 DEBUG: Resolved processor path: ${processorPath}`);

        const files = await fs.readdir(processorPath);
        console.log(`🔍 DEBUG: Files in processor directory:`, files);
      } catch (dirError) {
        console.error("🚨 DEBUG: Cannot access processor directory:", dirError);
      }
    }

    // Debug parser configs
    const allConfigs = db.getAllParserConfigs();
    const enabledConfigs = configManager.getEnabledConfigs();
    console.log(`🔍 DEBUG: Total parser configs in DB: ${allConfigs.length}`);
    console.log(`🔍 DEBUG: Enabled parser configs: ${enabledConfigs.length}`);
    console.log(
      `🔍 DEBUG: Enabled configs:`,
      enabledConfigs.map((c) => ({
        name: c.name,
        parserImplementation: c.parserImplementation,
        inputExtensions: c.inputExtensions,
        isEnabled: c.isEnabled,
      }))
    );

    // Get all predicted jobs
    const allFiles = db.getAllFiles();
    console.log(`🔍 DEBUG: Files in database: ${allFiles.length}`);
    console.log(
      `🔍 DEBUG: Sample files:`,
      allFiles.slice(0, 3).map((f) => ({
        id: f.id,
        path: f.path,
        extension: configManager.getFileExtension(f.path),
      }))
    );

    console.log(`🔍 Getting all predicted jobs for ${allFiles.length} files`);
    const predictedJobs =
      await configManager.getAllPredictedJobs(availableParsers);
    console.log(`🔍 Generated ${predictedJobs.length} predicted jobs`);

    // Debug a specific file if we have .mov files
    const movFiles = allFiles.filter((f) =>
      f.path.toLowerCase().endsWith(".mov")
    );
    if (movFiles.length > 0) {
      const testFile = movFiles[0];
      console.log(
        `🔍 DEBUG: Testing prediction for .mov file: ${testFile.path}`
      );

      const fileTags = db.getFileTags(testFile.id).map((tag) => tag.tag);
      const fileExtension = configManager.getFileExtension(testFile.path);

      console.log(`🔍 DEBUG: File extension: ${fileExtension}`);
      console.log(`🔍 DEBUG: File tags:`, fileTags);

      const applicableConfigs = configManager.getApplicableConfigs(
        testFile.path,
        fileTags,
        false
      );
      console.log(
        `🔍 DEBUG: Applicable configs for .mov file:`,
        applicableConfigs.map((c) => c.name)
      );

      const predictedChain = configManager.predictProcessingChain(
        testFile.path,
        fileTags,
        availableParsers
      );
      console.log(`🔍 DEBUG: Predicted chain for .mov file:`, predictedChain);
    }

    // Format the response with file information
    const formattedJobs = predictedJobs.map((predicted) => {
      const file = db.getFileById(predicted.fileId);
      const fileTags = db.getFileTags(predicted.fileId);

      return {
        id: predicted.id,
        fileId: predicted.fileId,
        filePath: file?.path || "Unknown",
        fileName: file?.path.split("/").pop() || "Unknown",
        fileTags: fileTags.map((tag) => tag.tag),
        predictedChain: predicted.predictedChain,
        estimatedCosts: predicted.estimatedCosts,
        totalEstimatedCost: Object.values(predicted.estimatedCosts).reduce(
          (sum, cost) => sum + cost,
          0
        ),
        dependencies: predicted.dependencies,
        isValid: predicted.isValid,
        createdAt: predicted.createdAt,
        updatedAt: predicted.updatedAt,
      };
    });

    db.close();

    return {
      predictedJobs: formattedJobs,
      totalFiles: formattedJobs.length,
      totalEstimatedCost: formattedJobs.reduce(
        (sum, job) => sum + job.totalEstimatedCost,
        0
      ),
    };
  } catch (error) {
    console.error("Failed to get predicted jobs:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
    }
    throw createError({
      statusCode: 500,
      statusMessage:
        "Failed to get predicted jobs: " +
        (error instanceof Error ? error.message : String(error)),
    });
  }
});
