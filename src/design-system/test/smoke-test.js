#!/usr/bin/env node

/**
 * Design System Smoke Test
 *
 * Quick validation that the design system is working:
 * - Tokens build successfully
 * - Output files are generated
 * - Basic format validation
 */

const fs = require("fs");
const { execSync } = require("child_process");

console.log("🔥 Design System Smoke Test");
console.log("============================\n");

function smokeTest() {
  console.log("1. Building design tokens...");
  try {
    execSync("npm run build", { stdio: "pipe" });
    console.log("✅ Build successful\n");
  } catch (error) {
    console.log("❌ Build failed:", error.message);
    process.exit(1);
  }

  console.log("2. Checking output files...");
  const expectedFiles = [
    "dist/tokens.css",
    "dist/tokens.scss",
    "dist/tokens.js",
    "dist/tokens.d.ts",
    "dist/figma-tokens.json",
  ];

  const missing = expectedFiles.filter((file) => !fs.existsSync(file));

  if (missing.length > 0) {
    console.log("❌ Missing files:", missing.join(", "));
    process.exit(1);
  }
  console.log("✅ All output files generated\n");

  console.log("3. Validating CSS output...");
  const cssContent = fs.readFileSync("dist/tokens.css", "utf8");
  if (
    !cssContent.includes("--color-brand-primary") ||
    !cssContent.includes("#2563eb")
  ) {
    console.log("❌ CSS validation failed");
    process.exit(1);
  }
  console.log("✅ CSS contains expected tokens\n");

  console.log("4. Validating Figma JSON...");
  try {
    const figmaContent = JSON.parse(
      fs.readFileSync("dist/figma-tokens.json", "utf8")
    );
    if (
      !figmaContent["color.brand.primary"] ||
      !figmaContent["color.brand.primary"].type
    ) {
      throw new Error("Missing expected Figma token structure");
    }
    console.log("✅ Figma JSON is valid\n");
  } catch (error) {
    console.log("❌ Figma JSON validation failed:", error.message);
    process.exit(1);
  }

  console.log("5. Testing token extraction...");
  try {
    const output = execSync("node extract-tokens.js", { encoding: "utf8" });
    if (!output.includes("Colors found:")) {
      throw new Error("Token extraction not finding colors");
    }
    console.log("✅ Token extraction working\n");
  } catch (error) {
    console.log("❌ Token extraction failed:", error.message);
    process.exit(1);
  }

  console.log("🎉 All smoke tests passed! Design system is working.");
}

smokeTest();
