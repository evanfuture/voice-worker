import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import type { Parser } from "../types.js";

export class ParserLoader {
  private parsers: Map<string, Parser> = new Map();
  private processorsDir: string;

  constructor(processorsDir: string) {
    this.processorsDir = processorsDir;
  }

  async loadParsers(): Promise<void> {
    console.log(
      `🔍 ParserLoader DEBUG: Starting loadParsers() with directory: ${this.processorsDir}`
    );
    console.log(
      `🔍 ParserLoader DEBUG: Current working directory: ${process.cwd()}`
    );

    try {
      console.log(
        `🔍 ParserLoader DEBUG: About to read directory: ${this.processorsDir}`
      );
      const files = await readdir(this.processorsDir);
      console.log(`🔍 ParserLoader DEBUG: Found ${files.length} files:`, files);

      // In runtime environments (like Nuxt/Nitro), prefer .js files over .ts files
      // since .ts files may not be transpiled on-the-fly
      const jsFiles = files.filter(
        (file: string) => extname(file) === ".js" && file !== "loader.js"
      );

      const tsFiles = files.filter(
        (file: string) => extname(file) === ".ts" && file !== "loader.ts"
      );

      // Prioritize .js files, fall back to .ts files if no .js files are found
      const parserFiles = jsFiles.length > 0 ? jsFiles : tsFiles;
      console.log(
        `🔍 ParserLoader DEBUG: Found ${jsFiles.length} JS files and ${tsFiles.length} TS files`
      );
      console.log(
        `🔍 ParserLoader DEBUG: Using ${parserFiles.length} parser files (${jsFiles.length > 0 ? "JS" : "TS"}):`,
        parserFiles
      );

      for (const file of parserFiles) {
        try {
          const filePath = join(this.processorsDir, file);
          const fileUrl = pathToFileURL(filePath).href;
          console.log(
            `🔍 ParserLoader DEBUG: Attempting to import ${file} from ${fileUrl}`
          );

          const module = await import(fileUrl);
          console.log(
            `🔍 ParserLoader DEBUG: Successfully imported ${file}, keys:`,
            Object.keys(module)
          );

          if (module.parser && this.isValidParser(module.parser)) {
            this.parsers.set(module.parser.name, module.parser);
            console.log(
              `🔍 ParserLoader DEBUG: ✅ Loaded parser: ${module.parser.name}`
            );
          } else {
            console.warn(
              `🔍 ParserLoader DEBUG: ❌ Invalid parser in ${file}: missing or invalid parser export. Module:`,
              module
            );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('Unknown file extension ".ts"')
          ) {
            console.warn(
              `🔍 ParserLoader DEBUG: ⚠️ Cannot load TypeScript file ${file} in runtime environment (expected - fallback will be used)`
            );
          } else {
            console.error(
              `🔍 ParserLoader DEBUG: ❌ Failed to load parser from ${file}:`,
              error
            );
            if (error instanceof Error) {
              console.error(
                `🔍 ParserLoader DEBUG: Error message: ${error.message}`
              );
              console.error(
                `🔍 ParserLoader DEBUG: Error stack: ${error.stack}`
              );
            }
          }
        }
      }

      console.log(
        `🔍 ParserLoader DEBUG: Final parser count: ${this.parsers.size}`
      );
      console.log(
        `🔍 ParserLoader DEBUG: Final parser names:`,
        Array.from(this.parsers.keys())
      );

      this.validateDependencies();
    } catch (error) {
      console.error("🔍 ParserLoader DEBUG: ❌ Failed to load parsers:", error);
      if (error instanceof Error) {
        console.error(
          `🔍 ParserLoader DEBUG: Top-level error message: ${error.message}`
        );
        console.error(
          `🔍 ParserLoader DEBUG: Top-level error stack: ${error.stack}`
        );
      }
    }
  }

  private isValidParser(parser: any): parser is Parser {
    const valid =
      typeof parser === "object" &&
      typeof parser.name === "string" &&
      Array.isArray(parser.input) &&
      typeof parser.outputExt === "string" &&
      Array.isArray(parser.dependsOn) &&
      typeof parser.run === "function";

    if (!valid) {
      console.log(
        `🔍 ParserLoader DEBUG: Parser validation failed for:`,
        parser
      );
      console.log(`🔍 ParserLoader DEBUG: Validation details:`, {
        isObject: typeof parser === "object",
        hasName: typeof parser?.name === "string",
        hasInput: Array.isArray(parser?.input),
        hasOutputExt: typeof parser?.outputExt === "string",
        hasDependsOn: Array.isArray(parser?.dependsOn),
        hasRun: typeof parser?.run === "function",
      });
    }

    return valid;
  }

  private validateDependencies(): void {
    for (const [name, parser] of this.parsers) {
      for (const dep of parser.dependsOn) {
        if (!this.parsers.has(dep)) {
          console.warn(`Parser "${name}" depends on missing parser "${dep}"`);
        }
      }
    }
  }

  getParser(name: string): Parser | undefined {
    return this.parsers.get(name);
  }

  getAllParsers(): Map<string, Parser> {
    return new Map(this.parsers);
  }

  getApplicableParsers(filePath: string): Parser[] {
    const ext = extname(filePath).toLowerCase();
    return Array.from(this.parsers.values()).filter((parser) =>
      parser.input.includes(ext)
    );
  }

  // Get parsers that can be run for a file, considering dependencies
  getReadyParsers(filePath: string, completedParsers: Set<string>): Parser[] {
    const applicable = this.getApplicableParsers(filePath);

    return applicable.filter((parser) => {
      // Check if all dependencies are completed
      return parser.dependsOn.every((dep) => completedParsers.has(dep));
    });
  }

  // Get the dependency order for a parser
  getDependencyOrder(parserName: string): string[] {
    const parser = this.parsers.get(parserName);
    if (!parser) return [];

    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string): void => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(
          `Circular dependency detected involving parser "${name}"`
        );
      }

      visiting.add(name);
      const p = this.parsers.get(name);
      if (p) {
        for (const dep of p.dependsOn) {
          visit(dep);
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    visit(parserName);
    return order;
  }
}
