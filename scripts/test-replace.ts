const fs = require('fs');
const content = fs.readFileSync('src/lib/personas.ts', 'utf-8');
const id = 'naval-ravikant';

// Find start via simple indexOf
const startStr = `PERSONAS['${id}'] = {`;
const startIdx = content.indexOf(startStr);
console.log('startIdx:', startIdx);

if (startIdx < 0) { console.log('NOT FOUND'); process.exit(1); }

// Walk from start, find the first \n and check if the NEXT line starts with `};`
const rest = content.slice(startIdx);
let endIdx = -1;
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '\n') {
    // Check if this line (at column 0) is just `};`
    const afterNL = rest.slice(i + 1);
    if (afterNL.startsWith('};')) {
      // This is the closing brace at column 0
      endIdx = startIdx + i + 1 + 2; // position after newline + `};`
      console.log('found }; at:', startIdx + i + 1);
      console.log('context:', JSON.stringify(content.slice(startIdx + i - 5, startIdx + i + 5)));
      break;
    }
  }
}

if (endIdx < 0) { console.log('no closing }; found'); process.exit(1); }

const newBlock = 'PERSONAS[\'naval-ravikant\'] = { id: \'naval-ravikant\', name: \'Naval Ravikant\', nameZh: \'纳瓦尔·拉维坎特\', nameEn: \'Naval Ravikant\', domain: [\'investment\', \'philosophy\'], tagline: \'Seek Wealth\', taglineZh: \'追求财富\', avatar: \'\', accentColor: \'#059669\', gradientFrom: \'#059669\', gradientTo: \'#34d399\', brief: \'test\', briefZh: \'test zh\', mentalModels: [], decisionHeuristics: [], expressionDNA: { sentenceStyle: [], vocabulary: [], forbiddenWords: [], rhythm: \'\', humorStyle: \'\', certaintyLevel: \'medium\', rhetoricalHabit: \'\', quotePatterns: [], chineseAdaptation: \'\', verbalMarkers: [], speakingStyle: \'\' }, values: [], antiPatterns: [], tensions: [], honestBoundaries: [], strengths: [], blindspots: [], sources: [], researchDate: \'2026-04-21\', version: \'v4-test\', researchDimensions: [], systemPromptTemplate: \'test\', identityPrompt: \'test\', };';

const newContent = content.slice(0, startIdx) + newBlock + content.slice(endIdx);
console.log('old len:', content.length, 'new len:', newContent.length);
fs.writeFileSync('src/lib/personas.ts.test2', newContent);
console.log('written to personas.ts.test2');

// Verify: compile check
const { execSync } = require('child_process');
try {
  execSync('cd /Users/john/蒸馏2 && bunx tsc --noEmit src/lib/personas.ts.test2 2>&1 | head -5', { stdio: 'pipe' });
  console.log('COMPILE OK');
} catch (e) {
  console.log('COMPILE ERRORS:', e.stdout?.toString() || e.message);
}
