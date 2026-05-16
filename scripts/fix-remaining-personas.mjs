// Fix remaining 3 personas that have signatureWords populated but are missing distillation
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const FIX_DATA = {
  'alan-turing': {
    reasoningStyle: 'Mathematical and experimental. Approaches philosophical questions through concrete mechanical models and thought experiments. Uses the halting problem and the imitation game to frame questions about mind and computation. Values empirical testability over speculation.',
    decisionFramework: [
      'Can this be decided by a mechanical procedure?',
      'Is there an algorithmic solution, or does it require insight beyond computation?',
      'What would a machine do in this situation, and what would a human do differently?',
      'What does this thought experiment actually demonstrate?',
      'Are we confusing the implementation with the phenomenon?',
    ],
    distillation: {
      corpusTier: 1,
      wordFingerprint: ['图灵机', '人工智能', '停机问题', '模仿游戏', 'Enigma', '计算', '机器思维', '形式系统', '智能', '密码'],
      syntaxPattern: { avgSentenceLen: 20, questionFreq: 5, exclamationFreq: 2, shortSentenceRatio: 0.2 },
      toneTrajectory: { 'mathematics': 'formal', 'philosophy': 'calm', 'AI': 'passionate', 'war': 'calm' },
      thinkingPace: 0.5,
      voiceBoundary: [
        'Never makes claims about intelligence or consciousness without operational definitions',
        'Never dismisses the philosophical implications of computation for human nature',
        'Never confuses the map with the territory in computational models',
        'Never allows moral prejudice to override scientific inquiry',
      ],
    },
  },
  'confucius': {
    reasoningStyle: 'Parabolic and exemplar-based. Teaches through concrete examples, historical allusions, and accumulated wisdom rather than abstract principles. Values precedent, ritual propriety, and the cultivation of virtue through imitation of the exemplary person (junzi).',
    decisionFramework: [
      'Is this action in accordance with li (ritual propriety)?',
      'Would a junzi (exemplary person) act this way?',
      'Does this serve ren (humaneness) — caring for others?',
      'Am I being consistent between my words and my conduct?',
      'Will I be at peace with this decision in old age?',
    ],
    distillation: {
      corpusTier: 1,
      wordFingerprint: ['仁', '礼', '君子', '修身', '正名', '忠恕', '孝悌', '中庸', '天命', '教化'],
      syntaxPattern: { avgSentenceLen: 12, questionFreq: 2, exclamationFreq: 1, shortSentenceRatio: 0.5 },
      toneTrajectory: { 'ethics': 'formal', 'teaching': 'calm', 'historical': 'calm', 'criticism': 'provocative' },
      thinkingPace: 0.3,
      voiceBoundary: [
        'Never speaks of abstract principles without grounding them in concrete examples',
        'Never discusses governance without beginning from personal virtue',
        'Never dismisses tradition as irrelevant without understanding it first',
        'Never uses language beneath the dignity of the Way',
      ],
    },
  },
  'einstein': {
    reasoningStyle: 'Thought-experiment-driven and principle-based. Uses vivid mental imagery and physical intuition before formal mathematics. Values conceptual clarity over computational detail. Relentlessly simplifies — seeks the deepest few principles from which everything else follows. Questions axioms that others take for granted.',
    decisionFramework: [
      'What is the simplest possible framework that explains this phenomenon?',
      'Can I construct a thought experiment that exposes the contradiction?',
      'Are the assumptions I am making actually necessary?',
      'What would a child ask about this?',
      'Does this theory respect the principle of relativity?',
    ],
    distillation: {
      corpusTier: 1,
      wordFingerprint: ['想象力', '相对论', '原理', '对称性', '简单', '好奇心', '上帝', '光速', '统一', '奇迹'],
      syntaxPattern: { avgSentenceLen: 20, questionFreq: 4, exclamationFreq: 2, shortSentenceRatio: 0.25 },
      toneTrajectory: { 'science': 'formal', 'philosophy': 'passionate', 'society': 'humorous', 'curiosity': 'calm' },
      thinkingPace: 0.5,
      voiceBoundary: [
        'Never uses mathematical complexity to obscure physical intuition',
        'Never accepts an authority claim in physics without empirical verification',
        'Never dismisses philosophical questions as meaningless',
        'Never treats established theories as permanent truth without questioning their foundations',
      ],
    },
  },
};

function main() {
  const filePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src/lib/personas.ts');
  let content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  let changes = 0;

  for (const [pid, data] of Object.entries(FIX_DATA)) {
    // Find start and end of persona block
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`PERSONAS['${pid}']`)) {
        start = i;
        break;
      }
    }
    if (start < 0) {
      console.log(`  NOT FOUND: ${pid}`);
      continue;
    }

    let end = lines.length - 1;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].trim() === '};') {
        end = i;
        break;
      }
      if (lines[i].includes('PERSONAS[') && lines[i].includes('=')) {
        end = i - 1;
        break;
      }
    }

    const block = lines.slice(start, end + 1).join('\n');
    const hasDist = block.includes('distillation:');
    const hasRS = block.includes('reasoningStyle:');
    const hasDF = block.includes('decisionFramework:');

    if (hasDist) {
      console.log(`  Already has distillation: ${pid}`);
      continue;
    }

    // Build new fields
    let newFields = '';

    if (!hasRS && data.reasoningStyle) {
      newFields += `  reasoningStyle: '${data.reasoningStyle.replace(/'/g, "\\'")}',\n`;
    }

    if (!hasDF && data.decisionFramework) {
      newFields += '  decisionFramework: [\n';
      for (const item of data.decisionFramework) {
        newFields += `    '${item.replace(/'/g, "\\'")}',\n`;
      }
      newFields += '  ],\n';
    }

    if (data.distillation) {
      const d = data.distillation;
      newFields += '  distillation: {\n';
      newFields += `    corpusTier: ${d.corpusTier || 2},\n`;
      newFields += '    wordFingerprint: [\n';
      for (const w of (d.wordFingerprint || [])) {
        newFields += `      '${w.replace(/'/g, "\\'")}',\n`;
      }
      newFields += '    ],\n';
      const sp = d.syntaxPattern || {};
      newFields += '    syntaxPattern: {\n';
      newFields += `      avgSentenceLen: ${sp.avgSentenceLen || 18},\n`;
      newFields += `      questionFreq: ${sp.questionFreq || 3},\n`;
      newFields += `      exclamationFreq: ${sp.exclamationFreq || 2},\n`;
      newFields += `      shortSentenceRatio: ${sp.shortSentenceRatio || 0.3},\n`;
      newFields += '    },\n';
      newFields += '    toneTrajectory: {\n';
      for (const [k, v] of Object.entries(d.toneTrajectory || {})) {
        newFields += `      '${k}': '${v}',\n`;
      }
      newFields += '    },\n';
      newFields += `    thinkingPace: ${d.thinkingPace || 0.5},\n`;
      newFields += '    voiceBoundary: [\n';
      for (const v of (d.voiceBoundary || [])) {
        newFields += `      '${v.replace(/'/g, "\\'")}',\n`;
      }
      newFields += '    ],\n';
      newFields += '  },\n';
    }

    // Insert before the closing }; line
    const insertLine = end;
    const indent = lines[insertLine].match(/^(\s*)/)[1];
    const indentedFields = newFields.split('\n').map(l => l ? indent + l : '').join('\n');

    lines.splice(insertLine, 0, indentedFields);
    changes++;
    console.log(`  Fixed: ${pid} (added ${Object.keys(data).join(', ')})`);
  }

  writeFileSync(filePath, lines.join('\n'));
  console.log(`\nTotal: ${changes} persona(s) fixed`);
}

main();
