const fs = require("fs");
const content = fs.readFileSync("src/lib/personas.ts", "utf-8");

// Find confucius in new file
const confPos = content.indexOf("PERSONAS['confucius']");
console.log("confucius at char:", confPos);
if (confPos >= 0) {
  const confLine = content.slice(0, confPos).split("\n").length;
  console.log("confucius starts at line:", confLine);
  const brace = content.indexOf("{", confPos);
  let depth = 0, endIdx = -1;
  for (let i = brace; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0 && content[i+1] === ";") { endIdx = i + 2; break; }
    }
  }
  const endLine = content.slice(0, endIdx).split("\n").length;
  console.log("confucius block ends at line:", endLine);
  console.log("Block length:", endIdx - confPos, "chars");
  console.log("Last 3 lines of confucius:", JSON.stringify(content.slice(endIdx - 200, endIdx + 50)));
  
  // Show all lines from confucius start to end
  const lines = content.split("\n");
  console.log("\n=== Lines " + confLine + "-" + (endLine) + " ===");
  for (let i = confLine - 1; i < Math.min(confLine + 5, endLine); i++) {
    console.log((i+1) + ": " + lines[i].slice(0, 150));
  }
  console.log("...");
  for (let i = Math.max(confLine + 5, endLine - 3); i < endLine; i++) {
    console.log((i+1) + ": " + lines[i].slice(0, 150));
  }
}

// Find what's after confucius
if (confPos >= 0) {
  const brace = content.indexOf("{", confPos);
  let depth = 0, endIdx = -1;
  for (let i = brace; i < content.length; i++) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") {
      depth--;
      if (depth === 0 && content[i+1] === ";") { endIdx = i + 2; break; }
    }
  }
  
  // Show content after confucius block
  console.log("\n=== Content after confucius block ===");
  console.log(JSON.stringify(content.slice(endIdx, endIdx + 500)));
}

// Also check: what persona was supposed to be between confucius and wittgenstein in original?
const orig = fs.readFileSync("src/lib/backup/personas-pre-v4-1776775710374.ts", "utf-8");
const origConf = orig.indexOf('PERSONAS["confucius"]');
if (origConf >= 0) {
  // Find next block after confucius
  const nextBlockMatch = orig.slice(origConf).match(/PERSONAS\[/);
  if (nextBlockMatch) {
    const nextPos = origConf + nextBlockMatch.index;
    const nextIdMatch = orig.slice(nextPos).match(/PERSONAS\[([^\]]+)\]/);
    console.log("\nNext block after confucius in original:", nextIdMatch ? nextIdMatch[1] : "unknown", "at", nextPos);
  }
}
