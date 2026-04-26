const fs = require("fs");
const content = fs.readFileSync("src/lib/personas.ts", "utf-8");

// Approach: match from PERSONAS[...] = { at line-start to \n}; at line-start
const blockRE = /^PERSONAS\[([\'"][^\'"]+[\'"])\]\s*=\s*\{/gm;

let count = 0;
let match;
while ((match = blockRE.exec(content)) !== null) {
  const start = match.index;
  const afterMatch = start + match[0].length;
  
  // Count braces from after the { to find matching }
  let depth = 1;
  let end = -1;
  for (let i = afterMatch; i < content.length; i++) {
    const c = content[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        if (content[i+1] === ";") {
          end = i + 2;
        }
        break;
      }
    }
  }
  
  if (end < 0) {
    console.log("Could not find end for", match[1]);
    continue;
  }
  
  count++;
  if (count <= 3 || count > 60) {
    console.log("Block " + count + ": " + match[1] + " start=" + start + " end=" + end + " len=" + (end-start));
  }
}
console.log("Total blocks:", count);

// Also verify wittgenstein
const witIdx = content.indexOf("PERSONAS['wittgenstein']");
if (witIdx >= 0) {
  console.log("wittgenstein found at", witIdx);
  console.log("Around wittgenstein:", JSON.stringify(content.slice(witIdx, witIdx+80)));
} else {
  console.log("wittgenstein NOT found in original!");
}
