import { getDbClient } from "../utils/db.js";

export default defineEventHandler(async (_event) => {
  const db = getDbClient();

  try {
    // Get all files
    const files = db.getAllFilesWithMetadata();

    // Categorize files
    const original = files.filter((f) => f.kind === "original");
    const derivative = files.filter((f) => f.kind === "derivative");

    // Group by file types
    const fileTypes = {
      mov: files.filter((f) => f.path.endsWith(".mov")),
      mp3: files.filter((f) => f.path.endsWith(".mp3")),
      transcript: files.filter((f) => f.path.includes(".transcript.txt")),
      summary: files.filter((f) => f.path.includes(".summary.txt")),
    };

    // Check for potential parent-child relationships
    const relationships: Array<{
      childPath: string;
      childKind: string;
      parentPath: string;
      parentExists: boolean;
      pattern: string;
    }> = [];

    files.forEach((file) => {
      if (file.kind === "derivative") {
        let potentialParent = null;
        let pattern = "";

        if (
          file.path.endsWith(".mp3") &&
          !file.path.includes(".transcript.") &&
          !file.path.includes(".summary.")
        ) {
          // video.mov -> video.mov.mp3
          const parentPath = file.path.replace(/\.mp3$/, "");
          potentialParent = files.find((f) => f.path === parentPath);
          pattern = "convert-video";
        } else if (file.path.includes(".transcript.txt")) {
          // audio.mp3 -> audio.mp3.transcript.txt
          const parentPath = file.path.replace(/\.transcript\.txt$/, "");
          potentialParent = files.find((f) => f.path === parentPath);
          pattern = "transcribe";
        } else if (file.path.includes(".summary.txt")) {
          // file.transcript.txt -> file.transcript.txt.summary.txt
          const parentPath = file.path.replace(/\.summary\.txt$/, "");
          potentialParent = files.find((f) => f.path === parentPath);
          pattern = "summarize";
        }

        relationships.push({
          childPath: file.path,
          childKind: file.kind,
          parentPath: potentialParent?.path || "NOT_FOUND",
          parentExists: !!potentialParent,
          pattern,
        });
      }
    });

    return {
      totalFiles: files.length,
      original: original.length,
      derivative: derivative.length,
      fileTypes: {
        mov: fileTypes.mov.length,
        mp3: fileTypes.mp3.length,
        transcript: fileTypes.transcript.length,
        summary: fileTypes.summary.length,
      },
      relationships,
      sampleFiles: files.slice(0, 5).map((f) => ({
        id: f.id,
        path: f.path,
        kind: f.kind,
        tags: f.tags.map((t) => t.tag),
      })),
    };
  } catch (error) {
    console.error("Debug files error:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to debug files",
    });
  }
});
