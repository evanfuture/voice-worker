#!/usr/bin/env node

/**
 * Unified script runner for Voice Worker
 * Usage: node scripts/run.js <category> <script> [args...]
 * Example: node scripts/run.js tokens export-tokens
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log("Usage: node scripts/run.js <category> <script> [args...]");
  console.log("");
  console.log("Available categories:");
  console.log("  tokens      - Design token management scripts");
  console.log("  setup       - Setup and installation scripts");
  console.log("  maintenance - Database and queue maintenance scripts");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/run.js tokens export-tokens");
  console.log("  node scripts/run.js tokens import-tokens");
  console.log("  node scripts/run.js setup setup-penpot");
  process.exit(1);
}

const [category, scriptName, ...scriptArgs] = args;
const scriptPath = join(__dirname, category, `${scriptName}.js`);

if (!existsSync(scriptPath)) {
  console.error(`Script not found: ${scriptPath}`);
  process.exit(1);
}

// Execute the script
const child = spawn("node", [scriptPath, ...scriptArgs], {
  stdio: "inherit",
  cwd: process.cwd(),
});

child.on("close", (code) => {
  process.exit(code || 0);
});
