import { DatabaseClient } from "./dist/core/db/client.js";
import { ParserConfigManager } from "./dist/core/lib/config-manager.js";
import { ParserLoader } from "./dist/core/processors/loader.js";
import { existsSync } from "fs";

const db = new DatabaseClient("./data.db");
const parserLoader = new ParserLoader("./dist/core/processors");

(async () => {
  try {
    await parserLoader.loadParsers();
    const availableParsers = parserLoader.getAllParsers();
    const configManager = new ParserConfigManager(db);

    console.log("Available parsers:", Array.from(availableParsers.keys()));

    // Check specific transcript file
    const files = db
      .getAllFiles()
      .filter((f) => f.path.includes("IMG_1522.MOV.mp3.transcript.txt"));
    console.log("Found files:", files.length);

    if (files.length > 0) {
      const file = files[0];
      console.log("File ID:", file.id);
      console.log("File path:", file.path);
      console.log("File exists:", existsSync(file.path));

      const fileTags = db.getFileTags(file.id);
      console.log("File tags:", fileTags);

      const existingParses = db.getFileParses(file.id);
      console.log("Existing parses:", existingParses);

      const completedParsers = new Set();
      existingParses.forEach((parse) => {
        if (
          parse.status === "done" &&
          parse.outputPath &&
          existsSync(parse.outputPath)
        ) {
          completedParsers.add(parse.parser);
        }
      });
      console.log("Completed parsers:", Array.from(completedParsers));

      // Check applicable configs
      const applicableConfigs = configManager.getApplicableConfigs(
        file.path,
        fileTags.map((tag) => tag.tag),
        true // is derivative
      );
      console.log(
        "Applicable configs:",
        applicableConfigs.map((c) => c.name)
      );

      // Check ready configs
      const readyConfigs = configManager.getReadyConfigsWithParsers(
        file.path,
        fileTags.map((tag) => tag.tag),
        completedParsers,
        availableParsers,
        true // is derivative
      );
      console.log(
        "Ready configs:",
        readyConfigs.map((r) => r.config.name)
      );

      const predictedChain = configManager.predictProcessingChainWithCompleted(
        file.path,
        fileTags.map((tag) => tag.tag),
        availableParsers,
        completedParsers
      );
      console.log("Predicted chain:", predictedChain);
    }

    // Also check all predicted jobs
    const allPredictedJobs =
      await configManager.getAllPredictedJobs(availableParsers);
    console.log("All predicted jobs count:", allPredictedJobs.length);
    console.log(
      "Predicted jobs with summarize:",
      allPredictedJobs.filter((j) =>
        j.predictedChain.some((step) => step.parser === "summarize")
      ).length
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    db.close();
  }
})();
