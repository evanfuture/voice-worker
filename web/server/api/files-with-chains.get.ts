import { getDbClient } from "../utils/db.js";
import type { FileRecordWithMetadata } from "../../../core/types.js";

interface FileWithChain extends FileRecordWithMetadata {
  children: FileWithChain[];
  level: number;
  processingChain: string[];
  parentPath?: string;
}

export default defineEventHandler(async (_event) => {
  const db = getDbClient();

  try {
    // Get all files with metadata
    const files = db.getAllFilesWithMetadata();

    // Get all completed parse records to understand actual relationships
    const allParses = db.getAllCompletedParses();

    // Build a map of output_path -> source file info
    const outputToSource = new Map<
      string,
      { fileId: number; parser: string }
    >();
    allParses.forEach((parse) => {
      outputToSource.set(parse.outputPath, {
        fileId: parse.fileId,
        parser: parse.parser,
      });
    });

    // Build file relationships using actual database relationships
    const fileMap = new Map<number, FileWithChain>();
    const rootFiles: FileWithChain[] = [];

    // Initialize all files
    files.forEach((file) => {
      const fileWithChain: FileWithChain = {
        ...file,
        children: [],
        level: 0,
        processingChain: [],
      };
      fileMap.set(file.id, fileWithChain);
    });

    // Build parent-child relationships based on actual parse records
    files.forEach((file) => {
      const fileWithChain = fileMap.get(file.id)!;

      // Check if this file was created by a parser (is an output)
      const sourceInfo = outputToSource.get(file.path);

      if (sourceInfo && sourceInfo.fileId !== file.id) {
        // This file is the output of a parser - find its parent
        const parentFile = fileMap.get(sourceInfo.fileId);

        if (parentFile) {
          fileWithChain.level = parentFile.level + 1;
          fileWithChain.parentPath = parentFile.path;
          fileWithChain.processingChain = [
            ...parentFile.processingChain,
            sourceInfo.parser,
          ];

          parentFile.children.push(fileWithChain);
        } else {
          // Parent not found in current file set, treat as root
          rootFiles.push(fileWithChain);
        }
      } else {
        // This file is not the output of a parser, or is a self-reference - treat as root
        rootFiles.push(fileWithChain);
      }
    });

    // Sort root files by creation date (newest first)
    rootFiles.sort((a, b) => b.createdAt - a.createdAt);

    // Sort children within each parent by processing order
    const sortChildren = (file: FileWithChain): void => {
      file.children.sort((a, b) => {
        // Sort by level first, then by creation date
        if (a.level !== b.level) return a.level - b.level;
        return a.createdAt - b.createdAt;
      });
      file.children.forEach(sortChildren);
    };

    rootFiles.forEach(sortChildren);

    return rootFiles;
  } catch (error) {
    console.error("Error building file chains:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load file chains",
    });
  }
});
