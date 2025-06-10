// Since we can't easily load TypeScript parsers in the Nuxt server context,
// let's return a hardcoded list of available parser implementations.
// In a production system, you might compile parsers to JS or use a different approach.

export default defineEventHandler(async (_event) => {
  try {
    // Hardcoded list of available parser implementations
    // This matches the actual processor files in src/processors/
    const availableParsers = [
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
    ];

    return {
      parsers: availableParsers,
    };
  } catch (error) {
    console.error("Failed to load available parsers:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to load available parsers",
    });
  }
});
