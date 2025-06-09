import {
  calculateTranscriptionCost,
  calculateBatchCost,
  formatCost,
  formatDuration,
  estimateAudioDurationFromSize,
} from "./src/utils/cost-calculator.js";

// Test the cost calculator with some example file sizes
console.log("🧪 Testing Cost Calculator\n");

// Test 1: Small file (5MB MP3 - about 3-4 minutes)
const smallFileSize = 5 * 1024 * 1024; // 5MB
const smallDuration = estimateAudioDurationFromSize(smallFileSize);
console.log(`📁 Small file (5MB):`);
console.log(`   Estimated duration: ${formatDuration(smallDuration)}`);
console.log(`   Estimated cost: ${formatCost(smallDuration * 0.006)}\n`);

// Test 2: Medium file (25MB MP3 - about 15-17 minutes)
const mediumFileSize = 25 * 1024 * 1024; // 25MB
const mediumDuration = estimateAudioDurationFromSize(mediumFileSize);
console.log(`📁 Medium file (25MB):`);
console.log(`   Estimated duration: ${formatDuration(mediumDuration)}`);
console.log(`   Estimated cost: ${formatCost(mediumDuration * 0.006)}\n`);

// Test 3: Large file (100MB MP3 - about 1 hour)
const largeFileSize = 100 * 1024 * 1024; // 100MB
const largeDuration = estimateAudioDurationFromSize(largeFileSize);
console.log(`📁 Large file (100MB):`);
console.log(`   Estimated duration: ${formatDuration(largeDuration)}`);
console.log(`   Estimated cost: ${formatCost(largeDuration * 0.006)}\n`);

// Test 4: Batch calculation
console.log(`📊 Batch calculation example:`);
console.log(`   3 files: 5MB, 25MB, 100MB`);
const totalDuration = smallDuration + mediumDuration + largeDuration;
const totalCost = totalDuration * 0.006;
console.log(`   Total estimated duration: ${formatDuration(totalDuration)}`);
console.log(`   Total estimated cost: ${formatCost(totalCost)}\n`);

// Test 5: Cost formatting
console.log(`💰 Cost formatting examples:`);
console.log(`   $0.0001 → ${formatCost(0.0001)}`);
console.log(`   $0.0056 → ${formatCost(0.0056)}`);
console.log(`   $0.0234 → ${formatCost(0.0234)}`);
console.log(`   $1.2345 → ${formatCost(1.2345)}\n`);

console.log("✅ Cost calculator test complete!");
console.log(
  "\n💡 To test with real files, drop audio files in ./dropbox and run the system."
);
console.log(
  "   The cost estimates will appear in the web interface when the queue is paused."
);
