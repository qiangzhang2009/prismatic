import { loadCorpus } from '/Users/john/蒸馏2/src/lib/zero/corpus/loader.ts';
import { analyzeCorpus } from '/Users/john/蒸馏2/src/lib/zero/corpus/analyzer.ts';

const start = Date.now();
const corpusDir = '/Users/john/蒸馏2/corpus/jiqun/texts';

console.log('Step 1: Loading corpus...');
const loadResult = await loadCorpus(corpusDir, {
  maxFiles: 500,
  maxTotalBytes: 500 * 1024 * 1024,
  recursive: true,
});
console.log(`  Load done in ${Date.now() - start}ms, files: ${loadResult.files.length}, size: ${(loadResult.totalSizeBytes / 1024 / 1024).toFixed(1)}MB`);

console.log('Step 2: Fast preprocessing...');
const preprocessed = loadResult.files.map(f => ({
  ...f,
  cleanedText: f.rawText.slice(0, 500000),
  chunks: [{
    id: `${f.id}-c0`,
    text: f.rawText.slice(0, 50000),
    wordCount: Math.round(f.rawText.slice(0, 50000).replace(/\s+/g, '').length * 0.4),
    language: f.language,
    isComplete: false,
  }],
}));
console.log(`  Preprocess done in ${Date.now() - start}ms`);

console.log('Step 3: Analyzing corpus...');
const report = analyzeCorpus(preprocessed, 'jiqun', {
  detectPeriods: false,
  sampleSize: 30000,
});
console.log(`  Analyze done in ${Date.now() - start}ms`);
console.log(`  Quality: ${report.qualityScore}`);
console.log(`  Total words: ${report.totalWordCount}`);
console.log(`  Total chars: ${report.totalCharCount}`);
console.log(`  Unique word ratio: ${(report.uniqueWordRatio * 100).toFixed(1)}%`);
console.log(`  Language: ${JSON.stringify(report.languageDistribution)}`);
console.log(`  Sample length: ${report.sample.length}`);
console.log(`  Done! Total: ${Date.now() - start}ms`);
