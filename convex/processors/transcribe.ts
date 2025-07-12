"use node";

import { internalAction } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import {
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  existsSync,
  readdirSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { spawn } from "node:child_process";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { DatabaseClient } from "../../core/db/client.js";

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for transcription"
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

async function transcribeAudio(audioPath: string): Promise<any> {
  const audioName = basename(audioPath);
  console.log(`  Transcribing: ${audioName}`);
  const openai = getOpenAIClient();
  const audioBuffer = readFileSync(audioPath);
  const audioExtension = extname(audioPath);
  const audioFile = await toFile(audioBuffer, `audio${audioExtension}`);

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    response_format: "verbose_json",
    temperature: 0.0,
  });

  return transcription;
}

async function getAudioStreamCount(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-i",
      inputPath,
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
    ]);
    let stdout = "";
    ffprobe.stdout.on("data", (data) => (stdout += data.toString()));
    ffprobe.on("close", (code) => {
      if (code === 0) {
        const streamCount = stdout.trim().split("\n").filter(Boolean).length;
        resolve(Math.max(1, streamCount));
      } else {
        resolve(1);
      }
    });
    ffprobe.on("error", () => resolve(1));
  });
}

async function chunkAudioFile(
  inputPath: string,
  tempDir: string
): Promise<string[]> {
  const inputName = basename(inputPath, extname(inputPath));
  const chunksDir = join(tempDir, "chunks");
  if (!existsSync(chunksDir)) {
    mkdirSync(chunksDir, { recursive: true });
  }
  const outputPattern = join(chunksDir, `${inputName}.chunk_%03d.mp3`);
  const audioStreamCount = await getAudioStreamCount(inputPath);

  const ffmpegArgs =
    audioStreamCount === 1
      ? [
          "-i",
          inputPath,
          "-map",
          "0:a:0",
          "-f",
          "segment",
          "-segment_time",
          "300",
          "-segment_format",
          "mp3",
          "-reset_timestamps",
          "1",
          "-acodec",
          "libmp3lame",
          "-ab",
          "192k",
          outputPattern,
        ]
      : [
          "-i",
          inputPath,
          "-filter_complex",
          `amix=inputs=${audioStreamCount}:duration=longest:dropout_transition=0`,
          "-f",
          "segment",
          "-segment_time",
          "300",
          "-segment_format",
          "mp3",
          "-reset_timestamps",
          "1",
          "-acodec",
          "libmp3lame",
          "-ab",
          "192k",
          outputPattern,
        ];

  await new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
    ffmpeg.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`))
    );
    ffmpeg.on("error", (error) =>
      reject(new Error(`FFmpeg spawn error: ${error.message}`))
    );
  });

  return readdirSync(chunksDir)
    .filter((f) => f.startsWith(`${inputName}.chunk_`) && f.endsWith(".mp3"))
    .sort()
    .map((f) => join(chunksDir, f));
}

export const run = internalAction({
  handler: async (ctx, { nodeId }: { nodeId: Id<"nodes"> }) => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable not set!");
    }
    const db = new DatabaseClient(convexUrl);

    const node = await db.getNode(nodeId);
    if (!node) {
      console.error(`[Processor:Transcribe] Node not found: ${nodeId}`);
      return;
    }

    const { artifactPath, nodeType } = node;
    if (nodeType !== "audio") {
      console.error(`[Processor:Transcribe] Invalid nodeType: ${nodeType}`);
      return;
    }

    const outputPath = artifactPath + ".transcript.txt";
    const fileSizeMB = statSync(artifactPath).size / (1024 * 1024);

    try {
      let finalTranscriptText: string;

      if (fileSizeMB <= 10) {
        const transcription = await transcribeAudio(artifactPath);
        finalTranscriptText = `[Audio: ${basename(artifactPath)}] ...\n\n${transcription.text}`; // Simplified for brevity
      } else {
        const tempDir = join(
          dirname(artifactPath),
          "tmp",
          `transcribe-${Date.now()}`
        );
        mkdirSync(tempDir, { recursive: true });
        try {
          const chunkFiles = await chunkAudioFile(artifactPath, tempDir);
          const transcripts = await Promise.all(
            chunkFiles.map((chunk) => transcribeAudio(chunk))
          );
          finalTranscriptText = transcripts
            .map((t, i) => `--- Chunk ${i + 1} ---\n\n${t.text}`)
            .join("\n\n");
        } finally {
          rmSync(tempDir, { recursive: true, force: true });
        }
      }

      writeFileSync(outputPath, finalTranscriptText, "utf-8");

      const transcriptNodeId = await db.createNode(outputPath, "transcript");
      await db.updateNodeState(transcriptNodeId, "succeeded");
      await db.createEdge(nodeId, transcriptNodeId);
      await db.updateNodeState(nodeId, "succeeded");
    } catch (error) {
      console.error(`[Processor:Transcribe] Failed:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await db.updateNodeState(nodeId, "failed", errorMessage);
    }
  },
});
