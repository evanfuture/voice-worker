#!/usr/bin/env node

/**
 * Token Extraction Script
 *
 * This script analyzes existing Vue components and CSS to extract design tokens
 * and update the tokens.json file automatically.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");

// Patterns to extract tokens from CSS
const TOKEN_PATTERNS = {
  colors: {
    hex: /#([0-9a-fA-F]{3,6})/g,
    rgb: /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
    rgba: /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/g,
  },
  spacing: {
    px: /(?:padding|margin|gap|top|left|right|bottom|width|height|max-width|min-width):\s*(\d+)px/g,
    rem: /(?:padding|margin|gap|font-size):\s*(\d+(?:\.\d+)?)rem/g,
  },
  borderRadius: {
    px: /border-radius:\s*(\d+)px/g,
  },
  fontSize: {
    rem: /font-size:\s*(\d+(?:\.\d+)?)rem/g,
    em: /font-size:\s*(\d+(?:\.\d+)?)em/g,
  },
  fontWeight: {
    numeric: /font-weight:\s*(\d+)/g,
  },
  boxShadow: {
    shadow: /box-shadow:\s*([^;}]+)/g,
  },
};

function extractTokensFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const tokens = {
    colors: new Set(),
    spacing: new Set(),
    borderRadius: new Set(),
    fontSize: new Set(),
    fontWeight: new Set(),
    boxShadow: new Set(),
  };

  // Extract colors
  const hexMatches = content.match(TOKEN_PATTERNS.colors.hex) || [];
  hexMatches.forEach((hex) => tokens.colors.add(hex));

  // Extract spacing values
  const pxMatches = content.match(TOKEN_PATTERNS.spacing.px) || [];
  pxMatches.forEach((match) => {
    const value = match.match(/(\d+)/)[1];
    tokens.spacing.add(`${value}px`);
  });

  const remMatches = content.match(TOKEN_PATTERNS.spacing.rem) || [];
  remMatches.forEach((match) => {
    const value = match.match(/(\d+(?:\.\d+)?)/)[1];
    tokens.spacing.add(`${value}rem`);
  });

  // Extract border radius
  const borderRadiusMatches =
    content.match(TOKEN_PATTERNS.borderRadius.px) || [];
  borderRadiusMatches.forEach((match) => {
    const value = match.match(/(\d+)/)[1];
    tokens.borderRadius.add(`${value}px`);
  });

  // Extract font sizes
  const fontSizeMatches = content.match(TOKEN_PATTERNS.fontSize.rem) || [];
  fontSizeMatches.forEach((match) => {
    const value = match.match(/(\d+(?:\.\d+)?)/)[1];
    tokens.fontSize.add(`${value}rem`);
  });

  // Extract font weights
  const fontWeightMatches =
    content.match(TOKEN_PATTERNS.fontWeight.numeric) || [];
  fontWeightMatches.forEach((match) => {
    const value = match.match(/(\d+)/)[1];
    tokens.fontWeight.add(value);
  });

  // Extract box shadows
  const shadowMatches = content.match(TOKEN_PATTERNS.boxShadow.shadow) || [];
  shadowMatches.forEach((match) => {
    const value = match.replace("box-shadow:", "").trim();
    tokens.boxShadow.add(value);
  });

  return tokens;
}

function analyzeComponents() {
  console.log("🔍 Analyzing Vue components for design tokens...");

  const vueFiles = glob.sync("../nuxt-web/**/*.vue");
  const allTokens = {
    colors: new Set(),
    spacing: new Set(),
    borderRadius: new Set(),
    fontSize: new Set(),
    fontWeight: new Set(),
    boxShadow: new Set(),
  };

  vueFiles.forEach((file) => {
    console.log(`   Analyzing: ${file}`);
    const tokens = extractTokensFromFile(file);

    // Merge tokens
    Object.keys(tokens).forEach((category) => {
      tokens[category].forEach((token) => allTokens[category].add(token));
    });
  });

  return allTokens;
}

function generateTokenSuggestions(extractedTokens) {
  console.log("\n📋 Extracted Design Tokens:");
  console.log("=====================================");

  // Colors
  if (extractedTokens.colors.size > 0) {
    console.log("\n🎨 Colors found:");
    Array.from(extractedTokens.colors)
      .sort()
      .forEach((color) => {
        console.log(`   ${color}`);
      });
  }

  // Spacing
  if (extractedTokens.spacing.size > 0) {
    console.log("\n📏 Spacing values found:");
    Array.from(extractedTokens.spacing)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((spacing) => {
        console.log(`   ${spacing}`);
      });
  }

  // Border Radius
  if (extractedTokens.borderRadius.size > 0) {
    console.log("\n🔄 Border radius values found:");
    Array.from(extractedTokens.borderRadius)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((radius) => {
        console.log(`   ${radius}`);
      });
  }

  // Font Sizes
  if (extractedTokens.fontSize.size > 0) {
    console.log("\n📝 Font sizes found:");
    Array.from(extractedTokens.fontSize)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .forEach((size) => {
        console.log(`   ${size}`);
      });
  }

  // Font Weights
  if (extractedTokens.fontWeight.size > 0) {
    console.log("\n💪 Font weights found:");
    Array.from(extractedTokens.fontWeight)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((weight) => {
        console.log(`   ${weight}`);
      });
  }

  // Box Shadows
  if (extractedTokens.boxShadow.size > 0) {
    console.log("\n👥 Box shadows found:");
    Array.from(extractedTokens.boxShadow).forEach((shadow) => {
      console.log(`   ${shadow}`);
    });
  }

  console.log("\n💡 Next steps:");
  console.log("1. Review the extracted tokens above");
  console.log(
    "2. Update src/design-system/tokens.json with standardized values"
  );
  console.log('3. Run "npm run build" to generate CSS variables');
  console.log("4. Refactor components to use the new design tokens");
}

// Run the analysis
if (require.main === module) {
  const extractedTokens = analyzeComponents();
  generateTokenSuggestions(extractedTokens);
}
