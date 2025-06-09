import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Parser } from "../types.js";

export const parser: Parser = {
  name: "chunk",
  input: [".txt"],
  outputExt: ".chunked.txt",
  dependsOn: [],

  async run(inputPath: string): Promise<string> {
    const outputPath = inputPath.replace(".txt", ".chunked.txt");

    // Read the input text file
    const content = readFileSync(inputPath, "utf-8");

    // Simple chunking: split by sentences and group into paragraphs
    const sentences = content
      .split(/[.!?]+/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const chunks: string[] = [];
    const chunkSize = 3; // sentences per chunk

    for (let i = 0; i < sentences.length; i += chunkSize) {
      const chunk = sentences.slice(i, i + chunkSize).join(". ") + ".";
      chunks.push(chunk);
    }

    const chunkedContent = `CHUNKED VERSION OF: ${basename(inputPath)}

Original length: ${content.length} characters
Number of chunks: ${chunks.length}
Chunk size: ${chunkSize} sentences per chunk

--- CHUNKS ---

${chunks
  .map(
    (chunk, index) => `[Chunk ${index + 1}]
${chunk}

`
  )
  .join("")}

Generated at: ${new Date().toISOString()}
Source file: ${inputPath}`;

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    writeFileSync(outputPath, chunkedContent, "utf-8");

    return outputPath;
  },
};
