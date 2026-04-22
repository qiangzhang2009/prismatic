// Debug: test block detection on the actual file
const fs = require('fs');
const content = fs.readFileSync('src/lib/personas.ts', 'utf-8');

const exportMarker = '// ─── Legacy Exports';
const exportIdx = content.indexOf(exportMarker);
const searchContent = exportIdx >= 0 ? content.slice(0, exportIdx) : content;

let searchFrom = 0;
let count = 0;
while (true) {
  const m = searchContent.slice(searchFrom).match(/^PERSONAS\['([^']+)'\]\s*=\s*\{/m);
  if (!m) break;
  const id = m[1];
  const blockStart = searchFrom + m.index!;
  const rest = searchContent.slice(blockStart);

  // Find the first \n followed by }
  let endIdx = -1;
  let pos = 0;
  while (pos < rest.length) {
    if (rest[pos] === '\n' && rest[pos + 1] === '}') {
      if (pos === 0 || rest[pos - 1] === '\n') {
        endIdx = blockStart + pos + 2;
        break;
      }
    }
    pos++;
  }

  if (endIdx < 0) {
    console.log(`ERROR: no end for ${id} at ${blockStart}`);
    break;
  }

  const blockText = content.slice(blockStart, endIdx);
  const endsWith = JSON.stringify(blockText.slice(-10));
  console.log(`${count++}. ${id}: start=${blockStart} end=${endIdx} len=${endIdx-blockStart} ends=${endsWith}`);

  searchFrom = endIdx;
}

console.log(`\nTotal: ${count} blocks`);
console.log(`File length: ${content.length}`);
console.log(`Export at: ${exportIdx}`);

// Verify: try to rebuild the file
const blocks = [];
searchFrom = 0;
while (true) {
  const m = searchContent.slice(searchFrom).match(/^PERSONAS\['([^']+)'\]\s*=\s*\{/m);
  if (!m) break;
  const id = m[1];
  const blockStart = searchFrom + m.index!;
  const rest = searchContent.slice(blockStart);
  let endIdx = -1;
  let pos = 0;
  while (pos < rest.length) {
    if (rest[pos] === '\n' && rest[pos + 1] === '}') {
      if (pos === 0 || rest[pos - 1] === '\n') {
        endIdx = blockStart + pos + 2;
        break;
      }
    }
    pos++;
  }
  if (endIdx < 0) break;
  blocks.push({ id, text: content.slice(blockStart, endIdx) });
  searchFrom = endIdx;
}

let rebuilt = '';
let prevEnd = 0;
for (const { text } of blocks) {
  rebuilt += content.slice(prevEnd, content.indexOf(text)) + text;
  prevEnd = content.indexOf(text) + text.length;
}
rebuilt += content.slice(prevEnd);

console.log(`\nRebuilt length: ${rebuilt.length}`);
console.log(`Content length: ${content.length}`);
console.log(`Match: ${rebuilt === content}`);
