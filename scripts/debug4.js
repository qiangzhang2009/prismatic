const fs = require("fs");
const orig = fs.readFileSync("src/lib/backup/personas-pre-v4-1776775710374.ts", "utf-8");
const content = fs.readFileSync("src/lib/personas.ts", "utf-8");

// Find all PERSONAS[ occurrences in the new file
// and categorize them
const blockRE = /^PERSONAS\[([^\]]+)\]/gm;
const newBlocks = [];
let match;
while ((match = blockRE.exec(content)) !== null) {
  const id = match[1];
  newBlocks.push({ id, pos: match.index });
}
console.log("Total PERSONAS[ occurrences in new file:", newBlocks.length);

// Check how many are block starts (have = { after)
let blockStarts = 0;
let i = 0;
while (i < content.length) {
  const pos = content.indexOf("PERSONAS[", i);
  if (pos < 0) break;
  const after = content.slice(pos, pos + 30);
  if (/=\s*\{/.test(after)) blockStarts++;
  i = pos + 1;
}
console.log("Block starts in new file:", blockStarts);

// Now compare with original
const origBlocks = [];
match = blockRE.exec(orig);
while ((match = blockRE.exec(orig)) !== null) {
  const id = match[1];
  origBlocks.push({ id, pos: match.index });
}
console.log("\nTotal PERSONAS[ in original:", origBlocks.length);

// Check if there are duplicate ids
const idCounts = {};
for (const b of newBlocks) {
  idCounts[b.id] = (idCounts[b.id] || 0) + 1;
}
const duplicates = Object.entries(idCounts).filter(e => e[1] > 1);
console.log("Duplicate ids in new file:", duplicates.slice(0, 10));

// Find confucius position in original
const origConf = origBlocks.find(b => b.id === '"confucius"');
console.log("\nOriginal confucius:", origConf);
if (origConf) {
  const after = orig.slice(origConf.pos, origConf.pos + 30);
  console.log("After confucius:", JSON.stringify(after));
}

// Now check: what blocks are between char 180000 and 400000 in new file?
console.log("\n=== All blocks in new file ===");
for (const b of newBlocks) {
  if (b.pos > 180000 && b.pos < 420000) {
    console.log(b.id + " at " + b.pos);
  }
}
