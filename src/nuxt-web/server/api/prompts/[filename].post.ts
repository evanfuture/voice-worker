import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export default defineEventHandler(async (event) => {
  try {
    const filename = getRouterParam(event, "filename");
    const body = await readBody(event);

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

    if (!body.content && body.content !== "") {
      throw createError({
        statusCode: 400,
        statusMessage: "Content is required",
      });
    }

    const promptPath = join(process.cwd(), "prompts", filename);

    // Store old content for backup if file exists
    let oldContent = "";
    let oldLines = 0;
    if (existsSync(promptPath)) {
      oldContent = readFileSync(promptPath, "utf-8");
      oldLines = oldContent.split("\n").length;
    }

    // Write the new content
    writeFileSync(promptPath, body.content, "utf-8");

    const newLines = body.content.split("\n").length;

    return {
      success: true,
      filename,
      operation: "replace_file",
      oldExists: oldContent.length > 0,
      oldLineCount: oldLines,
      newLineCount: newLines,
      contentLength: body.content.length,
      preview:
        body.content.split("\n").slice(0, 3).join("\n") +
        (newLines > 3 ? "\n..." : ""),
      message: `Successfully ${oldContent.length > 0 ? "updated" : "created"} prompt file ${filename}`,
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError errors
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to write prompt file",
    });
  }
});
