"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { DatabaseClient } from "../../core/db/client.js";
import { spawn } from "node:child_process";
import { basename } from "node:path";
import type { Id } from "../_generated/dataModel.js";

/**
 * The action that runs the video conversion processor.
 * It runs in a Node.js environment to allow the use of `child_process`.
 */
export const run = internalAction({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable not set!");
    }
    const db = new DatabaseClient(convexUrl);

    const node = await db.getNode(nodeId);
    if (!node) {
      console.error(`[convertVideo] Node not found: ${nodeId}`);
      return;
    }

    const inputPath = node.artifactPath;
    const outputPath = inputPath + ".mp3";
    const inputName = basename(inputPath);

    console.log(`[convertVideo] Processing: ${inputName}`);

    try {
      await convertVideoToAudio(inputPath, outputPath);

      const outputNodeId = await db.createNode(outputPath, "audio");
      await db.createEdge(nodeId, outputNodeId);
      await db.updateNodeState(nodeId, "succeeded");

      console.log(`[convertVideo] ✅ Success: ${inputName} -> ${basename(outputPath)}`);
      console.log(`[convertVideo]   - Updated graph: ${nodeId} -> ${outputNodeId}`);

    } catch (error) {
      console.error(`[convertVideo] ❌ Failed for ${inputName}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await db.updateNodeState(nodeId, "failed", errorMessage);
    }
  },
});

// Helper functions for ffmpeg
async function getAudioStreamCount(inputPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", ["-i", inputPath, "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0"]);
    let stdout = "";
    ffprobe.stdout.on("data", (data) => (stdout += data.toString()));
    ffprobe.on("close", (code) => {
      if (code === 0) {
        const count = stdout.trim().split("\n").filter(Boolean).length;
        resolve(Math.max(1, count));
      } else {
        resolve(1);
      }
    });
    ffprobe.on("error", () => resolve(1));
  });
}

async function convertVideoToAudio(inputPath: string, outputPath: string): Promise<void> {
  const streamCount = await getAudioStreamCount(inputPath);
  console.log(`  [convertVideo] Detected ${streamCount} audio stream(s)`);

  return new Promise((resolve, reject) => {
    const args = streamCount === 1
      ? ["-i", inputPath, "-map", "0:a:0", "-acodec", "libmp3lame", "-ab", "192k", "-ar", "44100", "-ac", "2", "-y", outputPath]
      : ["-i", inputPath, "-filter_complex", `amix=inputs=${streamCount}:duration=longest:dropout_transition=0`, "-acodec", "libmp3lame", "-ab", "192k", "-ar", "44100", "-ac", "2", "-y", outputPath];
    
    const ffmpeg = spawn("ffmpeg", args);
    let stderr = "";
    ffmpeg.stderr.on("data", (data) => (stderr += data.toString()));
    ffmpeg.on("close", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`)));
    ffmpeg.on("error", (err) => reject(new Error(`FFmpeg spawn error: ${err.message}`)));
  });
}