import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(async (_event) => {
  try {
    const promptsDir = join(process.cwd(), "prompts");

    if (!existsSync(promptsDir)) {
      return {
        prompts: [],
        message: "Prompts directory does not exist",
      };
    }

    const entries = readdirSync(promptsDir, { withFileTypes: true });
    const prompts = [];

    for (const entry of entries) {
      if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
      ) {
        const fullPath = join(promptsDir, entry.name);
        try {
          const content = readFileSync(fullPath, "utf-8");
          const stats = statSync(fullPath);
          const lines = content.split("\n");

          prompts.push({
            filename: entry.name,
            path: fullPath,
            relativePath: `prompts/${entry.name}`,
            content,
            lines: lines.length,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            preview:
              lines.slice(0, 3).join("\n") + (lines.length > 3 ? "\n..." : ""),
          });
        } catch (error) {
          console.error(`Error reading prompt file ${entry.name}:`, error);
          prompts.push({
            filename: entry.name,
            path: fullPath,
            relativePath: `prompts/${entry.name}`,
            content: null,
            error: error instanceof Error ? error.message : "Unknown error",
            lastModified: null,
          });
        }
      }
    }

    return {
      prompts: prompts.sort((a, b) => a.filename.localeCompare(b.filename)),
      count: prompts.length,
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to list prompt files",
    });
  }
});
