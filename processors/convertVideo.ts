import { spawn } from "node:child_process";
import { basename } from "node:path";
import { DatabaseClient } from "../core/db/client.js";
import type { Id } from "../convex/_generated/dataModel.js";

// This function is designed to be called by the scheduler.
// It is stateless and relies on the database for all its inputs and outputs.

/**
 * Converts a video file node to an MP3 audio file.
 *
 * @param db - An instance of the DatabaseClient.
 * @param node - The database node representing the video file to process.
 */
export async function run(db: DatabaseClient, nodeId: Id<"nodes">): Promise<void> {
  const node = await db.getNode(nodeId); // We'll need to implement getNode
  if (!node) {
    console.error(`[convertVideo] Node not found: ${nodeId}`);
    // We should probably update the node state to 'failed' here.
    return;
  }

  const inputPath = node.artifactPath;
  const outputPath = inputPath + ".mp3";
  const inputName = basename(inputPath);

  console.log(`[convertVideo] Processing: ${inputName}`);

  try {
    // The core ffmpeg logic remains largely the same.
    await convertVideoToAudio(inputPath, outputPath);

    // **The New Logic: Update the graph in the database.**
    // 1. Create a new node for the output MP3 file.
    const outputNodeId = await db.createNode(outputPath, "audio");

    // 2. Create an edge linking the input video to the output audio.
    await db.createEdge(nodeId, outputNodeId);

    // 3. Mark the original video node as 'succeeded'.
    await db.updateNodeState(nodeId, "succeeded");

    console.log(`[convertVideo] ✅ Success: ${inputName} -> ${basename(outputPath)}`);
    console.log(`[convertVideo]   - Updated graph: ${nodeId} -> ${outputNodeId}`);

  } catch (error) {
    console.error(`[convertVideo] ❌ Failed for ${inputName}:`, error);
    // Update the node state to 'failed' and record the error.
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await db.updateNodeState(nodeId, "failed", errorMessage);
  }
}

// The helper functions for ffprobe and ffmpeg can be moved here.
// They are largely unchanged from the original file.
async function getAudioStreamCount(inputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      "-i",
      inputPath,
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
    ];

    const ffprobe = spawn("ffprobe", ffprobeArgs);
    let stdout = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        const streamCount = stdout
          .trim()
          .split("\n")
          .filter((line) => line.trim()).length;
        resolve(Math.max(1, streamCount)); // At least 1 stream
      } else {
        console.warn(
          `ffprobe failed for ${inputPath}, assuming 1 audio stream`
        );
        resolve(1); // Fallback to 1 stream
      }
    });

    ffprobe.on("error", (error) => {
      console.warn(`ffprobe error for ${inputPath}:`, error.message);
      resolve(1); // Fallback to 1 stream
    });
  });
}

async function convertVideoToAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  // Detect number of audio streams
  const audioStreamCount = await getAudioStreamCount(inputPath);
  console.log(`  [convertVideo] Detected ${audioStreamCount} audio stream(s)`);

  return new Promise((resolve, reject) => {
    let ffmpegArgs: string[];

    if (audioStreamCount === 1) {
      // Single stream: simple conversion
      ffmpegArgs = [
        "-i",
        inputPath,
        "-map",
        "0:a:0",
        "-acodec",
        "libmp3lame",
        "-ab",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-y",
        outputPath,
      ];
    } else {
      // Multiple streams: mix them together
      console.log(`  [convertVideo] Mixing ${audioStreamCount} audio streams`);
      ffmpegArgs = [
        "-i",
        inputPath,
        "-filter_complex",
        `amix=inputs=${audioStreamCount}:duration=longest:dropout_transition=0`,
        "-acodec",
        "libmp3lame",
        "-ab",
        "192k",
        "-ar",
        "44100",
        "-ac",
        "2",
        "-y",
        outputPath,
      ];
    }

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
}
