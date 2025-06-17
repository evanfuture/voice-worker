import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🎨 Penpot API Setup Helper");
console.log("========================\n");

// Check if .env exists
const envPath = path.join(__dirname, "..", ".env");
const envExamplePath = path.join(__dirname, "env.example");

if (!fs.existsSync(envPath)) {
  console.log("📋 Creating .env file from template...");
  fs.copyFileSync(envExamplePath, envPath);
  console.log("✅ Created .env file");
} else {
  console.log("✅ .env file already exists");
}

console.log("\n🔧 Next Steps:");
console.log("1. Sign up at https://penpot.app (free)");
console.log("2. Create a new project and file");
console.log("3. Copy the file ID from the URL:");
console.log(
  "   https://design.penpot.app/#/workspace/[workspace-id]/[project-id]/[file-id]"
);
console.log("4. Edit .env file with your credentials:");
console.log("   - PENPOT_USERNAME (your email)");
console.log("   - PENPOT_PASSWORD (your password)");
console.log("   - PENPOT_FILE_ID (from step 3)");
console.log("\n🚀 Then run:");
console.log("   npm run tokens:import  # Send tokens to Penpot");
console.log("   npm run tokens:export  # Get tokens from Penpot");
console.log("   npm run tokens:sync    # Build + Import");

console.log(
  "\n💡 Pro tip: Add .env to your .gitignore to keep credentials safe!"
);
