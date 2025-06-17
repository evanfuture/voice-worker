import chokidar from "chokidar";
import { basename, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import type { DatabaseClient } from "../db/client.js";
import { ParserConfigManager } from "../processors/config-manager.js";

export class PromptWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private db: DatabaseClient;
  private configManager: ParserConfigManager;
  private promptsDir: string;
  private changeCallbacks: Array<(filename: string, content: string) => void> =
    [];

  constructor(promptsDir: string, db: DatabaseClient) {
    this.promptsDir = promptsDir;
    this.db = db;
    this.configManager = new ParserConfigManager(db);
  }

  async start(): Promise<void> {
    console.log(`Starting prompt watcher on: ${this.promptsDir}`);

    // Ensure prompts directory exists
    if (!existsSync(this.promptsDir)) {
      console.warn(`Prompts directory does not exist: ${this.promptsDir}`);
      return;
    }

    this.watcher = chokidar.watch(this.promptsDir, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        "**/*.tmp", // ignore temp files
        "**/*.bak", // ignore backup files
      ],
      persistent: true,
      ignoreInitial: false,
      depth: 2, // reasonable depth for prompts
    });

    this.watcher
      .on("add", (path: string) => this.handlePromptAdded(path))
      .on("change", (path: string) => this.handlePromptChanged(path))
      .on("unlink", (path: string) => this.handlePromptDeleted(path))
      .on("error", (error: Error) =>
        console.error("Prompt watcher error:", error)
      )
      .on("ready", () =>
        console.log("Prompt watcher scan complete. Ready for changes")
      );
  }

  private async handlePromptAdded(promptPath: string): Promise<void> {
    console.log(`📝 Prompt added: ${basename(promptPath)}`);
    await this.processPromptChange(promptPath, "added");
  }

  private async handlePromptChanged(promptPath: string): Promise<void> {
    console.log(`📝 Prompt changed: ${basename(promptPath)}`);
    await this.processPromptChange(promptPath, "changed");
  }

  private async handlePromptDeleted(promptPath: string): Promise<void> {
    console.log(`📝 Prompt deleted: ${basename(promptPath)}`);
    await this.processPromptChange(promptPath, "deleted");
  }

  private async processPromptChange(
    promptPath: string,
    changeType: "added" | "changed" | "deleted"
  ): Promise<void> {
    try {
      const filename = basename(promptPath);
      const relativePath = promptPath.replace(process.cwd() + "/", "");

      // Log the change for audit trail
      console.log(`📋 Prompt file ${changeType}: ${relativePath}`);

      // Read the prompt content if it exists
      let content = "";
      if (changeType !== "deleted" && existsSync(promptPath)) {
        content = readFileSync(promptPath, "utf-8");
      }

      // Find parser configurations that reference this prompt
      const affectedConfigs = this.findConfigsUsingPrompt(relativePath);

      if (affectedConfigs.length > 0) {
        console.log(
          `🎯 Found ${affectedConfigs.length} parser configs using this prompt:`
        );
        for (const config of affectedConfigs) {
          console.log(`   - ${config.name} (${config.displayName})`);
        }

        // TODO: In the future, we could invalidate cached prompts,
        // restart running jobs, or validate the new prompt
        if (changeType === "deleted") {
          console.warn(
            `⚠️  Prompt file deleted but still referenced by parser configs!`
          );
        }
      }

      // Notify registered callbacks
      for (const callback of this.changeCallbacks) {
        try {
          callback(filename, content);
        } catch (error) {
          console.error("Error in prompt change callback:", error);
        }
      }

      // Create a simple audit log entry
      // TODO: Extend database schema to track prompt changes
      console.log(`✅ Processed prompt ${changeType} for ${filename}`);
    } catch (error) {
      console.error(
        `Failed to process prompt change for ${promptPath}:`,
        error
      );
    }
  }

  private findConfigsUsingPrompt(promptPath: string): Array<{
    name: string;
    displayName: string;
    promptPath: string;
  }> {
    const allConfigs = this.db.getAllParserConfigs();
    const affected = [];

    for (const config of allConfigs) {
      if (config.config && typeof config.config === "object") {
        const configPromptPath = config.config.promptPath;
        if (configPromptPath === promptPath) {
          affected.push({
            name: config.name,
            displayName: config.displayName,
            promptPath: configPromptPath,
          });
        }
      }
    }

    return affected;
  }

  /**
   * Register a callback to be called when prompts change
   * Useful for invalidating caches or reloading configurations
   */
  onPromptChange(callback: (filename: string, content: string) => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Get all prompt files in the watched directory
   */
  getPromptFiles(): Array<{ filename: string; path: string; content: string }> {
    const files: Array<{ filename: string; path: string; content: string }> =
      [];
    const fs = require("fs");
    const path = require("path");

    if (!existsSync(this.promptsDir)) {
      return files;
    }

    const entries = fs.readdirSync(this.promptsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
      ) {
        const fullPath = path.join(this.promptsDir, entry.name);
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          files.push({
            filename: entry.name,
            path: fullPath,
            content,
          });
        } catch (error) {
          console.error(`Error reading prompt file ${entry.name}:`, error);
        }
      }
    }

    return files;
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      console.log("Stopping prompt watcher...");
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
