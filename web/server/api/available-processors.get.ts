// Since we can't easily load TypeScript processors in the Nuxt server context,
// let's return a hardcoded list of available processor implementations.
// In a production system, you might compile processors to JS or use a different approach.

export default defineEventHandler(async (_event) => {
  try {
    // Hardcoded list of available processor implementations
    // This matches the actual processor files in src/processors/
    const availableProcessors = [
      {
        name: "transcribe",
        inputExtensions: [
          ".m4a",
          ".wav",
          ".mp3",
          ".mp4",
          ".mov",
          ".avi",
          ".mkv",
          ".webm",
        ],
        outputExt: ".transcript.txt",
        dependsOn: [],
        description: "Converts audio/video files to text using OpenAI Whisper",
      },
      {
        name: "summarize",
        inputExtensions: [".transcript.txt", ".combined.transcript.txt"],
        outputExt: ".summary.txt",
        dependsOn: [],
        description: "Creates summaries from transcript files",
      },
      {
        name: "convert-video",
        inputExtensions: [".mov", ".mp4", ".avi", ".mkv", ".webm", ".flv"],
        outputExt: ".mp3",
        dependsOn: [],
        description: "Converts video files to MP3 audio files using FFmpeg",
      },
      {
        name: "comprehend-video",
        inputExtensions: [".mov", ".mp4", ".avi", ".mkv", ".webm", ".flv"],
        outputExt: ".shots.json",
        dependsOn: [],
        description:
          "Analyzes video files to detect shot boundaries using AI vision models",
      },
    ];

    return {
      processors: availableProcessors,
    };
  } catch (error) {
    console.error("Failed to load available processors:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load available processors",
    });
  }
});
