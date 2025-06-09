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

      return stmt.get(filePath, sha256, kind, now, now) as FileRecord;
    } catch (error) {
      throw new Error(`Failed to upsert file ${filePath}: ${error}`);
    }
  }

  getFile(filePath: string): FileRecord | null {
    const stmt = this.db.prepare("SELECT * FROM files WHERE path = ?");
    return stmt.get(filePath) as FileRecord | null;
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
    return stmt.get(fileId, parser) as ParseRecord | null;
  }

  getPendingParses(): ParseRecord[] {
    const stmt = this.db.prepare(
      'SELECT * FROM parses WHERE status = "pending"'
    );
    return stmt.all() as ParseRecord[];
  }

  getFileParses(fileId: number): ParseRecord[] {
    const stmt = this.db.prepare("SELECT * FROM parses WHERE file_id = ?");
    return stmt.all(fileId) as ParseRecord[];
  }

  markParsesAsPendingByOutputPath(outputPath: string): ParseRecord[] {
    const stmt = this.db.prepare(`
      UPDATE parses
      SET status = 'pending', output_path = NULL, updated_at = unixepoch()
      WHERE output_path = ?
      RETURNING *
    `);
    return stmt.all(outputPath) as ParseRecord[];
  }

  getFileById(id: number): FileRecord | null {
    const stmt = this.db.prepare("SELECT * FROM files WHERE id = ?");
    return stmt.get(id) as FileRecord | null;
  }

  close(): void {
    this.db.close();
  }
}
