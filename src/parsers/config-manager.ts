import type { DatabaseClient } from "../db/client.js";
import type { ParserConfig, Parser } from "../types.js";

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
          config: {}, // Parser-specific configuration
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
  getApplicableConfigs(filePath: string, fileTags: string[]): ParserConfig[] {
    const ext = this.getFileExtension(filePath);
    const enabledConfigs = this.getEnabledConfigs();

    return enabledConfigs.filter((config) => {
      // Check if file extension matches
      const extensionMatches = config.inputExtensions.includes(ext);

      // Check if required tags are present (if any)
      const tagsMatch =
        config.inputTags.length === 0 ||
        config.inputTags.every((requiredTag) => fileTags.includes(requiredTag));

      return extensionMatches && tagsMatch;
    });
  }

  /**
   * Get parser configurations that are ready to run (dependencies satisfied)
   */
  getReadyConfigs(
    filePath: string,
    fileTags: string[],
    completedParsers: Set<string>
  ): ParserConfig[] {
    const applicable = this.getApplicableConfigs(filePath, fileTags);

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
    availableParsers: Map<string, Parser>
  ): Array<{ config: ParserConfig; parser: Parser }> {
    const readyConfigs = this.getReadyConfigs(
      filePath,
      fileTags,
      completedParsers
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

  private getFileExtension(filePath: string): string {
    const parts = filePath.split(".");
    return parts.length > 1 ? "." + parts[parts.length - 1].toLowerCase() : "";
  }
}
