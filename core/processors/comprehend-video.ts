import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { basename, dirname, join, extname } from "node:path";
import OpenAI from "openai";
import type { Parser } from "../types.js";

// Lazy initialization of OpenAI client to avoid import-time API key requirement
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for video comprehension"
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

interface VideoInfo {
  duration: number; // in seconds
  fps: number;
  totalFrames: number;
}

// Get video information using ffprobe
async function getVideoInfo(inputPath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-select_streams",
      "v:0",
      inputPath,
    ];

    const ffprobe = spawn("ffprobe", ffprobeArgs);
    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);
          const videoStream = info.streams.find(
            (s: any) => s.codec_type === "video"
          );

          if (!videoStream) {
            reject(new Error("No video stream found"));
            return;
          }

          const duration = parseFloat(info.format.duration);
          const fpsStr = videoStream.r_frame_rate; // e.g., "30/1" or "29970/1000"
          const [num, den] = fpsStr.split("/").map(Number);
          const fps = num / den;
          const totalFrames = Math.floor(duration * fps);

          resolve({ duration, fps, totalFrames });
        } catch (error) {
          reject(new Error(`Failed to parse video info: ${error}`));
        }
      } else {
        reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
      }
    });

    ffprobe.on("error", (error) => {
      reject(new Error(`ffprobe spawn error: ${error.message}`));
    });
  });
}

// Extract frames at specific timestamps
async function extractFrames(
  inputPath: string,
  frameDir: string,
  timestamps: number[]
): Promise<string[]> {
  const framePaths: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const framePath = join(frameDir, `frame_${String(i).padStart(3, "0")}.jpg`);

    await new Promise<void>((resolve, reject) => {
      const ffmpegArgs = [
        "-ss",
        timestamp.toString(),
        "-i",
        inputPath,
        "-vframes",
        "1",
        "-q:v",
        "2", // High quality
        "-y",
        framePath,
      ];

      const ffmpeg = spawn("ffmpeg", ffmpegArgs);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          framePaths.push(framePath);
          resolve();
        } else {
          reject(new Error(`FFmpeg failed for frame ${i}: ${stderr}`));
        }
      });

      ffmpeg.on("error", (error) => {
        reject(
          new Error(`FFmpeg spawn error for frame ${i}: ${error.message}`)
        );
      });
    });
  }

  return framePaths;
}

// Create a composite image showing two frames side by side
async function createFramePair(
  frame1Path: string,
  frame2Path: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpegArgs = [
      "-i",
      frame1Path,
      "-i",
      frame2Path,
      "-filter_complex",
      "[0:v][1:v]hstack=inputs=2",
      "-y",
      outputPath,
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
        reject(new Error(`FFmpeg failed to create frame pair: ${stderr}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(new Error(`FFmpeg spawn error for frame pair: ${error.message}`));
    });
  });
}

// Analyze frame continuity using OpenAI Vision
async function analyzeFrameContinuity(
  imagePath: string,
  frameIndex: number
): Promise<{ continuous: boolean; confidence: number; reasoning: string }> {
  try {
    const openai = getOpenAIClient();

    // Read and encode the image
    const imageBuffer = readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // OpenAI's vision model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Given these two consecutive video frames shown side by side, analyze whether they represent continuous footage from the same shot or if there's a cut/transition between them.

Please respond with a JSON object containing:
- "continuous": boolean (true if same shot, false if there's a cut)
- "confidence": number (0-100, how certain you are)
- "reasoning": string (brief explanation of your decision)

Look for changes in:
- Camera angle or position
- Scene composition
- Lighting conditions
- Background elements
- Subject positioning
- Color palette shifts

A cut typically shows abrupt changes in these elements, while continuous shots have gradual or no changes.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1, // Low temperature for consistent analysis
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI Vision");
    }

    // Try to parse JSON response
    try {
      const analysis = JSON.parse(content);
      return {
        continuous: Boolean(analysis.continuous),
        confidence: Number(analysis.confidence) || 50,
        reasoning: String(analysis.reasoning) || "No reasoning provided",
      };
    } catch {
      // Fallback parsing for non-JSON responses
      const continuous =
        content.toLowerCase().includes("continuous") ||
        content.toLowerCase().includes("same shot") ||
        !content.toLowerCase().includes("cut");

      return {
        continuous,
        confidence: 50,
        reasoning: content.substring(0, 200) + "...",
      };
    }
  } catch (error) {
    console.error(`Failed to analyze frame pair ${frameIndex}:`, error);
    return {
      continuous: true, // Default to continuous to avoid false positives
      confidence: 0,
      reasoning: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

export const parser: Parser = {
  name: "comprehend-video",
  input: [".mov", ".mp4", ".avi", ".mkv", ".webm", ".flv"],
  outputExt: ".shots.json",
  dependsOn: [],

  async run(
    inputPath: string,
    config: Record<string, any> = {}
  ): Promise<string> {
    const outputPath = inputPath + ".shots.json";
    const inputName = basename(inputPath);
    const targetFrames = config.targetFrames || 100;

    console.log(
      `Analyzing video shots: ${inputName} (targeting ${targetFrames} frames)`
    );

    // Check if input file exists
    if (!existsSync(inputPath)) {
      throw new Error(`Input file no longer exists: ${inputPath}`);
    }

    // Check if output already exists
    if (existsSync(outputPath)) {
      console.log(`  ⏭️  Output already exists: ${basename(outputPath)}`);
      return outputPath;
    }

    const tempDir = join(dirname(inputPath), `temp_comprehend_${Date.now()}`);
    const frameDir = join(tempDir, "frames");
    const pairDir = join(tempDir, "pairs");

    try {
      // Create temporary directories
      mkdirSync(frameDir, { recursive: true });
      mkdirSync(pairDir, { recursive: true });

      // Get video information
      console.log("  📹 Analyzing video properties...");
      const videoInfo = await getVideoInfo(inputPath);
      console.log(
        `  Video: ${videoInfo.duration.toFixed(1)}s, ${videoInfo.fps.toFixed(1)}fps, ${videoInfo.totalFrames} total frames`
      );

      // Calculate frame timestamps (distributed evenly across the video)
      const actualFrameCount = Math.min(targetFrames, videoInfo.totalFrames);
      const timestamps: number[] = [];

      for (let i = 0; i < actualFrameCount; i++) {
        const progress = i / (actualFrameCount - 1); // 0 to 1
        const timestamp = progress * videoInfo.duration;
        timestamps.push(timestamp);
      }

      console.log(`  🎞️  Extracting ${actualFrameCount} frames...`);
      const framePaths = await extractFrames(inputPath, frameDir, timestamps);

      // Create frame pairs for comparison
      console.log(`  🖼️  Creating ${framePaths.length - 1} frame pairs...`);
      const pairPaths: string[] = [];

      for (let i = 0; i < framePaths.length - 1; i++) {
        const pairPath = join(
          pairDir,
          `pair_${String(i).padStart(3, "0")}.jpg`
        );
        await createFramePair(framePaths[i], framePaths[i + 1], pairPath);
        pairPaths.push(pairPath);
      }

      // Analyze frame pairs using OpenAI Vision
      console.log(
        `  🤖 Analyzing ${pairPaths.length} frame pairs for shot boundaries...`
      );
      const analyses: Array<{
        frameIndex: number;
        timestamp1: number;
        timestamp2: number;
        continuous: boolean;
        confidence: number;
        reasoning: string;
      }> = [];

      let totalCost = 0;
      for (let i = 0; i < pairPaths.length; i++) {
        console.log(`    Analyzing pair ${i + 1}/${pairPaths.length}...`);

        const analysis = await analyzeFrameContinuity(pairPaths[i], i);
        analyses.push({
          frameIndex: i,
          timestamp1: timestamps[i],
          timestamp2: timestamps[i + 1],
          continuous: analysis.continuous,
          confidence: analysis.confidence,
          reasoning: analysis.reasoning,
        });

        // Rough cost estimation (gpt-4o-mini vision is about $0.00015 per image)
        totalCost += 0.00015;

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Identify shot boundaries (where continuous = false and confidence > threshold)
      const confidenceThreshold = config.confidenceThreshold || 70;
      const shotBoundaries = analyses
        .filter((a) => !a.continuous && a.confidence >= confidenceThreshold)
        .map((a) => ({
          timestamp: a.timestamp2,
          confidence: a.confidence,
          reasoning: a.reasoning,
        }));

      // Create shots from boundaries
      const shots: Array<{
        startTime: number;
        endTime: number;
        duration: number;
      }> = [];

      let currentStart = 0;
      for (const boundary of shotBoundaries) {
        shots.push({
          startTime: currentStart,
          endTime: boundary.timestamp,
          duration: boundary.timestamp - currentStart,
        });
        currentStart = boundary.timestamp;
      }

      // Add final shot
      shots.push({
        startTime: currentStart,
        endTime: videoInfo.duration,
        duration: videoInfo.duration - currentStart,
      });

      // Create comprehensive output
      const result = {
        videoInfo: {
          path: inputPath,
          duration: videoInfo.duration,
          fps: videoInfo.fps,
          totalFrames: videoInfo.totalFrames,
        },
        processing: {
          framesAnalyzed: actualFrameCount,
          pairsAnalyzed: pairPaths.length,
          confidenceThreshold,
          estimatedCost: totalCost,
          processedAt: new Date().toISOString(),
        },
        analysis: analyses,
        shotBoundaries,
        shots,
        summary: {
          totalShots: shots.length,
          averageShotDuration:
            shots.reduce((sum, shot) => sum + shot.duration, 0) / shots.length,
          shortestShot: Math.min(...shots.map((s) => s.duration)),
          longestShot: Math.max(...shots.map((s) => s.duration)),
        },
      };

      // Write results
      writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");

      console.log(`  ✅ Video comprehension complete:`);
      console.log(`     📊 Found ${shots.length} shots`);
      console.log(`     📈 ${shotBoundaries.length} shot boundaries detected`);
      console.log(`     💰 Estimated cost: $${totalCost.toFixed(4)}`);
      console.log(`     📄 Results saved to: ${basename(outputPath)}`);

      return outputPath;
    } catch (error) {
      console.error(`❌ Video comprehension failed for ${inputName}:`, error);

      // Create error output
      const errorResult = {
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
          inputPath,
        },
      };

      writeFileSync(outputPath, JSON.stringify(errorResult, null, 2), "utf-8");
      throw error;
    } finally {
      // Clean up temporary files
      if (existsSync(tempDir)) {
        console.log("  🧹 Cleaning up temporary files...");
        rmSync(tempDir, { recursive: true, force: true });
      }
    }
  },
};
