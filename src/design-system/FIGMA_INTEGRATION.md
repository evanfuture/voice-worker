# Figma Integration Guide

## 🚀 Quick Setup (5 minutes)

### 1. Install Figma Tokens Plugin

1. Open Figma
2. Go to `Plugins` → `Browse all plugins`
3. Search for "Figma Tokens" by [Jan Six](https://www.figma.com/community/plugin/843461159747178946)
4. Click "Install"

### 2. Import Your Design Tokens

1. In your Figma file, open the Figma Tokens plugin (`Plugins` → `Figma Tokens`)
2. Go to the `Settings` tab
3. Click `Import` → `Import from File`
4. Upload the `src/design-system/dist/figma-tokens.json` file from your project
5. Click `Apply to document` to see your tokens in action

### 3. Start Using Tokens

Your tokens are now available in Figma! You can:

- Apply colors using token names (e.g., `color.brand.primary`)
- Use spacing tokens for layout
- Apply typography tokens for text styles
- Use border radius tokens for rounded corners

## 🔄 Workflow Integration

### Daily Designer Workflow:

1. **Design components** using the imported design tokens
2. **Export designs** for developer handoff
3. **Share Figma URLs** with developers via Storybook or documentation

### Daily Developer Workflow:

1. **Update tokens** in `src/design-system/tokens.json`
2. **Build tokens** with `npm run build`
3. **Commit changes** to trigger GitHub Actions
4. **Share new tokens** with designers via GitHub artifacts

### Bi-directional Sync:

1. **Designer updates** spacing/colors in Figma
2. **Developer updates** `tokens.json` to match
3. **GitHub Actions** rebuilds all formats
4. **Designer re-imports** updated tokens to Figma

## 📊 Token Categories Available

### Colors (RGB format for Figma):

- `color.brand.primary` - #2563eb
- `color.brand.secondary` - #1f2937
- `color.status.success` - #10b981
- `color.status.error` - #ef4444
- `color.neutral.*` - Full grayscale palette
- `color.background.*` - Page, card, hover states
- `color.text.*` - Primary, secondary, muted text

### Spacing (pixel values):

- `size.spacing.xs` - 4px
- `size.spacing.sm` - 8px
- `size.spacing.md` - 12px
- `size.spacing.lg` - 16px
- `size.spacing.xl` - 20px
- `size.spacing.2xl` - 24px

### Typography:

- `typography.font-size.*` - Complete type scale
- `typography.font-weight.*` - Normal, medium, bold
- `typography.font-family.base` - System font stack

### Border Radius:

- `size.border-radius.sm` - 4px
- `size.border-radius.md` - 6px
- `size.border-radius.lg` - 8px
- `size.border-radius.pill` - 16px

### Shadows:

- `shadow.sm` - Subtle card shadow
- `shadow.md` - Elevated component shadow

## 🔧 Advanced Usage

### Creating Component Variants:

1. **Select component** in Figma
2. **Open Figma Tokens plugin**
3. **Apply tokens** to different states:
   - Default: `color.text.secondary`
   - Hover: `color.text.primary`
   - Active: `color.brand.primary`

### Setting Up Styles:

1. **Create color styles** using token values
2. **Create text styles** using typography tokens
3. **Create effect styles** using shadow tokens
4. **Name styles** to match token names for consistency

### Team Collaboration:

1. **Share Figma file** with imported tokens
2. **Document token usage** in component descriptions
3. **Create style guide** showing token mappings
4. **Train team** on token naming conventions

## 🚨 Troubleshooting

### Tokens not appearing in Figma?

- Ensure you clicked "Apply to document" after import
- Check that the JSON file is valid (run `npm run build` first)
- Verify plugin is installed and up to date

### Colors look different?

- Figma uses RGB 0-1 format, which is automatically converted
- Check original hex values in `tokens.json` if needed
- Ensure no color profile conflicts

### Plugin not loading tokens?

- Try refreshing Figma
- Re-import the JSON file
- Check browser console for errors

### Spacing values incorrect?

- Verify units in `tokens.json` (px, rem, etc.)
- Check that Style Dictionary built correctly
- Ensure no CSS transform conflicts

## 📈 Benefits of This Workflow

### For Designers:

- ✅ **Consistent values** across all designs
- ✅ **Automatic updates** when tokens change
- ✅ **No guesswork** on spacing/colors
- ✅ **Perfect developer handoff**

### For Developers:

- ✅ **Design tokens match code** exactly
- ✅ **No manual CSS updates** needed
- ✅ **Automated build process**
- ✅ **Single source of truth**

### For Teams:

- ✅ **Reduced design debt**
- ✅ **Faster iteration cycles**
- ✅ **Consistent brand identity**
- ✅ **Scalable design system**

## 🎯 Next Steps

1. **Import tokens** into your Figma design file
2. **Create component library** using the design tokens
3. **Document component usage** with token references
4. **Set up regular sync** schedule with development team
5. **Expand token system** as needed for new features

---

**Need help?** Check the [main README](./README.md) for more details or the [setup guide](./SETUP.md) for technical configuration.
