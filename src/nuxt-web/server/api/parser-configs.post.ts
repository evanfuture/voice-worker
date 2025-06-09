import { DatabaseClient } from "../../../db/client.js";
import type { ParserConfig } from "../../../types.js";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  try {
    const body = await readBody(event);
    const db = new DatabaseClient(config.dbPath);

    // Validate required fields
    if (
      !body.name ||
      !body.parserImplementation ||
      !body.displayName ||
      !body.outputExt
    ) {
      throw createError({
        statusCode: 400,
        statusMessage:
          "Missing required fields: name, parserImplementation, displayName, outputExt",
      });
    }

    const parserConfig: Omit<ParserConfig, "id" | "createdAt" | "updatedAt"> = {
      name: body.name,
      parserImplementation: body.parserImplementation,
      displayName: body.displayName,
      description: body.description || "",
      inputExtensions: body.inputExtensions || [],
      inputTags: body.inputTags || [],
      outputExt: body.outputExt,
      dependsOn: body.dependsOn || [],
      isEnabled: body.isEnabled !== false, // Default to true
      allowUserSelection: body.allowUserSelection || false,
      allowDerivedFiles: body.allowDerivedFiles || false,
      config: body.config || {},
    };

    const result = db.upsertParserConfig(parserConfig);
    return result;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw createError errors
    }
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save parser configuration",
    });
  }
});
