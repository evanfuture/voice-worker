import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import type { Parser } from "../types.js";

export class ParserLoader {
  private parsers: Map<string, Parser> = new Map();
  private parsersDir: string;

  constructor(parsersDir: string) {
    this.parsersDir = parsersDir;
  }

  async loadParsers(): Promise<void> {
    try {
      const files = await readdir(this.parsersDir);
      const parserFiles = files.filter(
        (file: string) =>
          (extname(file) === ".ts" || extname(file) === ".js") &&
          file !== "loader.ts" &&
          file !== "loader.js"
      );

      for (const file of parserFiles) {
        try {
          const filePath = join(this.parsersDir, file);
          const fileUrl = pathToFileURL(filePath).href;
          const module = await import(fileUrl);

          if (module.parser && this.isValidParser(module.parser)) {
            this.parsers.set(module.parser.name, module.parser);
            console.log(`Loaded parser: ${module.parser.name}`);
          } else {
            console.warn(
              `Invalid parser in ${file}: missing or invalid parser export`
            );
          }
        } catch (error) {
          console.error(`Failed to load parser from ${file}:`, error);
        }
      }

      this.validateDependencies();
    } catch (error) {
      console.error("Failed to load parsers:", error);
    }
  }

  private isValidParser(parser: any): parser is Parser {
    return (
      typeof parser === "object" &&
      typeof parser.name === "string" &&
      Array.isArray(parser.input) &&
      typeof parser.outputExt === "string" &&
      Array.isArray(parser.dependsOn) &&
      typeof parser.run === "function"
    );
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
