import { DatabaseClient } from "../../../core/db/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);

  try {
    const db = new DatabaseClient(config.dbPath);

    // Get filter parameters
    const tag = query.tag as string | undefined;
    const tagValue = query.tagValue as string | undefined;

    if (tag) {
      // Filter by tag
      const files = db.getFilesByTag(tag, tagValue);
      // Add metadata for each file
      const filesWithMetadata = files.map((file) => {
        const tags = db.getFileTags(file.id);
        const metadata = db.getFileMetadata(file.id);
        return {
          ...file,
          tags,
          metadata,
        };
      });
      return filesWithMetadata;
    } else {
      // Get all files with metadata
      return db.getAllFilesWithMetadata();
    }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get files with metadata",
    });
  }
});
