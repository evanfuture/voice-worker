import chokidar from "chokidar";
import { basename, extname } from "node:path";
import { existsSync } from "node:fs";
import type { DatabaseClient } from "../db/client.js";
import type { QueueClient } from "../queue/client.js";
import type { ParserLoader } from "../processors/loader.js";
import { ParserConfigManager } from "../processors/config-manager.js";

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private db: DatabaseClient;
  private queue: QueueClient;
  private parserLoader: ParserLoader;
  private configManager: ParserConfigManager;
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
    this.configManager = new ParserConfigManager(db);
  }

  async start(): Promise<void> {
    console.log(`Starting file watcher on: ${this.watchDir}`);

    this.watcher = chokidar.watch(this.watchDir, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        "**/tmp/**", // ignore entire tmp directory (includes chunks)
      ],
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
    console.log(`🔍 Checking for parses with output: ${filePath}`);
    const affectedParses = this.db.markParsesAsPendingByOutputPath(filePath);

    if (affectedParses.length > 0) {
      console.log(`📝 Found ${affectedParses.length} parses to re-queue`);
    } else {
      console.log(`📝 No parses found with this output path`);
    }

    // Re-enqueue jobs for the affected parses BEFORE deleting the file record
    for (const parse of affectedParses) {
      const file = this.db.getFileById(parse.fileId);
      if (file && existsSync(file.path)) {
        console.log(
          `🔄 Re-queuing ${parse.parser} for ${basename(file.path)} (output was deleted)`
        );
        await this.queue.enqueueJob(parse.parser, file.path);
      } else {
        console.log(
          `⚠️  Cannot re-queue ${parse.parser}: source file ${file?.path || "unknown"} not found`
        );
      }
    }

    // Remove the file from our database AFTER re-queuing
    this.db.deleteFile(filePath);
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      // Determine if this is an original file or a derivative (output from a parser)
      const isDerivative = this.isDerivativeFile(filePath);
      const kind = isDerivative ? "derivative" : "original";

      // Catalog the file
      const fileRecord = this.db.upsertFile(filePath, kind);

      // Auto-tag transcript files
      if (filePath.includes(".transcript.")) {
        const existingTags = this.db.getFileTags(fileRecord.id);
        const hasTranscriptTag = existingTags.some(
          (tag) => tag.tag === "transcript"
        );
        if (!hasTranscriptTag) {
          this.db.addFileTag(fileRecord.id, "transcript");
          console.log(
            `🏷️  Auto-tagged ${basename(filePath)} with 'transcript' tag`
          );
        }
      }

      // For derivative files, only apply parsers that specifically target them
      // This prevents recursion while allowing legitimate processing chains
      if (isDerivative) {
        console.log(
          `Cataloged derivative file: ${basename(filePath)} (checking for applicable parsers)`
        );
        // Continue to parser processing - the parsers themselves will handle what they can process
      }

      // Get file tags for this file
      const fileTags = this.db.getFileTags(fileRecord.id).map((tag) => tag.tag);

      // Get applicable parser configs for this file (using database configs + file tags)
      const availableParsers = this.parserLoader.getAllParsers();
      const applicableConfigs = this.configManager.getApplicableConfigs(
        filePath,
        fileTags,
        isDerivative
      );

      if (applicableConfigs.length === 0) {
        // Use the same extension detection logic as the config manager
        const detectedExt = this.configManager.getFileExtension(filePath);
        console.log(
          `🔍 No parser configs available for ${basename(filePath)} (ext: ${detectedExt}, tags: [${fileTags.join(", ")}])`
        );
        return;
      } else {
        console.log(
          `🔍 Found ${applicableConfigs.length} applicable parser configs for ${basename(filePath)}: ${applicableConfigs.map((c) => c.name).join(", ")}`
        );
      }

      // Get completed parsers for this file (must be done AND output file must exist)
      const existingParses = this.db.getFileParses(fileRecord.id);
      const completedParsers = new Set(
        existingParses
          .filter((parse) => {
            // Parser must be marked as done AND output file must actually exist
            return (
              parse.status === "done" &&
              parse.outputPath &&
              existsSync(parse.outputPath)
            );
          })
          .map((parse) => parse.parser)
      );

      // Get ready parser configs with implementations (those whose dependencies are satisfied)
      const readyConfigsWithParsers =
        this.configManager.getReadyConfigsWithParsers(
          filePath,
          fileTags,
          completedParsers,
          availableParsers,
          isDerivative
        );

      console.log(
        `🔍 Ready parser configs for ${basename(filePath)}: ${readyConfigsWithParsers.map((r) => r.config.name).join(", ")} (${readyConfigsWithParsers.length} total)`
      );
      console.log(
        `🔍 Completed parsers: ${Array.from(completedParsers).join(", ") || "none"}`
      );

      for (const { config, parser } of readyConfigsWithParsers) {
        const existingParse = this.db.getParse(fileRecord.id, parser.name);
        console.log(
          `🔍 Checking ${parser.name}: existingParse=${existingParse?.status || "none"}, outputExists=${existingParse?.outputPath ? existsSync(existingParse.outputPath) : "N/A"}`
        );

        // Only enqueue if not already done or processing
        // For "done" status, also verify the output file actually exists
        const isActuallyDone =
          existingParse?.status === "done" &&
          existingParse.outputPath &&
          existsSync(existingParse.outputPath);

        // Also check if there's already a job in the queue for this parser+file combination
        const existingQueueJobs = await this.queue.getJobs([
          "waiting",
          "active",
        ]);
        const hasExistingQueueJob = existingQueueJobs.some(
          (job) => job.name === parser.name && job.data.path === filePath
        );

        if (
          !existingParse ||
          existingParse.status === "pending" ||
          existingParse.status === "failed" ||
          (existingParse.status === "done" && !isActuallyDone)
        ) {
          if (hasExistingQueueJob) {
            console.log(
              `⏭️  Skipping ${parser.name} for ${basename(filePath)} (already in queue)`
            );
          } else {
            console.log(
              `✅ Enqueuing ${parser.name} for ${basename(filePath)}`
            );

            // Mark as pending in database
            this.db.upsertParse(fileRecord.id, parser.name, "pending");

            // Add to queue
            await this.queue.enqueueJob(parser.name, filePath);
          }
        } else {
          console.log(
            `⏭️  Skipping ${parser.name} (status: ${existingParse.status})`
          );
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
      ".chunked.",
      ".chunked_", // Also catch old-style chunked files
      ".chunks.",
      ".combined.",
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
