import { DatabaseClient } from "../../../core/db/client.js";

// DO NOT USE A SINGLETON for the web interface.
// Due to the watcher running in a separate process, the web server
// needs to create a new connection for each request to ensure it
// reads the latest state from the .db file, especially after the
// watcher modifies it.

export function getDbClient(): DatabaseClient {
  const config = useRuntimeConfig();
  // console.log("🔧 Creating new DatabaseClient with path:", config.dbPath);
  const dbInstance = new DatabaseClient(config.dbPath);

  // Migrations should be checked on each new instance to be safe,
  // the migration logic is idempotent and will not re-run if not needed.
  dbInstance.runMigrationsIfNeeded();
  // console.log("✅ DatabaseClient created and migrations applied");

  return dbInstance;
}

// No-op function for backwards compatibility if needed anywhere
export function resetDbClient() {}
