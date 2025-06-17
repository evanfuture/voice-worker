# Voice Worker Design System

This directory contains the design tokens and configuration for the Voice Worker design system, with automatic Figma synchronization.

## Overview

The design system is built using [Style Dictionary](https://amzn.github.io/style-dictionary/) and provides:

- **Design tokens** as the single source of truth
- **CSS custom properties** for web development
- **SCSS variables** for advanced styling
- **JavaScript/TypeScript tokens** for programmatic access
- **Figma-compatible JSON** for design tool synchronization

## Quick Start

```bash
cd src/design-system
npm install
npm run build
```

## Figma Synchronization

### Setup in Figma:

1. **Install the Figma Tokens Plugin**:

   - Open Figma
   - Go to Plugins → Browse all plugins
   - Search for "Figma Tokens" and install

2. **Import tokens**:

   - In your Figma file, open the Figma Tokens plugin
   - Choose "Import" → "From URL or JSON"
   - Use the generated `dist/figma-tokens.json` file

3. **Automated updates**:
   - The GitHub Action automatically builds tokens on changes
   - Download the latest `figma-tokens.json` from GitHub Actions artifacts
   - Re-import in Figma Tokens plugin

### Token Structure

```
color/
├── brand/          # Primary brand colors
├── status/         # Success, error, warning states
├── neutral/        # Grayscale palette
├── background/     # Page and component backgrounds
├── text/           # Text color hierarchy
└── tag/            # Tag-specific colors

size/
├── spacing/        # Layout spacing scale
└── border-radius/  # Border radius values

typography/
├── font-family/    # Font stack definitions
├── font-size/      # Type scale
└── font-weight/    # Font weights

shadow/             # Box shadow definitions
```

### Usage in Vue Components

After building tokens, import the CSS variables:

```vue
<template>
  <div class="card">
    <h2 class="card-title">Hello World</h2>
  </div>
</template>

<style scoped>
@import "../design-system/dist/tokens.css";

.card {
  background: var(--color-background-card);
  border-radius: var(--size-border-radius-lg);
  padding: var(--size-spacing-lg);
  box-shadow: var(--shadow-sm);
}

.card-title {
  color: var(--color-text-primary);
  font-size: var(--typography-font-size-lg);
  font-weight: var(--typography-font-weight-medium);
}
</style>
```

### Adding New Tokens

1. Edit `tokens.json` with your new design tokens
2. Run `npm run build` to generate outputs
3. Commit both the source and generated files
4. GitHub Actions will automatically update the artifacts

### Token Naming Convention

- Use semantic names: `color-status-success` instead of `color-green-500`
- Follow the hierarchy: `category-subcategory-property`
- Use kebab-case for consistency

## Development

- `npm run build` - Build all token outputs
- `npm run watch` - Watch for changes and rebuild
- `npm run clean` - Remove generated files

## Integration with Nuxt

The design system integrates with your existing Nuxt app by:

1. **Importing CSS variables** in your Vue components
2. **Using JavaScript tokens** for dynamic styling
3. **Maintaining consistency** between code and design

Example Nuxt integration:

```javascript
// nuxt.config.ts
export default defineNuxtConfig({
  css: ["~/src/design-system/dist/tokens.css"],
});
```
