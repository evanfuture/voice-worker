# Design Tool Integration Guide

## 🆓 Free & Open Design Tools (No Vendor Lock-in!)

### Choose Your Approach:

**🎨 Option A: Penpot (Recommended)**

- Completely free and open-source
- Native design tokens built-in
- Self-hostable for complete control
- Web standards (SVG, HTML, CSS)
- No file format lock-in

**🎨 Option B: Figma with Variables**

- Free with Figma's native Variables
- No plugins required
- Works with existing Figma workflows

---

## 🚀 Penpot API Automation (Recommended)

### Why Penpot API Integration?

- ✅ **100% Free Forever** - Open-source, never pay anything
- ✅ **On-Demand Sync** - Import/export tokens when you need them
- ✅ **Scriptable Workflows** - Automate with simple scripts
- ✅ **No Vendor Lock-in** - Open standards (W3C DTCG format)
- ✅ **Native Design Tokens** - Built-in support, no plugins needed

## 🔧 API Setup (5 minutes)

### 1. Get Your Penpot Credentials

1. Sign up at [penpot.app](https://penpot.app) (free)
2. Create a new project and file
3. Note your file ID from the URL: `https://design.penpot.app/#/workspace/[workspace-id]/[project-id]/[file-id]`
4. https://design.penpot.app/#/workspace?team-id=d27e272d-6b22-8014-8006-597306d9ee3f&file-id=d27e272d-6b22-8014-8006-5973917daef9&page-id=d27e272d-6b22-8014-8006-5973917daefa

### 2. Set Up Environment Variables

Create a `.env` file in your project root:

```bash
# Penpot API Configuration
PENPOT_API_URL=https://design.penpot.app/api
PENPOT_USERNAME=your_email@example.com
PENPOT_PASSWORD=your_password
PENPOT_FILE_ID=your_file_id_from_url
```

### 3. Install Dependencies

```bash
npm install axios dotenv
# or
yarn add axios dotenv
```

## 🤖 Automation Scripts

### Token Export Script

Create `scripts/export-tokens.js`:

```javascript
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

async function exportTokens() {
  try {
    // 1. Login to get auth token
    const loginResponse = await axios.post(
      `${process.env.PENPOT_API_URL}/auth/login`,
      {
        email: process.env.PENPOT_USERNAME,
        password: process.env.PENPOT_PASSWORD,
      }
    );

    const authToken = loginResponse.data.token;

    // 2. Export tokens from Penpot file
    const tokensResponse = await axios.get(
      `${process.env.PENPOT_API_URL}/files/${process.env.PENPOT_FILE_ID}/tokens`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    // 3. Save to our design system
    const tokens = tokensResponse.data;
    fs.writeFileSync(
      "src/design-system/dist/penpot-tokens.json",
      JSON.stringify(tokens, null, 2)
    );

    console.log("✅ Tokens exported successfully!");
    console.log(`📁 Saved to: src/design-system/dist/penpot-tokens.json`);
    console.log(`🎨 Found ${Object.keys(tokens).length} token sets`);
  } catch (error) {
    console.error("❌ Export failed:", error.response?.data || error.message);
  }
}

exportTokens();
```

### Token Import Script

Create `scripts/import-tokens.js`:

```javascript
const axios = require("axios");
const fs = require("fs");
require("dotenv").config();

async function importTokens() {
  try {
    // 1. Read our generated tokens
    const tokensPath = "src/design-system/dist/figma-tokens.json";
    if (!fs.existsSync(tokensPath)) {
      console.log("⚠️  No tokens file found. Run: npm run build");
      return;
    }

    const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));

    // 2. Login to Penpot
    const loginResponse = await axios.post(
      `${process.env.PENPOT_API_URL}/auth/login`,
      {
        email: process.env.PENPOT_USERNAME,
        password: process.env.PENPOT_PASSWORD,
      }
    );

    const authToken = loginResponse.data.token;

    // 3. Import tokens to Penpot
    await axios.post(
      `${process.env.PENPOT_API_URL}/files/${process.env.PENPOT_FILE_ID}/tokens`,
      tokens,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Tokens imported successfully!");
    console.log("🎨 Your Penpot file now has the latest design tokens");
  } catch (error) {
    console.error("❌ Import failed:", error.response?.data || error.message);
  }
}

importTokens();
```

### Add NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "tokens:export": "node scripts/export-tokens.js",
    "tokens:import": "node scripts/import-tokens.js",
    "tokens:sync": "npm run build && npm run tokens:import"
  }
}
```

## 🎯 Usage

### Export Tokens from Penpot

```bash
npm run tokens:export
```

### Import Tokens to Penpot

```bash
npm run tokens:import
```

### Full Sync (Build + Import)

```bash
npm run tokens:sync
```

## 🔄 Workflow Integration

### Development Workflow

```bash
# 1. Make changes to your Style Dictionary tokens
vim src/design-system/tokens/colors.json

# 2. Build and sync to Penpot
npm run tokens:sync

# 3. Design in Penpot with your latest tokens
# 4. Export any design changes back
npm run tokens:export
```

### CI/CD Integration

Add to your `.github/workflows/design-tokens.yml`:

```yaml
name: Sync Design Tokens

on:
  push:
    paths:
      - "src/design-system/tokens/**"

jobs:
  sync-tokens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - run: npm install
      - run: npm run build
      - run: npm run tokens:import
        env:
          PENPOT_USERNAME: ${{ secrets.PENPOT_USERNAME }}
          PENPOT_PASSWORD: ${{ secrets.PENPOT_PASSWORD }}
          PENPOT_FILE_ID: ${{ secrets.PENPOT_FILE_ID }}
```

## 🎨 Alternative: Penpot Variables (Manual)

If you prefer a manual approach, you can also use Penpot's native Variables:

1. **Export from Style Dictionary**: Use our generated `figma-tokens.json`
2. **Import to Penpot**: Use the Tokens panel → Tools → Import
3. **Apply Tokens**: Right-click tokens to apply to design elements
4. **Export Changes**: Use Tools → Export to get updated tokens

## 🆓 Backup Option: Manual CSS Reference

If APIs aren't working, you can always reference our built CSS:

```css
/* Import our generated variables */
@import "../design-system/dist/css/variables.css";

/* Use in your designs */
.my-component {
  background: var(--color-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-sm);
}
```

## 🔧 Troubleshooting

### Common Issues

**Authentication Failed:**

- Check your username/password in `.env`
- Make sure you can log in to penpot.app manually

**File ID Not Found:**

- Copy the file ID from your Penpot URL
- Make sure the file exists and you have access

**Token Format Errors:**

- Penpot uses W3C DTCG format
- Our Style Dictionary output should be compatible
- Check the exported JSON structure

### Debug Mode

Add debug logging to your scripts:

```javascript
// Add after login
console.log("🔑 Auth token:", authToken.substring(0, 20) + "...");
console.log("📁 File ID:", process.env.PENPOT_FILE_ID);
```

## 🎉 Next Steps

1. **Set up the scripts** above
2. **Test with a simple token** (like a color)
3. **Integrate into your build process**
4. **Set up CI/CD automation** (optional)

Your design tokens will now stay in perfect sync between your codebase and Penpot! 🚀

## 🚀 Option B: Figma Variables Setup

### Why Use Figma Variables Instead of Plugins?

- ✅ **100% Free** - Built into Figma, will never cost money
- ✅ **No Vendor Lock-in** - Uses Figma's native features
- ✅ **Future-Proof** - Won't disappear or change pricing
- ✅ **Better Performance** - Native integration, no plugin overhead
- ✅ **Team Friendly** - Everyone on your team can use it without plugin installations

### Quick Figma Setup (10 minutes):

#### Method 1: Import from Style Dictionary Output (Recommended)

1. **Generate Figma Variables file**:

   ```bash
   npm run build
   ```

   This creates `src/design-system/dist/figma-variables.json`

2. **Import into Figma**:

   - Open your Figma file
   - Go to the local variables panel (4-square icon in toolbar)
   - Click "Import variables from file"
   - Upload `figma-variables.json`
   - All your design tokens are now Figma Variables!

3. **Start Using Variables**:
   - Apply colors: Use variable picker instead of color picker
   - Spacing: Use variables for padding, gaps, and sizing
   - Typography: Reference font-size and line-height variables
   - Border radius: Use radius variables for consistent rounded corners

#### Method 2: Manual Setup (More Control)

1. **Create Variable Collections**:

   - Open Local Variables panel
   - Create collections: `Colors`, `Spacing`, `Typography`, `Radius`

2. **Add Variables from our tokens**:

   - **Colors**: `brand-primary` (#2563eb), `brand-secondary` (#1f2937), etc.
   - **Spacing**: `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), etc.
   - **Typography**: `font-size-sm` (14px), `font-size-md` (16px), etc.
   - **Radius**: `radius-sm` (4px), `radius-md` (6px), `radius-lg` (8px)

3. **Organize by Collections**:
   - Group related variables together
   - Use consistent naming that matches our token structure

## 📊 Available Tokens

### Colors:

- `color/brand/primary` - #2563eb
- `color/brand/secondary` - #1f2937
- `color/status/success` - #10b981
- `color/status/error` - #ef4444
- `color/neutral/50` → `color/neutral/900` - Complete grayscale
- `color/background/page`, `color/background/card`, etc.
- `color/text/primary`, `color/text/secondary`, `color/text/muted`

### Spacing:

- `spacing/xs` - 4px
- `spacing/sm` - 8px
- `spacing/md` - 12px
- `spacing/lg` - 16px
- `spacing/xl` - 20px
- `spacing/2xl` - 24px

### Typography:

- `font-size/xs` - 12px
- `font-size/sm` - 14px
- `font-size/md` - 16px
- `font-size/lg` - 18px
- `font-size/xl` - 20px

### Border Radius:

- `radius/sm` - 4px
- `radius/md` - 6px
- `radius/lg` - 8px
- `radius/pill` - 16px

## 🔧 Advanced Usage

### Creating Component Variants:

**In Penpot:**

1. **Create base component** using native design tokens
2. **Define variants** that swap token values
3. **Themes work automatically** - components adapt to light/dark modes

**In Figma:**

1. **Base Component**: Use variables for all properties
2. **Create Variants**: Swap variable values for different states
3. **Example Button**:
   - Default: `color/text/secondary` text, `color/background/card` background
   - Primary: `color/text/white` text, `color/brand/primary` background
   - Danger: `color/text/white` text, `color/status/error` background

### Setting Up Themes:

**Penpot**: Built-in theme support with native design tokens
**Figma**: Create modes (Light/Dark) in your variable collections

### Team Collaboration:

1. **Choose one tool** for consistency across team
2. **Share libraries** with token-based components
3. **Document usage** in component descriptions
4. **Train team** on using tokens instead of hard-coded values

## 🚨 Troubleshooting

### Tokens not appearing?

- **Penpot**: Check that tokens are properly defined in collections
- **Figma**: Make sure JSON file is valid and properly imported

### Colors look different?

- Ensure hex values in our `tokens.json` match expectations
- Check if you're in the right theme mode
- Verify no color profile conflicts

### Can't find the token I need?

- Check `src/design-system/tokens.json` to see all available tokens
- Run `npm run build` to regenerate files
- Make sure the token is in the right category

## 📈 Benefits Comparison

### Penpot Benefits:

- ✅ **Completely free forever** - No subscription costs ever
- ✅ **Open source** - Community driven, transparent development
- ✅ **Web standards** - Real SVG, HTML, CSS output
- ✅ **Self-hostable** - Complete control over your data
- ✅ **No file lock-in** - Open formats you can migrate anywhere
- ✅ **Developer friendly** - Built for design-to-code workflows

### Figma Variables Benefits:

- ✅ **Familiar tool** - If team already uses Figma
- ✅ **Mature ecosystem** - Lots of plugins and integrations
- ✅ **Native variables** - No plugin dependencies
- ✅ **Free for core features** - Variables don't cost extra

### For Teams:

- ✅ **No subscription costs** with either approach
- ✅ **Future-proof** - Both use native/open features
- ✅ **Better collaboration** without vendor lock-in
- ✅ **Scalable** without licensing concerns

## 🎯 Next Steps

### To Try Penpot:

1. **Sign up** at [penpot.app](https://penpot.app) (free account)
2. **Import existing designs** using Penpot Exporter
3. **Set up design token collections** using our token values
4. **Create a test component** using only tokens
5. **Share with developers** and see the clean code export

### To Try Figma Variables:

1. **Generate variables**: Run `npm run build` to create `figma-variables.json`
2. **Import into Figma**: Use native Variables panel
3. **Create test components** using only variables
4. **Train team** on variable usage

## 🔗 Resources

### Penpot:

- **[Penpot Website](https://penpot.app/)** - Sign up and get started
- **[Penpot vs Figma Guide](https://penpot.app/penpot-vs-figma)** - Migration help
- **[Penpot Documentation](https://help.penpot.app/)** - Complete user guide

### Figma:

- **[Figma Variables Documentation](https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma)** - Official Figma guide

### General:

- **[Style Dictionary Website](https://amzn.github.io/style-dictionary/)** - Our token transformation tool
- **[Design Tokens W3C Spec](https://design-tokens.github.io/community-group/format/)** - Industry standard format

---

**Recommendation**: Try **Penpot first** - it's built specifically for open, collaborative design-to-code workflows like ours. If your team is deeply invested in Figma, the Variables approach is a solid fallback.

**Need help?** Check the [main README](./README.md) for more details or the [setup guide](./SETUP.md) for technical configuration.
