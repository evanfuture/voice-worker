import type { DatabaseClient } from "../db/client.js";
import type {
  ParserConfig,
  Parser,
  ProcessingStep,
  PredictedJob,
} from "../types.js";
import {
  calculateTranscriptionCost,
  estimateSummarizationCost,
  formatCost,
} from "../utils/cost-calculator.js";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

export class ParserConfigManager {
  private db: DatabaseClient;

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Initialize default parser configurations from hardcoded parsers
   * This allows existing parsers to work while enabling configuration management
   */
  async initializeDefaultConfigs(
    hardcodedParsers: Map<string, Parser>
  ): Promise<void> {
    console.log("Initializing default parser configurations...");

    for (const [name, parser] of hardcodedParsers) {
      const existingConfig = this.db.getParserConfig(name);

      if (!existingConfig) {
        // Create default configuration from hardcoded parser
        const defaultConfig: Omit<
          ParserConfig,
          "id" | "createdAt" | "updatedAt"
        > = {
          name: parser.name,
          parserImplementation: parser.name, // Default: config name matches implementation name
          displayName: this.toDisplayName(parser.name),
          description: `Auto-generated configuration for ${parser.name} parser`,
          inputExtensions: parser.input,
          inputTags: [], // No tags required by default
          outputExt: parser.outputExt,
          dependsOn: parser.dependsOn,
          isEnabled: true,
          allowUserSelection: false, // Default to automatic based on extensions
          allowDerivedFiles: parser.name === "summarize", // Allow derived files for summarize parser by default
          config:
            parser.name === "summarize"
              ? { promptPath: "prompts/summarize.md" }
              : {}, // Parser-specific configuration
        };

        this.db.upsertParserConfig(defaultConfig);
        console.log(`  ✅ Created default config for parser: ${name}`);
      } else {
        console.log(`  📝 Config already exists for parser: ${name}`);
      }
    }
  }

  /**
   * Get all enabled parser configurations
   */
  getEnabledConfigs(): ParserConfig[] {
    return this.db.getAllParserConfigs().filter((config) => config.isEnabled);
  }

  /**
   * Get parser configurations that apply to a file based on extension and tags
   */
  getApplicableConfigs(
    filePath: string,
    fileTags: string[],
    isDerivative: boolean = false
  ): ParserConfig[] {
    const ext = this.getFileExtension(filePath);
    const enabledConfigs = this.getEnabledConfigs();

    return enabledConfigs.filter((config) => {
      // Check if file extension matches
      const extensionMatches = config.inputExtensions.includes(ext);

      // Check if required tags are present (if any)
      const tagsMatch =
        config.inputTags.length === 0 ||
        config.inputTags.every((requiredTag) => fileTags.includes(requiredTag));

      // Check if derived files are allowed for this config
      const derivativeAllowed = !isDerivative || config.allowDerivedFiles;

      return extensionMatches && tagsMatch && derivativeAllowed;
    });
  }

  /**
   * Get parser configurations that are ready to run (dependencies satisfied)
   */
  getReadyConfigs(
    filePath: string,
    fileTags: string[],
    completedParsers: Set<string>,
    isDerivative: boolean = false
  ): ParserConfig[] {
    const applicable = this.getApplicableConfigs(
      filePath,
      fileTags,
      isDerivative
    );

    return applicable.filter((config) => {
      // Check if all dependencies are completed
      return config.dependsOn.every((dep) => completedParsers.has(dep));
    });
  }

  /**
   * Get user-selectable parser configurations
   */
  getUserSelectableConfigs(): ParserConfig[] {
    return this.getEnabledConfigs().filter(
      (config) => config.allowUserSelection
    );
  }

  /**
   * Create a new parser configuration
   */
  createConfig(
    name: string,
    parserImplementation: string,
    displayName: string,
    description: string,
    inputExtensions: string[],
    inputTags: string[],
    outputExt: string,
    dependsOn: string[] = [],
    allowUserSelection: boolean = false,
    allowDerivedFiles: boolean = false,
    config: Record<string, any> = {}
  ): ParserConfig {
    const parserConfig: Omit<ParserConfig, "id" | "createdAt" | "updatedAt"> = {
      name,
      parserImplementation,
      displayName,
      description,
      inputExtensions,
      inputTags,
      outputExt,
      dependsOn,
      isEnabled: true,
      allowUserSelection,
      allowDerivedFiles,
      config,
    };

    return this.db.upsertParserConfig(parserConfig);
  }

  /**
   * Update parser configuration
   */
  updateConfig(
    name: string,
    updates: Partial<
      Omit<ParserConfig, "id" | "name" | "createdAt" | "updatedAt">
    >
  ): ParserConfig | null {
    const existing = this.db.getParserConfig(name);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
    };

    return this.db.upsertParserConfig(updated);
  }

  /**
   * Enable/disable a parser configuration
   */
  setConfigEnabled(name: string, enabled: boolean): boolean {
    const config = this.db.getParserConfig(name);
    if (!config) return false;

    this.updateConfig(name, { isEnabled: enabled });
    return true;
  }

  /**
   * Delete a parser configuration
   */
  deleteConfig(name: string): boolean {
    const config = this.db.getParserConfig(name);
    if (!config) return false;

    this.db.deleteParserConfig(name);
    return true;
  }

  /**
   * Validate parser configuration dependencies
   */
  validateDependencies(): { valid: boolean; errors: string[] } {
    const configs = this.db.getAllParserConfigs();
    const errors: string[] = [];
    const configNames = new Set(configs.map((c) => c.name));

    for (const config of configs) {
      for (const dep of config.dependsOn) {
        if (!configNames.has(dep)) {
          errors.push(
            `Parser "${config.name}" depends on missing parser "${dep}"`
          );
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const checkCircular = (name: string): boolean => {
      if (visited.has(name)) return false;
      if (visiting.has(name)) {
        errors.push(`Circular dependency detected involving parser "${name}"`);
        return true;
      }

      visiting.add(name);
      const config = configs.find((c) => c.name === name);
      if (config) {
        for (const dep of config.dependsOn) {
          if (checkCircular(dep)) return true;
        }
      }
      visiting.delete(name);
      visited.add(name);
      return false;
    };

    for (const config of configs) {
      checkCircular(config.name);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get dependency execution order for a parser
   */
  getDependencyOrder(parserName: string): string[] {
    const configs = this.db.getAllParserConfigs();
    const configMap = new Map(configs.map((c) => [c.name, c]));

    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(
          `Circular dependency detected involving parser "${name}"`
        );
      }

      visiting.add(name);
      const config = configMap.get(name);
      if (config) {
        for (const dep of config.dependsOn) {
          visit(dep);
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    visit(parserName);
    return order;
  }

  /**
   * Get parser configurations that are ready to run with actual parser implementations
   * This bridges database configs with file-based parser implementations
   */
  getReadyConfigsWithParsers(
    filePath: string,
    fileTags: string[],
    completedParsers: Set<string>,
    availableParsers: Map<string, Parser>,
    isDerivative: boolean = false
  ): Array<{ config: ParserConfig; parser: Parser }> {
    const readyConfigs = this.getReadyConfigs(
      filePath,
      fileTags,
      completedParsers,
      isDerivative
    );

    const results: Array<{ config: ParserConfig; parser: Parser }> = [];

    for (const config of readyConfigs) {
      const parser = availableParsers.get(config.parserImplementation);
      if (parser) {
        results.push({ config, parser });
      } else {
        console.warn(
          `Parser implementation not found for config: ${config.name} (looking for: ${config.parserImplementation})`
        );
      }
    }

    return results;
  }

  private toDisplayName(name: string): string {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  public getFileExtension(filePath: string): string {
    const filename = filePath.split("/").pop() || filePath;
    const parts = filename.split(".");

    if (parts.length <= 1) return "";

    // Check for common compound extensions first
    const compoundExtensions = [
      ".transcript.txt",
      ".combined.transcript.txt",
      ".summary.txt",
      ".processed.txt",
      ".converted.txt",
      ".chunked.txt",
    ];

    const lowerFilename = filename.toLowerCase();
    for (const ext of compoundExtensions) {
      if (lowerFilename.endsWith(ext)) {
        return ext;
      }
    }

    // Fall back to simple extension
    return "." + parts[parts.length - 1].toLowerCase();
  }

  // === NEW: Job Chain Prediction Methods ===

  /**
   * Predict the complete processing chain for a file
   */
  predictProcessingChain(
    filePath: string,
    fileTags: string[],
    availableParsers: Map<string, Parser>
  ): ProcessingStep[] {
    const isDerivative = this.isDerivativeFile(filePath);
    const chain: ProcessingStep[] = [];
    const completedParsers = new Set<string>();
    let currentPath = filePath;

    // Iteratively find parsers that can run until no more are available
    let foundNewParsers = true;
    while (foundNewParsers) {
      foundNewParsers = false;

      // Get ready configs for current path
      const readyConfigs = this.getReadyConfigsWithParsers(
        currentPath,
        fileTags,
        completedParsers,
        availableParsers,
        isDerivative || completedParsers.size > 0 // Treat as derivative after first step
      );

      for (const { config, parser } of readyConfigs) {
        if (!completedParsers.has(parser.name)) {
          const outputPath = currentPath + config.outputExt;
          const estimatedCost = this.estimateProcessingCost(
            currentPath,
            parser.name
          );

          chain.push({
            parser: parser.name,
            inputPath: currentPath,
            outputPath,
            estimatedCost,
            dependsOn: config.dependsOn,
          });

          completedParsers.add(parser.name);
          currentPath = outputPath; // Next parsers will use this output as input
          foundNewParsers = true;
        }
      }
    }

    return chain;
  }

  /**
   * Estimate the cost for a processing step
   */
  private estimateProcessingCost(filePath: string, parserName: string): number {
    try {
      if (!existsSync(filePath)) {
        return 0;
      }

      switch (parserName) {
        case "transcribe":
        case "convert-video": // Video conversion uses transcription pricing
          const costResult = calculateTranscriptionCost(filePath);
          return costResult.estimatedCost;

        case "summarize":
          // For summarization, we need to read the file content
          const content = readFileSync(filePath, "utf-8");
          const sumResult = estimateSummarizationCost(content);
          return sumResult.estimatedCost;

        default:
          return 0; // Unknown parser, no cost estimation
      }
    } catch (error) {
      console.warn(
        `Failed to estimate cost for ${parserName} on ${filePath}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Get all files with their predicted processing chains
   * Only includes files that have remaining processing steps
   */
  async getAllPredictedJobs(
    availableParsers: Map<string, Parser>
  ): Promise<PredictedJob[]> {
    const allFiles = this.db.getAllFiles();
    const predictedJobs: PredictedJob[] = [];

    for (const file of allFiles) {
      // Get file tags
      const fileTags = this.db.getFileTags(file.id).map((tag) => tag.tag);

      // Get completed parses for this file
      const existingParses = this.db.getFileParses(file.id);
      const completedParsers = new Set<string>();

      // Track which parsers have been completed for this file
      // A parser is only considered completed if it's marked as done AND the output file actually exists
      for (const parse of existingParses) {
        if (
          parse.status === "done" &&
          parse.outputPath &&
          existsSync(parse.outputPath)
        ) {
          completedParsers.add(parse.parser);
        }
      }

      // Generate prediction chain considering what's already completed
      const predictedChain = this.predictProcessingChainWithCompleted(
        file.path,
        fileTags,
        availableParsers,
        completedParsers
      );

      // Only create predicted job if there are remaining steps
      if (predictedChain.length > 0) {
        // Calculate estimated costs for remaining steps only
        const estimatedCosts: Record<string, number> = {};
        const dependencies: string[] = [];

        for (const step of predictedChain) {
          estimatedCosts[step.parser] = step.estimatedCost;
          dependencies.push(...step.dependsOn);
        }

        // Remove duplicates from dependencies
        const uniqueDependencies = [...new Set(dependencies)];

        const predicted = this.db.upsertPredictedJob(
          file.id,
          predictedChain,
          estimatedCosts,
          uniqueDependencies
        );

        predictedJobs.push(predicted);
      } else {
        // No remaining steps - invalidate any existing predicted job
        this.db.invalidatePredictedJob(file.id);
      }
    }

    return predictedJobs;
  }

  /**
   * Predict processing chain considering already completed parsers
   */
  private predictProcessingChainWithCompleted(
    filePath: string,
    fileTags: string[],
    availableParsers: Map<string, Parser>,
    alreadyCompleted: Set<string>
  ): ProcessingStep[] {
    const isDerivative = this.isDerivativeFile(filePath);
    const chain: ProcessingStep[] = [];
    const completedParsers = new Set<string>(alreadyCompleted); // Start with already completed parsers
    let currentPath = filePath;

    // Iteratively find parsers that can run until no more are available
    let foundNewParsers = true;
    while (foundNewParsers) {
      foundNewParsers = false;

      // Get ready configs for current path
      const readyConfigs = this.getReadyConfigsWithParsers(
        currentPath,
        fileTags,
        completedParsers,
        availableParsers,
        isDerivative || completedParsers.size > alreadyCompleted.size // Treat as derivative after first new step
      );

      for (const { config, parser } of readyConfigs) {
        // Only add to chain if this parser hasn't been completed yet
        if (
          !alreadyCompleted.has(parser.name) &&
          !completedParsers.has(parser.name)
        ) {
          const outputPath = currentPath + config.outputExt;
          const estimatedCost = this.estimateProcessingCost(
            currentPath,
            parser.name
          );

          chain.push({
            parser: parser.name,
            inputPath: currentPath,
            outputPath,
            estimatedCost,
            dependsOn: config.dependsOn,
          });

          completedParsers.add(parser.name);
          currentPath = outputPath; // Next parsers will use this output as input
          foundNewParsers = true;
        }
      }
    }

    return chain;
  }

  /**
   * Create or update predicted job for a file (considering completed parses)
   */
  async updatePredictedJob(
    fileId: number,
    filePath: string,
    fileTags: string[],
    availableParsers: Map<string, Parser>
  ): Promise<PredictedJob> {
    // Get completed parses for this file
    const existingParses = this.db.getFileParses(fileId);
    const completedParsers = new Set<string>();

    // Track which parsers have been completed for this file
    // A parser is only considered completed if it's marked as done AND the output file actually exists
    for (const parse of existingParses) {
      if (
        parse.status === "done" &&
        parse.outputPath &&
        existsSync(parse.outputPath)
      ) {
        completedParsers.add(parse.parser);
      }
    }

    // Generate prediction chain considering what's already completed
    const predictedChain = this.predictProcessingChainWithCompleted(
      filePath,
      fileTags,
      availableParsers,
      completedParsers
    );

    // Calculate estimated costs for remaining steps only
    const estimatedCosts: Record<string, number> = {};
    const dependencies: string[] = [];

    for (const step of predictedChain) {
      estimatedCosts[step.parser] = step.estimatedCost;
      dependencies.push(...step.dependsOn);
    }

    // Remove duplicates from dependencies
    const uniqueDependencies = [...new Set(dependencies)];

    const result = this.db.upsertPredictedJob(
      fileId,
      predictedChain,
      estimatedCosts,
      uniqueDependencies
    );

    return result;
  }

  /**
   * Calculate total estimated cost for a batch of user selections
   */
  calculateBatchCost(
    userSelections: Array<{ fileId: number; selectedSteps: string[] }>
  ): number {
    let totalCost = 0;

    for (const selection of userSelections) {
      const predicted = this.db.getPredictedJob(selection.fileId);
      if (predicted) {
        for (const stepName of selection.selectedSteps) {
          totalCost += predicted.estimatedCosts[stepName] || 0;
        }
      }
    }

    return totalCost;
  }

  /**
   * Check if a file is a derivative (output of another parser)
   */
  private isDerivativeFile(filePath: string): boolean {
    const filename = basename(filePath);
    const derivativeMarkers = [
      ".transcript.",
      ".summary.",
      ".processed.",
      ".converted.",
      ".chunked.",
      ".chunked_",
      ".chunks.",
      ".combined.",
    ];
    return derivativeMarkers.some((marker) => filename.includes(marker));
  }
}
