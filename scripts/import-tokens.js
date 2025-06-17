import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function importTokens() {
  try {
    console.log("🚀 Starting Penpot token import...");

    // 1. Read our generated tokens
    const tokensPath = path.join(
      __dirname,
      "..",
      "src",
      "design-system",
      "dist",
      "figma-tokens.json"
    );
    if (!fs.existsSync(tokensPath)) {
      console.log("⚠️  No tokens file found at:", tokensPath);
      console.log("💡 Run: npm run build");
      return;
    }

    const tokens = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
    console.log("📖 Loaded tokens from Style Dictionary output");

    // 2. Login to Penpot
    console.log("🔑 Authenticating with Penpot...");
    const loginResponse = await axios.post(
      `${process.env.PENPOT_API_URL}/auth/login`,
      {
        email: process.env.PENPOT_USERNAME,
        password: process.env.PENPOT_PASSWORD,
      }
    );

    const authToken = loginResponse.data.token;
    console.log("✅ Authentication successful");

    // 3. Import tokens to Penpot
    console.log("📤 Uploading tokens to Penpot...");
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

    // 4. Show summary of what was imported
    const tokenCount = Object.keys(tokens).reduce((total, setName) => {
      const setTokens = Object.keys(tokens[setName]).length;
      console.log(`   - ${setName}: ${setTokens} tokens`);
      return total + setTokens;
    }, 0);

    console.log(`📊 Total: ${tokenCount} tokens imported`);
    console.log(
      `🌐 View in Penpot: https://design.penpot.app/#/workspace/*/project/*/file/${process.env.PENPOT_FILE_ID}`
    );
  } catch (error) {
    console.error("❌ Import failed:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.error(
        "🔐 Authentication failed. Check your PENPOT_USERNAME and PENPOT_PASSWORD in .env"
      );
    } else if (error.response?.status === 404) {
      console.error("📁 File not found. Check your PENPOT_FILE_ID in .env");
    } else if (error.response?.status === 400) {
      console.error(
        "📋 Invalid token format. Check that your Style Dictionary output is W3C DTCG compatible"
      );
    }

    process.exit(1);
  }
}

importTokens();
