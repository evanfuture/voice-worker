import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { FileRecord, ParseRecord } from "../types.js";

export class DatabaseClient {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
  }

  private initializeSchema() {
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

      CREATE INDEX IF NOT EXISTS idx_files_path ON files (path);
      CREATE INDEX IF NOT EXISTS idx_parses_status ON parses (status);
      CREATE INDEX IF NOT EXISTS idx_parses_output_path ON parses (output_path);
    `);
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
    error?: string
  ): void {
    const now = Math.floor(Date.now() / 1000);
    const stmt = this.db.prepare(`
      INSERT INTO parses (file_id, parser, status, output_path, updated_at, error)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (file_id, parser) DO UPDATE SET
        status = excluded.status,
        output_path = excluded.output_path,
        updated_at = excluded.updated_at,
        error = excluded.error
    `);

    stmt.run(fileId, parser, status, outputPath || null, now, error || null);
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

  close(): void {
    this.db.close();
  }
}
