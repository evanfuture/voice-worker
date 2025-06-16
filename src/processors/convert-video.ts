import { spawn } from "node:child_process";
import { basename, extname } from "node:path";
import { existsSync } from "node:fs";
import type { Parser } from "../types.js";

// Function to get audio stream count from a file
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

/**
 * Convert video files to MP3 audio using FFmpeg
 * Intelligently handles multiple audio streams by mixing them together
 * Can handle various video formats (.mov, .mp4, .avi, .mkv, etc.)
 */
async function convertVideoToAudio(
  inputPath: string,
  outputPath: string
): Promise<void> {
  // Detect number of audio streams
  const audioStreamCount = await getAudioStreamCount(inputPath);
  console.log(`  Detected ${audioStreamCount} audio stream(s) in video`);

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
      console.log(`  Mixing ${audioStreamCount} audio streams together`);
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

    console.log(
      `  Converting video to audio: ${basename(inputPath)} → ${basename(outputPath)}`
    );

    const ffmpeg = spawn("ffmpeg", ffmpegArgs);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(
          `  ✅ Video conversion successful (${audioStreamCount} streams mixed)`
        );
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

export const parser: Parser = {
  name: "convert-video",
  input: [".mov", ".mp4", ".avi", ".mkv", ".webm", ".flv"],
  outputExt: ".mp3",
  dependsOn: [],

  async run(inputPath: string, _config: Record<string, any> = {}): Promise<string> {
    // Check if input file exists before processing
    if (!existsSync(inputPath)) {
      throw new Error(`Input file no longer exists: ${inputPath}`);
    }

    const outputPath = inputPath + ".mp3";
    const inputName = basename(inputPath);

    console.log(`Converting video to audio: ${inputName}`);

    try {
      // Check if output already exists
      if (existsSync(outputPath)) {
        console.log(`  ⏭️  Output already exists: ${basename(outputPath)}`);
        return outputPath;
      }

      // Convert video to audio
      await convertVideoToAudio(inputPath, outputPath);

      console.log(`✅ Video conversion complete: ${basename(outputPath)}`);
      return outputPath;
    } catch (error) {
      console.error(`❌ Video conversion failed for ${inputName}:`, error);
      throw error;
    }
  },
};
