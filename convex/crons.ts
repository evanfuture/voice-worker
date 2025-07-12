import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Schedule the scheduler to run every minute.
crons.cron(
  "Schedule new nodes for processing",
  "*/1 * * * *", // Every minute
  internal.scheduler.scheduleNewNodes
);

export default crons;
