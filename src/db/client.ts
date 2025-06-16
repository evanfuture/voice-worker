import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  FileRecord,
  ParseRecord,
  ParserConfig,
  FileTag,
  FileMetadata,
  FileRecordWithMetadata,
  ParserExecution,
  SystemSetting,
  ApprovalBatch,
  PredictedJob,
  ProcessingStep,
} from "../types.js";

export class DatabaseClient {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
  }

  private initializeSchema() {
    // Run any necessary migrations first
    this.runMigrations();

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        sha256 TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('original', 'derivative')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS parses (
        file_id INTEGER NOT NULL,
        parser TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
        output_path TEXT,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        error TEXT,
        PRIMARY KEY (file_id, parser),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
      );

      -- NEW: Parser configurations table
      CREATE TABLE IF NOT EXISTS parser_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        parser_implementation TEXT NOT NULL DEFAULT '',
        display_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        input_extensions TEXT NOT NULL DEFAULT '[]', -- JSON array
        input_tags TEXT NOT NULL DEFAULT '[]', -- JSON array
        output_ext TEXT NOT NULL,
        depends_on TEXT NOT NULL DEFAULT '[]', -- JSON array
        is_enabled INTEGER NOT NULL DEFAULT 1,
        allow_user_selection INTEGER NOT NULL DEFAULT 0,
        allow_derived_files INTEGER NOT NULL DEFAULT 0,
        config TEXT NOT NULL DEFAULT '{}', -- JSON object
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- NEW: File tags table
      CREATE TABLE IF NOT EXISTS file_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        tag TEXT NOT NULL,
        value TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
      );

      -- NEW: File metadata table
      CREATE TABLE IF NOT EXISTS file_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('string', 'number', 'boolean', 'json')),
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
      );

      -- NEW: Parser executions table for user-driven parsing
      CREATE TABLE IF NOT EXISTS parser_executions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parser_config_id INTEGER NOT NULL,
        file_ids TEXT NOT NULL, -- JSON array of file IDs
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'done', 'failed')),
        output_paths TEXT NOT NULL DEFAULT '[]', -- JSON array
        error TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (parser_config_id) REFERENCES parser_configs (id) ON DELETE CASCADE
      );

      -- NEW: System settings table for queue mode and global configuration
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- NEW: Approval batches table for tracking user approval sessions
      CREATE TABLE IF NOT EXISTS approval_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        user_selections TEXT NOT NULL DEFAULT '{}', -- JSON object of user selections
        total_estimated_cost REAL DEFAULT 0.0,
        actual_cost REAL DEFAULT 0.0,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      -- NEW: Predicted jobs table for storing job chain predictions
      CREATE TABLE IF NOT EXISTS predicted_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        predicted_chain TEXT NOT NULL, -- JSON array of predicted processing steps
        estimated_costs TEXT NOT NULL DEFAULT '{}', -- JSON object of cost estimates
        dependencies TEXT NOT NULL DEFAULT '[]', -- JSON array of dependencies
        is_valid INTEGER NOT NULL DEFAULT 1, -- whether the prediction is still valid
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE
      );

      -- Existing indexes
      CREATE INDEX IF NOT EXISTS idx_files_path ON files (path);
      CREATE INDEX IF NOT EXISTS idx_parses_status ON parses (status);
      CREATE INDEX IF NOT EXISTS idx_parses_output_path ON parses (output_path);

      -- NEW: Indexes for new tables
      CREATE INDEX IF NOT EXISTS idx_parser_configs_name ON parser_configs (name);
      CREATE INDEX IF NOT EXISTS idx_parser_configs_enabled ON parser_configs (is_enabled);
      CREATE INDEX IF NOT EXISTS idx_file_tags_file_id ON file_tags (file_id);
      CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags (tag);
      CREATE INDEX IF NOT EXISTS idx_file_metadata_file_id ON file_metadata (file_id);
      CREATE INDEX IF NOT EXISTS idx_file_metadata_key ON file_metadata (key);
      CREATE INDEX IF NOT EXISTS idx_parser_executions_status ON parser_executions (status);
      CREATE INDEX IF NOT EXISTS idx_approval_batches_status ON approval_batches (status);
      CREATE INDEX IF NOT EXISTS idx_predicted_jobs_file_id ON predicted_jobs (file_id);
      CREATE INDEX IF NOT EXISTS idx_predicted_jobs_valid ON predicted_jobs (is_valid);
    `);
  }

  private runMigrations() {
    // Check if we need to add allow_derived_files column to parser_configs table
    try {
      // Try to query the column - if it fails, we need to add it
      const stmt = this.db.prepare(
        "SELECT allow_derived_files FROM parser_configs LIMIT 1"
      );
      stmt.get();
    } catch (error) {
      // Column doesn't exist, add it
      console.log(
        "🔄 Running database migration: adding allow_derived_files column..."
      );
      this.db.exec(`
        ALTER TABLE parser_configs
        ADD COLUMN allow_derived_files INTEGER NOT NULL DEFAULT 0
      `);
      console.log("✅ Migration completed successfully");
    }

    // Check if we need to add approval_batch_id column to parses table
    try {
      const stmt = this.db.prepare(
        "SELECT approval_batch_id FROM parses LIMIT 1"
      );
      stmt.get();
    } catch (error) {
      // Column doesn't exist, add it
      console.log(
        "🔄 Running database migration: adding approval_batch_id column to parses table..."
      );
      this.db.exec(`
        ALTER TABLE parses
        ADD COLUMN approval_batch_id INTEGER REFERENCES approval_batches(id)
      `);
      console.log("✅ Migration completed successfully");
    }
  }

  upsertFile(
    filePath: string,
    kind: "original" | "derivative" = "original"
  ): FileRecord {
    try {
      const fileContent = readFileSync(filePath);
      const sha256 = createHash("sha256").update(fileContent).digest("hex");
      const now = Math.floor(Date.now() / 1000);

      const stmt = this.db.prepare(`
        INSERT INTO files (path, sha256, kind, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (path) DO UPDATE SET
          sha256 = excluded.sha256,
          kind = excluded.kind,
          updated_at = excluded.updated_at
        RETURNING *
      `);

      const result = stmt.get(filePath, sha256, kind, now, now) as any;
      return {
        id: result.id,
        path: result.path,
        sha256: result.sha256,
        kind: result.kind,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to upsert file ${filePath}: ${error}`);
    }
  }

  getFile(filePath: string): FileRecord | null {
    const stmt = this.db.prepare("SELECT * FROM files WHERE path = ?");
    const result = stmt.get(filePath) as any;
    if (!result) return null;

    return {
      id: result.id,
      path: result.path,
      sha256: result.sha256,
      kind: result.kind,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  deleteFile(filePath: string): void {
    const stmt = this.db.prepare("DELETE FROM files WHERE path = ?");
    stmt.run(filePath);
  }

  upsertParse(
    fileId: number,
    parser: string,
    status: ParseRecord["status"],
    outputPath?: string,
    error?: string,
    approvalBatchId?: number
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO parses (file_id, parser, status, output_path, updated_at, error, approval_batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (file_id, parser) DO UPDATE SET
        status = excluded.status,
        output_path = excluded.output_path,
        updated_at = excluded.updated_at,
        error = excluded.error,
        approval_batch_id = excluded.approval_batch_id
    `);

    stmt.run(
      fileId,
      parser,
      status,
      outputPath || null,
      now,
      error || null,
      approvalBatchId || null
    );
  }

  getParse(fileId: number, parser: string): ParseRecord | null {
    const stmt = this.db.prepare(
      "SELECT * FROM parses WHERE file_id = ? AND parser = ?"
    );
    const result = stmt.get(fileId, parser) as any;
    if (!result) return null;

    return {
      fileId: result.file_id,
      parser: result.parser,
      status: result.status,
      outputPath: result.output_path,
      updatedAt: result.updated_at,
      error: result.error,
      approvalBatchId: result.approval_batch_id,
    };
  }

  getPendingParses(): ParseRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM parses WHERE status = "pending"'
    );
    const results = stmt.all() as any[];
    return results.map((result) => ({
      fileId: result.file_id,
      parser: result.parser,
      status: result.status,
      outputPath: result.output_path,
      updatedAt: result.updated_at,
      error: result.error,
      approvalBatchId: result.approval_batch_id,
    }));
  }

  getFileParses(fileId: number): ParseRecord[] {
    const stmt = this.db.prepare("SELECT * FROM parses WHERE file_id = ?");
    const results = stmt.all(fileId) as any[];
    return results.map((result) => ({
      fileId: result.file_id,
      parser: result.parser,
      status: result.status,
      outputPath: result.output_path,
      updatedAt: result.updated_at,
      error: result.error,
      approvalBatchId: result.approval_batch_id,
    }));
  }

  markParsesAsPendingByOutputPath(outputPath: string): ParseRecord[] {
    const stmt = this.db.prepare(`
      UPDATE parses
      SET status = 'pending', output_path = NULL, updated_at = unixepoch()
      WHERE output_path = ?
      RETURNING *
    `);
    const results = stmt.all(outputPath) as any[];
    return results.map((result) => ({
      fileId: result.file_id,
      parser: result.parser,
      status: result.status,
      outputPath: result.output_path,
      updatedAt: result.updated_at,
      error: result.error,
      approvalBatchId: result.approval_batch_id,
    }));
  }

  getFileById(id: number): FileRecord | null {
    const stmt = this.db.prepare("SELECT * FROM files WHERE id = ?");
    const result = stmt.get(id) as any;
    if (!result) return null;

    return {
      id: result.id,
      path: result.path,
      sha256: result.sha256,
      kind: result.kind,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getAllFiles(): FileRecord[] {
    const stmt = this.db.prepare(
      "SELECT * FROM files ORDER BY created_at DESC"
    );
    const results = stmt.all() as any[];
    return results.map((result) => ({
      id: result.id,
      path: result.path,
      sha256: result.sha256,
      kind: result.kind,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  // === NEW: Parser Configuration Methods ===

  upsertParserConfig(
    config: Omit<ParserConfig, "id" | "createdAt" | "updatedAt">
  ): ParserConfig {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO parser_configs (
        name, parser_implementation, display_name, description, input_extensions, input_tags,
        output_ext, depends_on, is_enabled, allow_user_selection, allow_derived_files, config,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (name) DO UPDATE SET
        parser_implementation = excluded.parser_implementation,
        display_name = excluded.display_name,
        description = excluded.description,
        input_extensions = excluded.input_extensions,
        input_tags = excluded.input_tags,
        output_ext = excluded.output_ext,
        depends_on = excluded.depends_on,
        is_enabled = excluded.is_enabled,
        allow_user_selection = excluded.allow_user_selection,
        allow_derived_files = excluded.allow_derived_files,
        config = excluded.config,
        updated_at = excluded.updated_at
      RETURNING *
    `);

    const result = stmt.get(
      config.name,
      config.parserImplementation,
      config.displayName,
      config.description,
      JSON.stringify(config.inputExtensions),
      JSON.stringify(config.inputTags),
      config.outputExt,
      JSON.stringify(config.dependsOn),
      config.isEnabled ? 1 : 0,
      config.allowUserSelection ? 1 : 0,
      config.allowDerivedFiles ? 1 : 0,
      JSON.stringify(config.config),
      now,
      now
    ) as any;

    return {
      id: result.id,
      name: result.name,
      parserImplementation: result.parser_implementation,
      displayName: result.display_name,
      description: result.description,
      inputExtensions: JSON.parse(result.input_extensions),
      inputTags: JSON.parse(result.input_tags),
      outputExt: result.output_ext,
      dependsOn: JSON.parse(result.depends_on),
      isEnabled: Boolean(result.is_enabled),
      allowUserSelection: Boolean(result.allow_user_selection),
      allowDerivedFiles: Boolean(result.allow_derived_files),
      config: JSON.parse(result.config),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getParserConfig(name: string): ParserConfig | null {
    const stmt = this.db.prepare("SELECT * FROM parser_configs WHERE name = ?");
    const result = stmt.get(name) as any;
    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      parserImplementation: result.parser_implementation,
      displayName: result.display_name,
      description: result.description,
      inputExtensions: JSON.parse(result.input_extensions),
      inputTags: JSON.parse(result.input_tags),
      outputExt: result.output_ext,
      dependsOn: JSON.parse(result.depends_on),
      isEnabled: Boolean(result.is_enabled),
      allowUserSelection: Boolean(result.allow_user_selection),
      allowDerivedFiles: Boolean(result.allow_derived_files),
      config: JSON.parse(result.config),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getAllParserConfigs(): ParserConfig[] {
    const stmt = this.db.prepare("SELECT * FROM parser_configs ORDER BY name");
    const results = stmt.all() as any[];
    return results.map((result) => ({
      id: result.id,
      name: result.name,
      parserImplementation: result.parser_implementation || result.name, // fallback for existing records
      displayName: result.display_name,
      description: result.description,
      inputExtensions: JSON.parse(result.input_extensions),
      inputTags: JSON.parse(result.input_tags),
      outputExt: result.output_ext,
      dependsOn: JSON.parse(result.depends_on),
      isEnabled: Boolean(result.is_enabled),
      allowUserSelection: Boolean(result.allow_user_selection),
      allowDerivedFiles: Boolean(result.allow_derived_files || 0), // fallback for existing records
      config: JSON.parse(result.config),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  deleteParserConfig(name: string): void {
    const stmt = this.db.prepare("DELETE FROM parser_configs WHERE name = ?");
    stmt.run(name);
  }

  // === NEW: File Tags Methods ===

  addFileTag(fileId: number, tag: string, value?: string): FileTag {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO file_tags (file_id, tag, value, created_at)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(fileId, tag, value || null, now) as any;
    return {
      id: result.id,
      fileId: result.file_id,
      tag: result.tag,
      value: result.value,
      createdAt: result.created_at,
    };
  }

  removeFileTag(fileId: number, tag: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM file_tags WHERE file_id = ? AND tag = ?"
    );
    stmt.run(fileId, tag);
  }

  getFileTags(fileId: number): FileTag[] {
    const stmt = this.db.prepare("SELECT * FROM file_tags WHERE file_id = ?");
    const results = stmt.all(fileId) as any[];
    return results.map((result) => ({
      id: result.id,
      fileId: result.file_id,
      tag: result.tag,
      value: result.value,
      createdAt: result.created_at,
    }));
  }

  getFilesByTag(tag: string, value?: string): FileRecord[] {
    const stmt = value
      ? this.db.prepare(`
          SELECT f.* FROM files f
          JOIN file_tags ft ON f.id = ft.file_id
          WHERE ft.tag = ? AND ft.value = ?
        `)
      : this.db.prepare(`
          SELECT f.* FROM files f
          JOIN file_tags ft ON f.id = ft.file_id
          WHERE ft.tag = ?
        `);

    const results = value ? stmt.all(tag, value) : stmt.all(tag);
    return (results as any[]).map((result) => ({
      id: result.id,
      path: result.path,
      sha256: result.sha256,
      kind: result.kind,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  // === NEW: File Metadata Methods ===

  setFileMetadata(
    fileId: number,
    key: string,
    value: string,
    type: FileMetadata["type"]
  ): FileMetadata {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO file_metadata (file_id, key, value, type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (file_id, key) DO UPDATE SET
        value = excluded.value,
        type = excluded.type,
        updated_at = excluded.updated_at
      RETURNING *
    `);

    const result = stmt.get(fileId, key, value, type, now, now) as any;
    return {
      id: result.id,
      fileId: result.file_id,
      key: result.key,
      value: result.value,
      type: result.type,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getFileMetadata(fileId: number): FileMetadata[] {
    const stmt = this.db.prepare(
      "SELECT * FROM file_metadata WHERE file_id = ?"
    );
    const results = stmt.all(fileId) as any[];
    return results.map((result) => ({
      id: result.id,
      fileId: result.file_id,
      key: result.key,
      value: result.value,
      type: result.type,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  removeFileMetadata(fileId: number, key: string): void {
    const stmt = this.db.prepare(
      "DELETE FROM file_metadata WHERE file_id = ? AND key = ?"
    );
    stmt.run(fileId, key);
  }

  // === NEW: Enhanced file method with metadata ===

  getFileWithMetadata(fileId: number): FileRecordWithMetadata | null {
    const file = this.getFileById(fileId);
    if (!file) return null;

    const tags = this.getFileTags(fileId);
    const metadata = this.getFileMetadata(fileId);

    return {
      ...file,
      tags,
      metadata,
    };
  }

  getAllFilesWithMetadata(): FileRecordWithMetadata[] {
    const files = this.getAllFiles();
    return files.map((file) => {
      const tags = this.getFileTags(file.id);
      const metadata = this.getFileMetadata(file.id);
      return {
        ...file,
        tags,
        metadata,
      };
    });
  }

  // === NEW: Parser Execution Methods ===

  createParserExecution(
    parserConfigId: number,
    fileIds: number[]
  ): ParserExecution {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO parser_executions (
        parser_config_id, file_ids, status, output_paths, created_at, updated_at
      ) VALUES (?, ?, 'pending', '[]', ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      parserConfigId,
      JSON.stringify(fileIds),
      now,
      now
    ) as any;
    return {
      id: result.id,
      parserConfigId: result.parser_config_id,
      fileIds: JSON.parse(result.file_ids),
      status: result.status,
      outputPaths: JSON.parse(result.output_paths),
      error: result.error,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  updateParserExecution(
    id: number,
    status: ParserExecution["status"],
    outputPaths?: string[],
    error?: string
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE parser_executions
      SET status = ?, output_paths = ?, error = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      status,
      outputPaths ? JSON.stringify(outputPaths) : "[]",
      error || null,
      now,
      id
    );
  }

  getParserExecution(id: number): ParserExecution | null {
    const stmt = this.db.prepare(
      "SELECT * FROM parser_executions WHERE id = ?"
    );
    const result = stmt.get(id) as any;
    if (!result) return null;

    return {
      id: result.id,
      parserConfigId: result.parser_config_id,
      fileIds: JSON.parse(result.file_ids),
      status: result.status,
      outputPaths: JSON.parse(result.output_paths),
      error: result.error,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  // === NEW: System Settings Methods ===

  setSetting(key: string, value: string): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `);
    stmt.run(key, value, now);
  }

  getSetting(key: string): string | null {
    const stmt = this.db.prepare(
      "SELECT value FROM system_settings WHERE key = ?"
    );
    const result = stmt.get(key) as any;
    return result?.value || null;
  }

  // === NEW: Approval Batch Methods ===

  createApprovalBatch(
    name: string,
    userSelections: Record<string, any>,
    totalEstimatedCost: number = 0
  ): ApprovalBatch {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO approval_batches (name, status, user_selections, total_estimated_cost, created_at, updated_at)
      VALUES (?, 'pending', ?, ?, ?, ?)
      RETURNING *
    `);

    const result = stmt.get(
      name,
      JSON.stringify(userSelections),
      totalEstimatedCost,
      now,
      now
    ) as any;
    return {
      id: result.id,
      name: result.name,
      status: result.status,
      userSelections: JSON.parse(result.user_selections),
      totalEstimatedCost: result.total_estimated_cost,
      actualCost: result.actual_cost,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  updateApprovalBatch(
    id: number,
    status: ApprovalBatch["status"],
    actualCost?: number
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      UPDATE approval_batches
      SET status = ?, actual_cost = COALESCE(?, actual_cost), updated_at = ?
      WHERE id = ?
    `);
    stmt.run(status, actualCost, now, id);
  }

  getApprovalBatch(id: number): ApprovalBatch | null {
    const stmt = this.db.prepare("SELECT * FROM approval_batches WHERE id = ?");
    const result = stmt.get(id) as any;
    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      status: result.status,
      userSelections: JSON.parse(result.user_selections),
      totalEstimatedCost: result.total_estimated_cost,
      actualCost: result.actual_cost,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getAllApprovalBatches(): ApprovalBatch[] {
    const stmt = this.db.prepare(
      "SELECT * FROM approval_batches ORDER BY created_at DESC"
    );
    const results = stmt.all() as any[];
    return results.map((result) => ({
      id: result.id,
      name: result.name,
      status: result.status,
      userSelections: JSON.parse(result.user_selections),
      totalEstimatedCost: result.total_estimated_cost,
      actualCost: result.actual_cost,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  // === NEW: Predicted Jobs Methods ===

  upsertPredictedJob(
    fileId: number,
    predictedChain: ProcessingStep[],
    estimatedCosts: Record<string, number>,
    dependencies: string[] = []
  ): PredictedJob {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO predicted_jobs (file_id, predicted_chain, estimated_costs, dependencies, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (file_id) DO UPDATE SET
        predicted_chain = excluded.predicted_chain,
        estimated_costs = excluded.estimated_costs,
        dependencies = excluded.dependencies,
        is_valid = 1,
        updated_at = excluded.updated_at
      RETURNING *
    `);

    const result = stmt.get(
      fileId,
      JSON.stringify(predictedChain),
      JSON.stringify(estimatedCosts),
      JSON.stringify(dependencies),
      now,
      now
    ) as any;

    return {
      id: result.id,
      fileId: result.file_id,
      predictedChain: JSON.parse(result.predicted_chain),
      estimatedCosts: JSON.parse(result.estimated_costs),
      dependencies: JSON.parse(result.dependencies),
      isValid: Boolean(result.is_valid),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getPredictedJob(fileId: number): PredictedJob | null {
    const stmt = this.db.prepare(
      "SELECT * FROM predicted_jobs WHERE file_id = ? AND is_valid = 1"
    );
    const result = stmt.get(fileId) as any;
    if (!result) return null;

    return {
      id: result.id,
      fileId: result.file_id,
      predictedChain: JSON.parse(result.predicted_chain),
      estimatedCosts: JSON.parse(result.estimated_costs),
      dependencies: JSON.parse(result.dependencies),
      isValid: Boolean(result.is_valid),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  getAllPredictedJobs(): PredictedJob[] {
    const stmt = this.db.prepare(
      "SELECT * FROM predicted_jobs WHERE is_valid = 1 ORDER BY created_at DESC"
    );
    const results = stmt.all() as any[];
    return results.map((result) => ({
      id: result.id,
      fileId: result.file_id,
      predictedChain: JSON.parse(result.predicted_chain),
      estimatedCosts: JSON.parse(result.estimated_costs),
      dependencies: JSON.parse(result.dependencies),
      isValid: Boolean(result.is_valid),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  invalidatePredictedJob(fileId: number): void {
    const stmt = this.db.prepare(
      "UPDATE predicted_jobs SET is_valid = 0 WHERE file_id = ?"
    );
    stmt.run(fileId);
  }

  close(): void {
    this.db.close();
  }
}
