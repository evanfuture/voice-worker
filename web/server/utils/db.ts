import { DatabaseClient } from "../../../core/db/client.js";

let client: DatabaseClient | null = null;

/**
 * Returns a singleton instance of the DatabaseClient for the web server.
 *
 * This function initializes the client with the CONVEX_URL from the
 * runtime configuration. It ensures that we reuse the same client instance
 * across requests for efficiency.
 */
export function getDbClient(): DatabaseClient {
  if (!client) {
    const config = useRuntimeConfig();
    if (!config.public.convexUrl) {
      throw new Error(
        "CONVEX_URL is not defined in the runtime configuration. Make sure it is set in your .env file and exposed in nuxt.config.ts."
      );
    }
    client = new DatabaseClient(config.public.convexUrl);
  }
  return client;
}

/**
 * Resets the database client instance.
 * Primarily used for testing or hot-reloading scenarios.
 */
export function resetDbClient() {
  client = null;
}