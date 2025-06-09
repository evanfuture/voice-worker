import chokidar from "chokidar";
import { basename, extname } from "node:path";
import { existsSync } from "node:fs";
import type { DatabaseClient } from "../db/client.js";
import type { QueueClient } from "../queue/client.js";
import type { ParserLoader } from "../parsers/loader.js";

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private db: DatabaseClient;
  private queue: QueueClient;
  private parserLoader: ParserLoader;
  private watchDir: string;

  constructor(
    watchDir: string,
    db: DatabaseClient,
    queue: QueueClient,
    parserLoader: ParserLoader
  ) {
    this.watchDir = watchDir;
    this.db = db;
    this.queue = queue;
    this.parserLoader = parserLoader;
  }

  async start(): Promise<void> {
    console.log(`Starting file watcher on: ${this.watchDir}`);

    this.watcher = chokidar.watch(this.watchDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      depth: 3, // reasonable depth limit
    });

    this.watcher
      .on("add", (path: string) => this.handleFileAdded(path))
      .on("change", (path: string) => this.handleFileChanged(path))
      .on("unlink", (path: string) => this.handleFileDeleted(path))
      .on("error", (error: Error) => console.error("Watcher error:", error))
      .on("ready", () =>
        console.log("Initial scan complete. Ready for changes")
      );
  }

  private async handleFileAdded(filePath: string): Promise<void> {
    console.log(`File added: ${basename(filePath)}`);
    await this.processFile(filePath);
  }

  private async handleFileChanged(filePath: string): Promise<void> {
    console.log(`File changed: ${basename(filePath)}`);
    await this.processFile(filePath);
  }

  private async handleFileDeleted(filePath: string): Promise<void> {
    console.log(`File deleted: ${basename(filePath)}`);

    // Find any parses that had this file as output and mark them as pending
    const affectedParses = this.db.markParsesAsPendingByOutputPath(filePath);

    // Remove the file from our database
    this.db.deleteFile(filePath);

    // Re-enqueue jobs for the affected parses
    for (const parse of affectedParses) {
      const file = this.db.getFileById(parse.fileId);
      if (file && existsSync(file.path)) {
        console.log(
          `Re-queuing ${parse.parser} for ${basename(file.path)} (output was deleted)`
        );
        await this.queue.enqueueJob(parse.parser, file.path);
      }
    }
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      // Determine if this is an original file or a derivative (output from a parser)
      const isDerivative = this.isDerivativeFile(filePath);
      const kind = isDerivative ? "derivative" : "original";

      // Catalog the file
      const fileRecord = this.db.upsertFile(filePath, kind);

      // Get applicable parsers for this file
      const applicableParsers =
        this.parserLoader.getApplicableParsers(filePath);

      if (applicableParsers.length === 0) {
        console.log(`No parsers available for ${basename(filePath)}`);
        return;
      }

      // Get completed parsers for this file
      const existingParses = this.db.getFileParses(fileRecord.id);
      const completedParsers = new Set(
        existingParses
          .filter((parse) => parse.status === "done")
          .map((parse) => parse.parser)
      );

      // Get ready parsers (those whose dependencies are satisfied)
      const readyParsers = this.parserLoader.getReadyParsers(
        filePath,
        completedParsers
      );

      for (const parser of readyParsers) {
        const existingParse = this.db.getParse(fileRecord.id, parser.name);

        // Only enqueue if not already done or processing
        if (
          !existingParse ||
          existingParse.status === "pending" ||
          existingParse.status === "failed"
        ) {
          console.log(`Enqueuing ${parser.name} for ${basename(filePath)}`);

          // Mark as pending in database
          this.db.upsertParse(fileRecord.id, parser.name, "pending");

          // Add to queue
          await this.queue.enqueueJob(parser.name, filePath);
        }
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }

  private isDerivativeFile(filePath: string): boolean {
    const filename = basename(filePath);
    const derivativeMarkers = [
      ".transcript.",
      ".summary.",
      ".processed.",
      ".converted.",
    ];
    return derivativeMarkers.some((marker) => filename.includes(marker));
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
      console.log("File watcher stopped");
    }
  }
}
