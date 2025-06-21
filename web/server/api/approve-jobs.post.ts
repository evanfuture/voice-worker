import { getDbClient } from "../utils/db.js";
import { QueueClient } from "../../../core/queue/client.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);
    const { selectedJobs } = body as {
      selectedJobs: Array<{ fileId: number; parser: string }>;
    };

    if (!selectedJobs || !Array.isArray(selectedJobs)) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid request body. Expected selectedJobs array.",
      });
    }

    const db = getDbClient();
    const queue = new QueueClient(config.redisHost, parseInt(config.redisPort));

    let approvedCount = 0;

    // Group jobs by fileId for efficient processing
    const jobsByFileId = new Map<number, string[]>();
    for (const job of selectedJobs) {
      if (!jobsByFileId.has(job.fileId)) {
        jobsByFileId.set(job.fileId, []);
      }
      jobsByFileId.get(job.fileId)!.push(job.parser);
    }

    // Approve jobs and enqueue them
    for (const [fileId, parsers] of jobsByFileId) {
      const approved = db.approveParses(fileId, parsers);
      approvedCount += approved;

      // Get file path for enqueueing
      const file = db.getFileById(fileId);
      if (file) {
        for (const parser of parsers) {
          await queue.enqueueJob(parser, file.path);
          console.log(`📝 Approved and queued ${parser} for ${file.path}`);
        }
      }
    }

    db.close();
    await queue.close();

    return {
      success: true,
      message: `Approved ${approvedCount} jobs`,
      approvedCount,
    };
  } catch (error) {
    console.error("Failed to approve jobs:", error);

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError instances
    }

    throw createError({
      statusCode: 500,
      statusMessage: "Failed to approve jobs",
    });
  }
});
