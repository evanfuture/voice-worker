import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const clearAll = mutation({
  handler: async (ctx) => {
    const tableNames = [
      "jobs",
      "file_relationships",
      "files",
      "folders",
      "parsers",
      "cost_tracking",
      "sessions",
      "events",
    ];
    for (const tableName of tableNames) {
      const data = await ctx.db.query(tableName as any).collect();
      for (const doc of data) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});
