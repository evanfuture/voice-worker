#!/usr/bin/env node

/**
 * Design System Test Suite
 *
 * Tests the complete design system pipeline:
 * - Token extraction from Vue components
 * - Style Dictionary build process
 * - Output file validation
 * - Token format verification
 * - Integration expectations
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Test results tracking
let tests = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests++;
  try {
    console.log(`🧪 Testing: ${name}`);
    fn();
    passed++;
    console.log(`✅ PASS: ${name}\n`);
  } catch (error) {
    failed++;
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExists(filePath, message) {
  assert(fs.existsSync(filePath), message || `File should exist: ${filePath}`);
}

function assertContains(content, substring, message) {
  assert(
    content.includes(substring),
    message || `Content should contain: ${substring}`
  );
}

function assertValidJSON(content, message) {
  try {
    JSON.parse(content);
  } catch (e) {
    throw new Error(message || `Invalid JSON: ${e.message}`);
  }
}

function assertValidCSS(content, message) {
  // Basic CSS validation - check for CSS variable format
  assert(content.includes(":root"), message || "CSS should contain :root");
  assert(content.includes("--"), message || "CSS should contain CSS variables");
}

console.log("🚀 Starting Design System Test Suite");
console.log("=====================================\n");

// Test 1: Source files exist
test("Source files exist", () => {
  assertExists("tokens.json", "tokens.json should exist");
  assertExists(
    "style-dictionary.config.js",
    "Style Dictionary config should exist"
  );
  assertExists("package.json", "package.json should exist");
  assertExists("extract-tokens.js", "Token extraction script should exist");
});

// Test 2: tokens.json is valid
test("tokens.json is valid JSON with expected structure", () => {
  const tokensContent = fs.readFileSync("tokens.json", "utf8");
  assertValidJSON(tokensContent, "tokens.json should be valid JSON");

  const tokens = JSON.parse(tokensContent);
  assert(tokens.color, "Should have color tokens");
  assert(tokens.size, "Should have size tokens");
  assert(tokens.typography, "Should have typography tokens");
  assert(tokens.shadow, "Should have shadow tokens");

  // Check specific token structure
  assert(tokens.color.brand.primary.value, "Should have brand primary color");
  assert(tokens.size.spacing.lg.value, "Should have spacing tokens");
  assert(
    tokens.typography["font-size"].base.value,
    "Should have font size tokens"
  );
});

// Test 3: Style Dictionary builds successfully
test("Style Dictionary builds without errors", () => {
  try {
    execSync("npm run build", { stdio: "pipe" });
  } catch (error) {
    throw new Error(`Build failed: ${error.message}`);
  }
});

// Test 4: All expected output files are generated
test("All output files are generated", () => {
  assertExists("dist/tokens.css", "CSS tokens should be generated");
  assertExists("dist/tokens.scss", "SCSS tokens should be generated");
  assertExists("dist/tokens.js", "JavaScript tokens should be generated");
  assertExists(
    "dist/tokens.d.ts",
    "TypeScript declarations should be generated"
  );
  assertExists("dist/figma-tokens.json", "Figma tokens should be generated");
});

// Test 5: CSS output is valid and contains expected tokens
test("CSS output is valid and contains expected tokens", () => {
  const cssContent = fs.readFileSync("dist/tokens.css", "utf8");
  assertValidCSS(cssContent, "Generated CSS should be valid");

  // Check for specific tokens
  assertContains(
    cssContent,
    "--color-brand-primary",
    "Should contain brand primary color"
  );
  assertContains(
    cssContent,
    "--size-spacing-lg",
    "Should contain spacing tokens"
  );
  assertContains(
    cssContent,
    "--typography-font-size-base",
    "Should contain typography tokens"
  );
  assertContains(cssContent, "--shadow-sm", "Should contain shadow tokens");

  // Check for expected values
  assertContains(
    cssContent,
    "#2563eb",
    "Should contain brand primary hex value"
  );
  assertContains(cssContent, "16px", "Should contain pixel spacing values");
});

// Test 6: Figma JSON output is valid and properly formatted
test("Figma JSON output is valid and properly formatted", () => {
  const figmaContent = fs.readFileSync("dist/figma-tokens.json", "utf8");
  assertValidJSON(figmaContent, "Figma tokens should be valid JSON");

  const figmaTokens = JSON.parse(figmaContent);

  // Check for proper Figma token structure
  assert(
    figmaTokens["color.brand.primary"],
    "Should have flattened token names"
  );

  const colorToken = figmaTokens["color.brand.primary"];
  assert(colorToken.type === "color", 'Color tokens should have type "color"');
  assert(colorToken.value, "Color tokens should have value");

  // Check RGB format for colors
  if (colorToken.value.r !== undefined) {
    assert(typeof colorToken.value.r === "number", "RGB red should be number");
    assert(
      colorToken.value.r >= 0 && colorToken.value.r <= 1,
      "RGB red should be 0-1"
    );
    assert(
      typeof colorToken.value.g === "number",
      "RGB green should be number"
    );
    assert(typeof colorToken.value.b === "number", "RGB blue should be number");
    assert(
      typeof colorToken.value.a === "number",
      "RGB alpha should be number"
    );
  }
});

// Test 7: JavaScript tokens are valid and importable
test("JavaScript tokens are valid and importable", () => {
  const jsContent = fs.readFileSync("dist/tokens.js", "utf8");

  // Check for module format
  assertContains(jsContent, "module.exports", "Should be CommonJS module");

  // Try to require the tokens (basic validation)
  delete require.cache[path.resolve("dist/tokens.js")];
  const tokens = require("../dist/tokens.js");

  assert(tokens.ColorBrandPrimary, "JS tokens should have brand primary color");
  assert(tokens.SizeSpacingLg, "JS tokens should have spacing tokens");
  assert(typeof tokens === "object", "JS tokens should be an object");
});

// Test 8: TypeScript declarations are valid
test("TypeScript declarations are valid", () => {
  const dtsContent = fs.readFileSync("dist/tokens.d.ts", "utf8");

  assertContains(dtsContent, "export", "Should have export declarations");
  assertContains(dtsContent, "ColorBrand", "Should declare color tokens");
  assertContains(dtsContent, "SizeSpacing", "Should declare size tokens");
});

// Test 9: Token extraction script works
test("Token extraction script works", () => {
  try {
    const output = execSync("node extract-tokens.js", { encoding: "utf8" });
    assertContains(
      output,
      "Analyzing Vue components",
      "Should analyze Vue components"
    );
    assertContains(output, "Colors found:", "Should find colors");
    assertContains(
      output,
      "Spacing values found:",
      "Should find spacing values"
    );
  } catch (error) {
    throw new Error(`Token extraction failed: ${error.message}`);
  }
});

// Test 10: Vue component integration
test("Vue components can be analyzed for tokens", () => {
  // Check that we can find the layout file
  const layoutPath = "../nuxt-web/layouts/default.vue";
  assertExists(layoutPath, "Default layout should exist for testing");

  const layoutContent = fs.readFileSync(layoutPath, "utf8");

  // Check that layout now uses CSS variables
  assertContains(
    layoutContent,
    "var(--color-",
    "Layout should use color variables"
  );
  assertContains(
    layoutContent,
    "var(--size-spacing-",
    "Layout should use spacing variables"
  );
  assertContains(
    layoutContent,
    "var(--typography-",
    "Layout should use typography variables"
  );
});

// Test 11: Package.json has correct dependencies and scripts
test("Package.json has correct configuration", () => {
  const packageContent = fs.readFileSync("package.json", "utf8");
  const packageJson = JSON.parse(packageContent);

  assert(
    packageJson.devDependencies["style-dictionary"],
    "Should have style-dictionary dependency"
  );
  assert(packageJson.scripts.build, "Should have build script");
  assert(
    packageJson.scripts.build.includes("style-dictionary"),
    "Build script should use style-dictionary"
  );
});

// Test 12: Nuxt configuration includes CSS import
test("Nuxt configuration includes design tokens CSS", () => {
  const nuxtConfigPath = "../nuxt-web/nuxt.config.ts";
  assertExists(nuxtConfigPath, "Nuxt config should exist");

  const nuxtContent = fs.readFileSync(nuxtConfigPath, "utf8");
  assertContains(nuxtContent, "css:", "Nuxt config should have CSS array");
  assertContains(
    nuxtContent,
    "design-system/dist/tokens.css",
    "Should import design tokens CSS"
  );
});

// Test 13: GitHub Actions workflow exists
test("GitHub Actions workflow exists", () => {
  const workflowPath = "../../.github/workflows/design-tokens.yml";
  assertExists(workflowPath, "GitHub Actions workflow should exist");

  const workflowContent = fs.readFileSync(workflowPath, "utf8");
  assertContains(
    workflowContent,
    "Design Tokens Sync",
    "Workflow should be for design tokens"
  );
  assertContains(workflowContent, "npm run build", "Should build tokens in CI");
  assertContains(
    workflowContent,
    "npm run test:smoke",
    "Should run tests in CI"
  );
});

// Test 14: Documentation files exist
test("Documentation files exist", () => {
  assertExists("README.md", "README should exist");
  assertExists("SETUP.md", "Setup guide should exist");
  assertExists("FIGMA_INTEGRATION.md", "Figma integration guide should exist");
});

// Test 15: Token values are consistent between formats
test("Token values are consistent between formats", () => {
  const tokensJson = JSON.parse(fs.readFileSync("tokens.json", "utf8"));
  const cssContent = fs.readFileSync("dist/tokens.css", "utf8");
  const jsTokens = require("../dist/tokens.js");

  // Check that primary brand color is consistent
  const expectedColor = tokensJson.color.brand.primary.value;

  assertContains(
    cssContent,
    expectedColor,
    "CSS should contain correct brand color"
  );
  assert(
    jsTokens.ColorBrandPrimary === expectedColor,
    "JS tokens should have correct brand color"
  );
});

// Test 16: File structure matches expectations
test("File structure matches expected layout", () => {
  const expectedFiles = [
    "tokens.json",
    "style-dictionary.config.js",
    "package.json",
    "extract-tokens.js",
    "dist/tokens.css",
    "dist/tokens.scss",
    "dist/tokens.js",
    "dist/tokens.d.ts",
    "dist/figma-tokens.json",
  ];

  expectedFiles.forEach((file) => {
    assertExists(file, `Expected file should exist: ${file}`);
  });
});

// Test Results Summary
console.log("🏁 Test Results Summary");
console.log("=======================");
console.log(`Total Tests: ${tests}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);

if (failed === 0) {
  console.log("\n🎉 All tests passed! Design system is working correctly.");
  process.exit(0);
} else {
  console.log(`\n💥 ${failed} test(s) failed. Please review the errors above.`);
  process.exit(1);
}
