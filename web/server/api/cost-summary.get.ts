import { QueueClient } from "../../../queue/client.js";
import { formatCost, formatDuration } from "../../../utils/cost-calculator.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));
    const waitingJobs = await queue.getJobs(["waiting"]);

    // Calculate total cost for waiting jobs (both transcription and summarization)
    let totalCost = 0;
    let totalDurationMinutes = 0;
    let transcriptionJobCount = 0;
    let summarizationJobCount = 0;

    const transcriptionJobs = waitingJobs
      .filter((job) => job.name === "transcribe" && job.data.estimatedCost)
      .map((job) => {
        totalCost += job.data.estimatedCost || 0;
        totalDurationMinutes += job.data.estimatedDurationMinutes || 0;
        transcriptionJobCount++;

        return {
          id: job.id,
          parser: job.name,
          path: job.data.path,
          estimatedCost: job.data.estimatedCost,
          estimatedDurationMinutes: job.data.estimatedDurationMinutes,
          fileSizeBytes: job.data.fileSizeBytes,
        };
      });

    const summarizationJobs = waitingJobs
      .filter((job) => job.name === "summarize" && job.data.estimatedCost)
      .map((job) => {
        totalCost += job.data.estimatedCost || 0;
        summarizationJobCount++;

        return {
          id: job.id,
          parser: job.name,
          path: job.data.path,
          estimatedCost: job.data.estimatedCost,
          estimatedInputTokens: job.data.estimatedInputTokens,
          estimatedOutputTokens: job.data.estimatedOutputTokens,
        };
      });

    const jobCosts = [...transcriptionJobs, ...summarizationJobs];

    return {
      totalCost: Math.round(totalCost * 10000) / 10000,
      totalDurationMinutes: Math.round(totalDurationMinutes * 100) / 100,
      transcriptionJobCount,
      summarizationJobCount,
      totalWaitingJobs: waitingJobs.length,
      formattedTotalCost: formatCost(totalCost),
      formattedTotalDuration: formatDuration(totalDurationMinutes),
      jobCosts,
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get cost summary",
    });
  }
});
