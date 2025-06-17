import { DatabaseClient } from "../../../db/client.js";
import type { ParserConfig } from "../../../types.js";

export default defineEventHandler(async (_event) => {
  const config = useRuntimeConfig();

  try {
    const db = new DatabaseClient(config.dbPath);
    const parserConfigs = db.getAllParserConfigs();

    return {
      configs: parserConfigs,
      validation: validateParserDependencies(parserConfigs),
    };
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to get parser configurations",
    });
  }
});

function validateParserDependencies(configs: ParserConfig[]) {
  const errors: string[] = [];
  const configNames = new Set(configs.map((c) => c.name));

  for (const config of configs) {
    for (const dep of config.dependsOn) {
      if (!configNames.has(dep)) {
        errors.push(
          `Parser "${config.name}" depends on missing parser "${dep}"`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
