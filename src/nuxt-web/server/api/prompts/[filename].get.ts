import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(async (event) => {
  try {
    const filename = getRouterParam(event, "filename");

    if (!filename) {
      throw createError({
        statusCode: 400,
        statusMessage: "Filename parameter is required",
      });
    }

    // Security: Only allow .md and .txt files, prevent path traversal
    if (!filename.match(/^[a-zA-Z0-9._-]+\.(md|txt)$/)) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Invalid filename format. Only .md and .txt files are allowed.",
      });
    }

    const promptPath = join(process.cwd(), "prompts", filename);

    if (!existsSync(promptPath)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Prompt file '${filename}' not found`,
      });
    }

    const content = readFileSync(promptPath, "utf-8");
    const stats = statSync(promptPath);
    const lines = content.split("\n");

    return {
      filename,
      path: promptPath,
      relativePath: `prompts/${filename}`,
      content,
      lines: lines.map((line, index) => ({
        number: index + 1,
        content: line,
      })),
      totalLines: lines.length,
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      encoding: "utf-8",
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError errors
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to read prompt file",
    });
  }
});
