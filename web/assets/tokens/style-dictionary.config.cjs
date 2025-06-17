const StyleDictionary = require("style-dictionary");

// Register custom transforms for Figma compatibility
StyleDictionary.registerTransform({
  name: "color/figma",
  type: "value",
  matcher: (token) => token.attributes.category === "color",
  transformer: (token) => {
    // Only transform actual hex colors, not references
    if (typeof token.value === "string" && token.value.startsWith("#")) {
      const hex = token.value.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return { r, g, b, a: 1 };
    }
    // Return original value if it's not a hex color
    return token.value;
  },
});

// Register Figma-specific format
StyleDictionary.registerFormat({
  name: "json/figma-tokens",
  formatter: function (dictionary) {
    const tokens = {};

    dictionary.allTokens.forEach((token) => {
      const path = token.path.join(".");

      if (token.attributes.category === "color") {
        tokens[path] = {
          value: token.value,
          type: "color",
          description: token.comment || "",
        };
      } else if (token.attributes.category === "size") {
        tokens[path] = {
          value: token.value,
          type:
            token.attributes.type === "border-radius"
              ? "borderRadius"
              : "sizing",
          description: token.comment || "",
        };
      } else if (token.attributes.category === "typography") {
        tokens[path] = {
          value: token.value,
          type:
            token.attributes.type === "font-family"
              ? "fontFamilies"
              : token.attributes.type === "font-size"
                ? "fontSizes"
                : "fontWeights",
          description: token.comment || "",
        };
      } else if (token.attributes.category === "shadow") {
        tokens[path] = {
          value: token.value,
          type: "boxShadow",
          description: token.comment || "",
        };
      }
    });

    return JSON.stringify(tokens, null, 2);
  },
});

module.exports = {
  source: ["tokens.json"],
  platforms: {
    // CSS Custom Properties for your web app
    css: {
      transforms: [
        "attribute/cti",
        "name/cti/kebab",
        "time/seconds",
        "content/icon",
        "color/css",
      ],
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.css",
          format: "css/variables",
        },
      ],
    },

    // SCSS Variables
    scss: {
      transformGroup: "scss",
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.scss",
          format: "scss/variables",
        },
      ],
    },

    // JavaScript/TypeScript tokens
    js: {
      transforms: ["attribute/cti", "name/cti/pascal", "color/hex"],
      buildPath: "dist/",
      files: [
        {
          destination: "tokens.js",
          format: "javascript/module-flat",
        },
        {
          destination: "tokens.d.ts",
          format: "typescript/es6-declarations",
        },
      ],
    },

    // Figma Tokens Plugin format
    figma: {
      transforms: ["attribute/cti", "name/cti/kebab", "color/figma"],
      buildPath: "dist/",
      files: [
        {
          destination: "figma-tokens.json",
          format: "json/figma-tokens",
        },
      ],
    },
  },
};
