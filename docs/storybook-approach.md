# Alternative: Storybook Design System

If you prefer a more component-focused approach with visual documentation, Storybook offers excellent Figma integration.

## Why Storybook?

- **Visual Component Library**: See all your components in one place
- **Design Tokens Add-on**: Automatically document your tokens
- **Figma Plugin**: Direct sync between Storybook stories and Figma
- **Interactive Documentation**: Test component states and props
- **Design Review**: Stakeholders can review components without code

## Setup

### 1. Install Storybook

```bash
cd src/nuxt-web
npx storybook@latest init --yes
```

### 2. Install Design Tokens Add-on

```bash
npm install --save-dev @storybook/addon-design-tokens
```

### 3. Configure Storybook

```javascript
// .storybook/main.js
export default {
  addons: [
    "@storybook/addon-design-tokens",
    "@storybook/addon-docs",
    "@storybook/addon-controls",
  ],
};
```

### 4. Create Token Stories

```javascript
// stories/DesignTokens.stories.js
import tokens from "../src/design-system/dist/tokens.js";

export default {
  title: "Design System/Tokens",
  parameters: {
    docs: {
      description: {
        component: "Design tokens used throughout the Voice Worker application",
      },
    },
  },
};

export const Colors = {
  render: () => ({
    template: `
      <div>
        <div v-for="(color, name) in colors" :key="name" class="color-swatch">
          <div class="swatch" :style="{ backgroundColor: color.value }"></div>
          <div class="info">
            <strong>{{ name }}</strong><br>
            <code>{{ color.value }}</code>
          </div>
        </div>
      </div>
    `,
    data() {
      return {
        colors: tokens.color.brand,
      };
    },
  }),
};

export const Spacing = {
  render: () => ({
    template: `
      <div>
        <div v-for="(space, name) in spacing" :key="name" class="spacing-demo">
          <div class="spacing-box" :style="{ width: space.value, height: space.value }"></div>
          <strong>{{ name }}: {{ space.value }}</strong>
        </div>
      </div>
    `,
    data() {
      return {
        spacing: tokens.size.spacing,
      };
    },
  }),
};
```

### 5. Component Stories

```javascript
// stories/FileMetadataManager.stories.js
import FileMetadataManager from "../components/FileMetadataManager.vue";

export default {
  title: "Components/FileMetadataManager",
  component: FileMetadataManager,
  parameters: {
    design: {
      type: "figma",
      url: "https://www.figma.com/file/YOUR_FILE_ID",
    },
  },
};

export const Default = {
  args: {
    // Mock props
  },
};

export const WithManyFiles = {
  args: {
    // Mock data with many files
  },
};
```

## Figma Integration

### 1. Install Figma Plugin

In Figma: Plugins → Browse → Search "Storybook Connect"

### 2. Link Stories to Designs

Add Figma URLs to your story parameters:

```javascript
parameters: {
  design: {
    type: 'figma',
    url: 'https://www.figma.com/file/...'
  }
}
```

### 3. Sync Workflow

1. Design components in Figma
2. Add Figma URLs to Storybook stories
3. Developers implement components using design tokens
4. Stories automatically show design vs. implementation

## Benefits vs. Style Dictionary Approach

### Style Dictionary (Recommended):

- ✅ Lightweight and focused on tokens
- ✅ Direct Figma Tokens plugin integration
- ✅ Multi-format output (CSS, SCSS, JS)
- ✅ Faster setup and maintenance

### Storybook Approach:

- ✅ Visual component documentation
- ✅ Interactive component testing
- ✅ Better for design reviews
- ✅ More comprehensive design system
- ❌ Heavier setup and maintenance
- ❌ More complex build process

## Recommendation

**Start with Style Dictionary** for quick token sync, then **add Storybook later** if you need visual documentation and component testing.

You can use both approaches together:

1. Style Dictionary for design tokens → Figma sync
2. Storybook for component documentation and design review
