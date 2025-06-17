# Design System Setup Guide

## Quick Setup (5 minutes)

### 1. Install Dependencies

```bash
cd src/design-system
npm install
```

### 2. Build Initial Tokens

```bash
npm run build
```

### 3. Extract Existing Tokens (Optional)

```bash
node extract-tokens.js
```

This will analyze your existing Vue components and suggest tokens to add.

### 4. Integrate with Nuxt

Add to your `nuxt.config.ts`:

```javascript
export default defineNuxtConfig({
  css: ["~/src/design-system/dist/tokens.css"],
});
```

### 5. Setup Figma Sync

#### In Figma:

1. Install the "Figma Tokens" plugin from the community
2. In your design file, open the plugin
3. Go to Settings → Import
4. Choose "Import from File" and upload `src/design-system/dist/figma-tokens.json`

#### For Automated Updates:

1. After making changes to `tokens.json`, commit and push
2. GitHub Actions will automatically build new tokens
3. Download the latest `figma-tokens.json` from the Actions artifacts
4. Re-import in Figma Tokens plugin

## Usage Examples

### In Vue Components:

```vue
<template>
  <div class="status-card">
    <h3>System Status</h3>
    <span class="status-badge success">Connected</span>
  </div>
</template>

<style scoped>
.status-card {
  background: var(--color-background-card);
  border-radius: var(--size-border-radius-lg);
  padding: var(--size-spacing-lg);
  box-shadow: var(--shadow-sm);
}

.status-badge {
  padding: var(--size-spacing-xs) var(--size-spacing-sm);
  border-radius: var(--size-border-radius-pill);
  font-size: var(--typography-font-size-sm);
  font-weight: var(--typography-font-weight-medium);
}

.status-badge.success {
  background: var(--color-status-success);
  color: white;
}
</style>
```

### JavaScript/TypeScript Usage:

```typescript
import tokens from "../design-system/dist/tokens.js";

// Programmatic access to design tokens
const primaryColor = tokens.color.brand.primary.value;
const spacingLg = tokens.size.spacing.lg.value;
```

## Advanced Features

### Custom Token Categories

Add new token categories by editing `tokens.json`:

```json
{
  "animation": {
    "duration": {
      "fast": { "value": "150ms" },
      "normal": { "value": "300ms" },
      "slow": { "value": "500ms" }
    }
  }
}
```

### Conditional Tokens

Create theme-specific tokens:

```json
{
  "color": {
    "theme": {
      "light": {
        "background": { "value": "#ffffff" }
      },
      "dark": {
        "background": { "value": "#1a1a1a" }
      }
    }
  }
}
```

## Figma Workflow

### Daily Workflow:

1. **Designer** updates colors/spacing in Figma
2. **Developer** exports tokens from Figma Tokens plugin
3. **Developer** updates `tokens.json` in code
4. **System** automatically generates new CSS variables
5. **Components** automatically use new tokens

### Design Handoff:

1. Designer creates components in Figma using design tokens
2. Developer inspects component and sees token names instead of raw values
3. Developer implements using the same token names in CSS
4. Perfect consistency between design and code

## Troubleshooting

### Tokens not updating in Figma:

- Make sure you've imported the latest `figma-tokens.json`
- Check that the Figma Tokens plugin is set to "Apply to document"

### CSS variables not working:

- Verify `tokens.css` is imported in your Nuxt config
- Check browser DevTools to see if variables are defined

### Build failing:

- Ensure all dependencies are installed in `src/design-system/`
- Check that `tokens.json` is valid JSON
