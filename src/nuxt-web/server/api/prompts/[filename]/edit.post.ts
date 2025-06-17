import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

interface LineEdit {
  operation: "insert" | "replace" | "delete";
  lineNumber: number;
  content?: string;
  count?: number; // for delete operations (how many lines to delete)
}

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

    const promptPath = join(process.cwd(), "prompts", filename);

    if (!existsSync(promptPath)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Prompt file '${filename}' not found`,
      });
    }

    // Validate edit operation
    const edit: LineEdit = body;
    if (
      !edit.operation ||
      !["insert", "replace", "delete"].includes(edit.operation)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Invalid operation. Must be 'insert', 'replace', or 'delete'",
      });
    }

    if (typeof edit.lineNumber !== "number" || edit.lineNumber < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: "lineNumber must be a positive integer",
      });
    }

    // Read current content
    const currentContent = readFileSync(promptPath, "utf-8");
    const lines = currentContent.split("\n");

    // Apply the edit operation
    const newLines = [...lines];

    switch (edit.operation) {
      case "insert": {
        if (!edit.content && edit.content !== "") {
          throw createError({
            statusCode: 400,
            statusMessage: "content is required for insert operations",
          });
        }
        // Insert at the specified line (1-based indexing)
        newLines.splice(edit.lineNumber - 1, 0, edit.content);
        break;
      }

      case "replace": {
        if (!edit.content && edit.content !== "") {
          throw createError({
            statusCode: 400,
            statusMessage: "content is required for replace operations",
          });
        }
        // Replace the line at the specified position
        if (edit.lineNumber > lines.length) {
          throw createError({
            statusCode: 400,
            statusMessage: `Line ${edit.lineNumber} does not exist (file has ${lines.length} lines)`,
          });
        }
        newLines[edit.lineNumber - 1] = edit.content;
        break;
      }

      case "delete": {
        const count = edit.count || 1;
        if (edit.lineNumber > lines.length) {
          throw createError({
            statusCode: 400,
            statusMessage: `Line ${edit.lineNumber} does not exist (file has ${lines.length} lines)`,
          });
        }
        // Delete the specified number of lines starting at lineNumber
        newLines.splice(edit.lineNumber - 1, count);
        break;
      }
    }

    // Write the updated content
    const newContent = newLines.join("\n");
    writeFileSync(promptPath, newContent, "utf-8");

    return {
      success: true,
      filename,
      operation: edit.operation,
      lineNumber: edit.lineNumber,
      oldLineCount: lines.length,
      newLineCount: newLines.length,
      preview: newLines.slice(
        Math.max(0, edit.lineNumber - 3),
        edit.lineNumber + 2
      ),
      message: `Successfully applied ${edit.operation} operation to line ${edit.lineNumber}`,
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError errors
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to edit prompt file",
    });
  }
});
