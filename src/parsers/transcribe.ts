import { writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { Parser } from "../types.js";

export const parser: Parser = {
  name: "transcribe",
  input: [".m4a", ".wav", ".mp3", ".mp4", ".mov"],
  outputExt: ".transcript.txt",
  dependsOn: [],

  async run(inputPath: string): Promise<string> {
    const outputPath = inputPath + ".transcript.txt";

    // Mock transcription - in real implementation, you'd call a transcription service
    const mockTranscript = `This is a mock transcription of the audio file: ${basename(inputPath)}

[00:00] Speaker 1: Hello and welcome to this audio recording.
[00:05] Speaker 1: This transcript was generated automatically.
[00:10] Speaker 1: In a real implementation, this would contain the actual transcribed speech.
[00:15] Speaker 1: For now, this serves as a placeholder to demonstrate the system.

Generated at: ${new Date().toISOString()}
Source file: ${inputPath}`;

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    writeFileSync(outputPath, mockTranscript, "utf-8");

    return outputPath;
  },
};
