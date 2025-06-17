import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function exportTokens() {
  try {
    console.log("🚀 Starting Penpot token export...");

    // 1. Login to get auth token
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

    // 2. Export tokens from Penpot file
    console.log("📥 Fetching tokens from Penpot file...");
    const tokensResponse = await axios.get(
      `${process.env.PENPOT_API_URL}/files/${process.env.PENPOT_FILE_ID}/tokens`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );

    // 3. Ensure output directory exists
    const outputDir = path.join(
      __dirname,
      "..",
      "src",
      "design-system",
      "dist"
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 4. Save to our design system
    const tokens = tokensResponse.data;
    const outputPath = path.join(outputDir, "penpot-tokens.json");
    fs.writeFileSync(outputPath, JSON.stringify(tokens, null, 2));

    console.log("✅ Tokens exported successfully!");
    console.log(`📁 Saved to: ${outputPath}`);
    console.log(`🎨 Found ${Object.keys(tokens).length} token sets`);

    // 5. Show summary of what was exported
    Object.keys(tokens).forEach((setName) => {
      const tokenCount = Object.keys(tokens[setName]).length;
      console.log(`   - ${setName}: ${tokenCount} tokens`);
    });
  } catch (error) {
    console.error("❌ Export failed:", error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.error(
        "🔐 Authentication failed. Check your PENPOT_USERNAME and PENPOT_PASSWORD in .env"
      );
    } else if (error.response?.status === 404) {
      console.error("📁 File not found. Check your PENPOT_FILE_ID in .env");
    }

    process.exit(1);
  }
}

exportTokens();
