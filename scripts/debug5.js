const fs = require("fs");

// Simulate the exact merge step by step
const original = fs.readFileSync("src/lib/backup/personas-pre-v4-1776775710374.ts", "utf-8");

// Scanner: regex approach
const blockRE = /^PERSONAS\[([\'"][^\'"]+[\'"])\]\s*=\s*\{/gm;
const blocks = [];
let match;
while ((match = blockRE.exec(original)) !== null) {
  let id = match[1];
  if ((id.startsWith("'") && id.endsWith("'")) || (id.startsWith('"') && id.endsWith('"'))) {
    id = id.slice(1, -1);
  }
  const start = match.index;
  const afterMatch = start + match[0].length;

  // Count braces
  let depth = 1, endIdx = -1;
  for (let i = afterMatch; i < original.length; i++) {
    if (original[i] === "{") depth++;
    else if (original[i] === "}") {
      depth--;
      if (depth === 0 && original[i+1] === ";") { endIdx = i + 2; break; }
    }
  }
  if (endIdx >= 0) blocks.push({ id, start, end: endIdx });
}
console.log("Scanner found", blocks.length, "blocks");

// Load v4 data info (just the ids)
const v4Files = fs.readdirSync("corpus/distilled/v4")
  .filter(f => f.endsWith("-v4.json"))
  .map(f => f.replace("-v4.json",""));

const blockIds = new Set(blocks.map(b => b.id));
const toReplace = v4Files.filter(id => blockIds.has(id));
const toAppend = v4Files.filter(id => !blockIds.has(id));
console.log("v4 files:", v4Files.length);
console.log("Replace:", toReplace.length, toReplace.slice(0,5));
console.log("Append:", toAppend);

// Check if confucius is in replace
console.log("\nconfucius in toReplace?", toReplace.includes("confucius"));
console.log("confucius in toAppend?", toAppend.includes("confucius"));

// Check what blocks exist in original
const confBlock = blocks.find(b => b.id === "confucius");
console.log("\nOriginal confucius block:", confBlock);

// Find steve-jobs block
const steveBlock = blocks.find(b => b.id === "steve-jobs");
console.log("steve-jobs block:", steveBlock);

// Check the original file for PERSONAS["confucius"] vs PERSONAS['confucius']
const dc = original.indexOf('PERSONAS["confucius"]');
const sc = original.indexOf("PERSONAS['confucius']");
console.log("\nOriginal has PERSONAS[\"confucius\"]:", dc >= 0, "at", dc);
console.log("Original has PERSONAS['confucius']:", sc >= 0, "at", sc);

// Verify the scanner found confucius
const confInScanner = blocks.find(b => b.id === "confucius");
if (confInScanner) {
  console.log("Scanner found confucius at", confInScanner.start, "-", confInScanner.end);
} else {
  console.log("Scanner did NOT find confucius!");
  // Why? Check what quotes are used
  console.log("All block ids that contain 'confu':", blocks.filter(b => b.id.includes("confu")).map(b => b.id));
}

// Check if alan-turing is in original (should be since it was replaced earlier)
// Actually check: what blocks does scanner find?
console.log("\nAll block ids:", blocks.map(b => b.id).sort().join(", "));
