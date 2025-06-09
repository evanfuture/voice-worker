import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Parser } from "../types.js";

export const parser: Parser = {
  name: "summarize",
  input: [".transcript.txt", ".combined.transcript.txt"],
  outputExt: ".summary.txt",
  dependsOn: [], // Remove dependency to allow manual selection

  async run(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(/\.transcript\.txt$/, ".summary.txt");

    // Read the transcript content
    const transcriptContent = readFileSync(inputPath, "utf-8");

    // Enhanced mock summarization with better content analysis
    const lines = transcriptContent.split("\n");
    const contentLines = lines.filter(
      (line) =>
        line.trim() &&
        !line.startsWith("[") &&
        !line.startsWith("===") &&
        !line.startsWith("Transcribed") &&
        !line.startsWith("Audio duration") &&
        !line.includes("DETAILED SEGMENTS")
    );

    const wordCount = contentLines.join(" ").split(/\s+/).length;
    const estimatedReadingTime = Math.ceil(wordCount / 200); // 200 words per minute

    const mockSummary = `SUMMARY OF: ${basename(inputPath)}

Original transcript length: ${transcriptContent.length} characters
Estimated reading time: ${estimatedReadingTime} minutes
Content lines analyzed: ${contentLines.length}

KEY POINTS:
- This is an automatically generated summary
- The original file contained ${wordCount} words of transcribed content
- In a real implementation, this would use an LLM API to analyze the transcript
- The summary would extract key themes, topics, and important information
- Content appears to be ${contentLines.length > 50 ? "substantial" : "brief"} in nature

CONTENT OVERVIEW:
${
  contentLines.length > 0
    ? `The transcript contains meaningful content with ${contentLines.length} substantive lines. ` +
      `A real summary would provide insights about the actual spoken content, ` +
      `identifying main topics, key decisions, action items, and important quotes.`
    : "The transcript appears to be empty or contain only metadata."
}

SAMPLE CONTENT PREVIEW:
${contentLines
  .slice(0, 3)
  .map((line) => `• ${line.substring(0, 100)}${line.length > 100 ? "..." : ""}`)
  .join("\n")}

Generated at: ${new Date().toISOString()}
Source transcript: ${inputPath}
Processing mode: ${contentLines.length > 100 ? "Detailed analysis" : "Quick summary"}`;

    // Simulate API processing time based on content length
    const processingTime = Math.min(
      3000,
      Math.max(500, contentLines.length * 10)
    );
    await new Promise((resolve) => setTimeout(resolve, processingTime));

    writeFileSync(outputPath, mockSummary, "utf-8");

    return outputPath;
  },
};
