const fs = require("fs");
const content = fs.readFileSync("src/lib/personas.ts", "utf-8");

// Check lines around 5410-5420
console.log("=== Around line 5416 ===");
const witStart = content.indexOf("PERSONAS['wittgenstein']");
if (witStart >= 0) {
  const witLine = content.slice(0, witStart).split("\n").length;
  console.log("wittgenstein block starts at line:", witLine);
  
  // Find the block end using brace counting
  const braceIdx = content.indexOf("{", witStart);
  let depth = 0, endIdx = -1;
  for (let i = braceIdx; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0) { endIdx = i + 2; break; }
    }
  }
  const endLine = content.slice(0, endIdx).split("\n").length;
  console.log("wittgenstein block ends at line:", endLine);
  console.log("Block length:", endIdx - witStart, "chars");
  console.log("Chars before wittgenstein (at start-200):", JSON.stringify(content.slice(witStart - 200, witStart)));
  console.log("Chars after block end:", JSON.stringify(content.slice(endIdx, endIdx + 80)));
}

// Check what's around line 5579
console.log("\n=== Around line 5579 ===");
const line5579Pos = content.split("\n").slice(0, 5579).join("\n").length + String(5579).length + 1;
console.log("Line 5579 starts at approx:", line5579Pos);
console.log("Content around line 5579:", JSON.stringify(content.slice(line5579Pos - 5, line5579Pos + 50)));

// Find what comes before the archDate
const archIdx = content.indexOf("archDate");
if (archIdx >= 0) {
  const archLine = content.slice(0, archIdx).split("\n").length;
  console.log("\narchDate at line:", archLine);
  // Find the block before archDate
  const prevBlockStart = content.lastIndexOf("PERSONAS[", archIdx);
  if (prevBlockStart >= 0) {
    console.log("Previous block starts at:", prevBlockStart);
    // Get id of that block
    const idStart = prevBlockStart + 9;
    const idEnd = content.indexOf("]", idStart);
    const blockId = content.slice(idStart, idEnd);
    console.log("Previous block id:", blockId);
    
    // Find its actual end
    const braceIdx = content.indexOf("{", idStart);
    let depth = 0, endIdx = -1;
    for (let i = braceIdx; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") { depth--; if (depth === 0) { endIdx = i + 2; break; } }
    }
    const endLine = content.slice(0, endIdx).split("\n").length;
    console.log("Previous block ends at line:", endLine, "expected:", archLine - 1);
    if (endLine !== archLine - 1) {
      console.log("MISMATCH! Block ends at line", endLine, "but archDate is at line", archLine);
      console.log("Around end of previous block:", JSON.stringify(content.slice(endIdx - 20, endIdx + 30)));
    }
  }
}
