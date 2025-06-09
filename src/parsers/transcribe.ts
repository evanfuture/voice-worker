import {
  writeFileSync,
  statSync,
  mkdirSync,
  existsSync,
  unlinkSync,
  readdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { spawn } from "node:child_process";
import type { Parser } from "../types.js";
import OpenAI from "openai";
import { toFile } from "openai/uploads";

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Real transcription function using OpenAI Whisper API
async function transcribeAudio(audioPath: string): Promise<string> {
  const audioName = basename(audioPath);
  console.log(`  Transcribing: ${audioName}`);

  try {
    // Read the audio file
    const audioBuffer = readFileSync(audioPath);

    // Convert to file format that OpenAI expects
    // Important: Include the correct file extension in the filename
    const audioExtension = extname(audioPath);
    const audioFile = await toFile(audioBuffer, `audio${audioExtension}`);

    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json", // Get detailed response with timestamps
      temperature: 0.0, // More deterministic output
    });

    // Format the response with timestamp information
    const transcript = `[Audio: ${audioName}]

Transcribed using OpenAI Whisper-1 model
Transcribed at: ${new Date().toISOString()}
Audio duration: ${transcription.duration ? transcription.duration.toFixed(2) + "s" : "unknown"}

================================================================================

${transcription.text}

================================================================================

${
  transcription.segments
    ? `
DETAILED SEGMENTS:
${transcription.segments
  .map(
    (segment, idx) => `
${String(idx + 1).padStart(3, "0")}. [${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s]
     ${segment.text.trim()}
`
  )
  .join("")}
`
    : ""
}
[End of transcription]`;

    return transcript;
  } catch (error) {
    console.error(
      `    ❌ OpenAI transcription failed for ${audioName}:`,
      error
    );

    // If OpenAI fails, provide a fallback error message instead of crashing
    const errorTranscript = `[Audio: ${audioName}]

❌ Transcription failed using OpenAI Whisper API
Error: ${error instanceof Error ? error.message : "Unknown error"}
Attempted at: ${new Date().toISOString()}

Please check:
1. OPENAI_API_KEY is set in your .env file
2. Your OpenAI account has available credits
3. The audio file format is supported (.mp3, .wav, .m4a, .mp4, .mov, .flac, .ogg, .webm)

[End of error report]`;

    return errorTranscript;
  }
}

// Function to chunk large audio files using FFmpeg
async function chunkAudioFile(
  inputPath: string,
  tempDir: string
): Promise<string[]> {
  const inputName = basename(inputPath, extname(inputPath));
  const chunksDir = join(tempDir, "chunks");

  // Create chunks directory
  if (!existsSync(chunksDir)) {
    mkdirSync(chunksDir, { recursive: true });
  }

  const outputPattern = join(chunksDir, `${inputName}.chunk_%03d.mp3`);
  const chunkDurationSeconds = 300; // 5 minutes for safe chunk size

  await new Promise<void>((resolve, reject) => {
    const ffmpegArgs = [
      "-i",
      inputPath,
      "-f",
      "segment",
      "-segment_time",
      chunkDurationSeconds.toString(),
      "-segment_format",
      "mp3",
      "-reset_timestamps",
      "1",
      "-map",
      "0:a", // Only audio stream
      "-c",
      "copy", // Copy without re-encoding
      outputPattern,
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`FFmpeg spawn error: ${error.message}`));
    });
  });

  // Return list of created chunk files
  const chunkFiles = readdirSync(chunksDir)
    .filter(
      (file) => file.startsWith(`${inputName}.chunk_`) && file.endsWith(".mp3")
    )
    .sort()
    .map((file) => join(chunksDir, file));

  return chunkFiles;
}

export const parser: Parser = {
  name: "transcribe",
  input: [".m4a", ".wav", ".mp3", ".mp4", ".mov"],
  outputExt: ".transcript.txt",
  dependsOn: [],

  async run(inputPath: string): Promise<string> {
    const stats = statSync(inputPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    const outputPath = inputPath + ".transcript.txt";

    console.log(
      `Transcribing: ${basename(inputPath)} (${fileSizeMB.toFixed(1)}MB)`
    );

    if (fileSizeMB <= 10) {
      // Small file: transcribe directly
      console.log(`Direct transcription (small file)`);
      const transcript = await transcribeAudio(inputPath);
      writeFileSync(outputPath, transcript, "utf-8");
    } else {
      // Large file: chunk, transcribe each chunk, merge results
      console.log(`Large file detected - using chunked transcription`);

      const inputDir = dirname(inputPath);
      const tempDir = join(inputDir, "tmp", `transcribe-${Date.now()}`);

      try {
        // Create temp directory
        mkdirSync(tempDir, { recursive: true });

        // Step 1: Chunk the audio file
        console.log(`  Chunking audio file...`);
        const chunkFiles = await chunkAudioFile(inputPath, tempDir);
        console.log(`  Created ${chunkFiles.length} chunks`);

        // Step 2: Transcribe each chunk
        console.log(`  Transcribing ${chunkFiles.length} chunks...`);
        const chunkTranscripts: {
          index: number;
          transcript: string;
          chunkPath: string;
        }[] = [];

        for (let i = 0; i < chunkFiles.length; i++) {
          const chunkPath = chunkFiles[i];
          const chunkName = basename(chunkPath);

          try {
            const transcript = await transcribeAudio(chunkPath);
            chunkTranscripts.push({ index: i, transcript, chunkPath });
            console.log(
              `    ✅ Transcribed chunk ${i + 1}/${chunkFiles.length}: ${chunkName}`
            );
          } catch (error) {
            console.error(
              `    ❌ Failed to transcribe chunk ${chunkName}:`,
              error
            );
            // Continue with other chunks
          }
        }

        // Step 3: Merge all transcripts
        console.log(`  Merging ${chunkTranscripts.length} transcripts...`);
        chunkTranscripts.sort((a, b) => a.index - b.index);

        const combinedTranscript = `TRANSCRIPTION

Original file: ${basename(inputPath)} (${fileSizeMB.toFixed(1)}MB)
Chunks processed: ${chunkTranscripts.length} of ${chunkFiles.length}
Transcribed at: ${new Date().toISOString()}

================================================================================

${chunkTranscripts
  .map((item, idx) => `--- Chunk ${idx + 1} ---\n\n${item.transcript}\n`)
  .join("\n")}

================================================================================

End of transcription.`;

        writeFileSync(outputPath, combinedTranscript, "utf-8");
      } finally {
        // Step 4: Clean up temp files
        try {
          console.log(`  Cleaning up temp files...`);
          if (existsSync(tempDir)) {
            // Remove all files in temp directory recursively
            const removeDir = (dirPath: string) => {
              const files = readdirSync(dirPath);
              for (const file of files) {
                const fullPath = join(dirPath, file);
                if (statSync(fullPath).isDirectory()) {
                  removeDir(fullPath);
                } else {
                  unlinkSync(fullPath);
                }
              }
              // Remove the directory itself
              rmSync(dirPath, { recursive: true, force: true });
            };
            removeDir(tempDir);
          }
        } catch (error) {
          console.warn(`Failed to clean up temp directory: ${error}`);
        }
      }
    }

    console.log(`✅ Transcription complete: ${basename(outputPath)}`);
    return outputPath;
  },
};
