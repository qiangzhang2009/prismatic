#!/usr/bin/env bun
/**
 * Prismatic — Pre-Deploy Data Audit
 *
 * Comprehensive check for data quality issues BEFORE deployment.
 * Catches: namezh placeholders, cross-contamination, missing fields, wrong evidence.
 *
 * Usage:
 *   bun run scripts/audit-personas.ts           # Audit from LOCAL DB
 *   bun run scripts/audit-personas.ts --prod   # Audit from PRODUCTION API
 *   bun run scripts/audit-personas.ts --fix    # Auto-fix fixable issues
 */

import { parseArgs } from 'util';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_ROOT = join(__dirname, '../corpus');
const V5_DIR = join(CORPUS_ROOT, 'distilled', 'v5');

try {
  const { config } = await import('dotenv');
  config({ path: join(process.argv[1] || '.', '../.env') });
} catch {}

// ─── Persona Identity Registry ─────────────────────────────────────────────
// Maps slug → canonical identity info for cross-checking
const IDENTITY_REGISTRY: Record<string, {
  name: string;
  nameZh: string;
  /** Keywords that should appear in briefZh / first MM for THIS persona */
  identityKeywords: string[];
  /** Keywords that should NEVER appear in THIS persona's data (belong to others) */
  forbiddenKeywords: string[];
  /** Patterns that first MM evidence source should match */
  sourcePatterns: RegExp[];
  /** If true, persona has NO valid corpus — skip contamination checks */
  noCorpus?: boolean;
}> = {
  // ── Chinese Classical ──
  'confucius':         { name: 'Confucius', nameZh: '孔子', identityKeywords: ['孔子', '论语', '儒'], forbiddenKeywords: [], sourcePatterns: [/(?:The |《)Analects|Confucius|儒家/i] },
  'lao-zi':            { name: 'Lao Zi', nameZh: '老子', identityKeywords: ['老子', '道德经', '道家'], forbiddenKeywords: [], sourcePatterns: [/道德经|Tao Te Ching|Laozi|老子/i] },
  'mencius':           { name: 'Mencius', nameZh: '孟子', identityKeywords: ['孟子', '性善', '儒'], forbiddenKeywords: [], sourcePatterns: [/Mencius|孟子/i] },
  'zhuang-zi':         { name: 'Zhuang Zi', nameZh: '庄子', identityKeywords: ['庄子', '逍遥', '齐物'], forbiddenKeywords: [], sourcePatterns: [/Zhuangzi|庄子/i] },
  'mo-zi':             { name: 'Mo Zi', nameZh: '墨子', identityKeywords: ['墨子', '兼爱', '非攻'], forbiddenKeywords: [], sourcePatterns: [/Mozi|墨子/i] },
  'han-fei-zi':        { name: 'Han Fei Zi', nameZh: '韩非子', identityKeywords: ['韩非子', '法家', '法治'], forbiddenKeywords: [], sourcePatterns: [/Han Fei Zi|韩非/i] },
  'sima-qian':         { name: 'Sima Qian', nameZh: '司马迁', identityKeywords: ['司马迁', '史记', '史官'], forbiddenKeywords: [], sourcePatterns: [/Sima Qian|史记|司马/i] },
  'sun-tzu':           { name: 'Sun Tzu', nameZh: '孙子', identityKeywords: ['孙子', '孙子兵法', '兵法'], forbiddenKeywords: [], sourcePatterns: [/Sun Tzu|孙子兵法|孙子/i] },

  // ── Three Kingdoms ──
  'cao-cao':           { name: 'Cao Cao', nameZh: '曹操', identityKeywords: ['曹操', '三国', '魏'], forbiddenKeywords: ['刘备', '诸葛亮'], sourcePatterns: [/Cao Cao|曹操/i] },
  'liu-bei':           { name: 'Liu Bei', nameZh: '刘备', identityKeywords: ['刘备', '三国', '蜀'], forbiddenKeywords: ['曹操', '诸葛亮'], sourcePatterns: [/Liu Bei|刘备/i] },
  'zhuge-liang':       { name: 'Zhuge Liang', nameZh: '诸葛亮', identityKeywords: ['诸葛亮', '三国', '隆中'], forbiddenKeywords: ['曹操', '刘备'], sourcePatterns: [/Zhuge Liang|诸葛亮/i] },
  'xiang-yu':          { name: 'Xiang Yu', nameZh: '项羽', identityKeywords: ['项羽', '西楚', '霸王'], forbiddenKeywords: ['刘邦', '韩信'], sourcePatterns: [/Xiang Yu|项羽/i] },

  // ── Buddhist Masters ──
  'hui-neng':          { name: 'Hui Neng', nameZh: '慧能', identityKeywords: ['慧能', '六祖', '坛经', '禅宗'], forbiddenKeywords: ['济群'], sourcePatterns: [/慧能|六祖坛经|Huineng/i] },
  'tripitaka':         { name: 'Tripitaka', nameZh: '大唐西域记', identityKeywords: ['大唐西域记', '玄奘', '取经', '西域'], forbiddenKeywords: ['孙悟空', '猪八戒'], sourcePatterns: [/大唐西域记|Xuanzang|Tripitaka/i] },

  // ── Journey to the West ──
  'sun-wukong':        { name: 'Sun Wukong', nameZh: '孙悟空', identityKeywords: ['孙悟空', '西游记', '大闹天宫', '齐天大圣'], forbiddenKeywords: ['济群', '法师'], sourcePatterns: [/西游记|Sun Wukong|悟空/i] },
  'zhu-bajie':         { name: 'Zhu Bajie', nameZh: '猪八戒', identityKeywords: ['猪八戒', '西游记', '天蓬元帅'], forbiddenKeywords: ['济群', '法师'], sourcePatterns: [/西游记|Zhu Bajie|八戒/i] },

  // ── Modern Chinese ──
  'jiqun':             { name: 'Ji Qun', nameZh: '济群法师', identityKeywords: ['济群', '法师', '佛教', '正念'], forbiddenKeywords: [], sourcePatterns: [/济群|法师|微博/i], noCorpus: true },
  'zhang-xuefeng':     { name: 'Zhang Xuefeng', nameZh: '张雪峰', identityKeywords: ['张雪峰', '教育', '高考', '考研'], forbiddenKeywords: [], sourcePatterns: [/张雪峰|教育|高考/i] },
  'zhang-yiming':      { name: 'Zhang Yiming', nameZh: '张一鸣', identityKeywords: ['张一鸣', '字节跳动', 'TikTok', '算法'], forbiddenKeywords: [], sourcePatterns: [/张一鸣|字节跳动|今日头条/i] },
  'jack-ma':           { name: 'Jack Ma', nameZh: '马云', identityKeywords: ['马云', '阿里巴巴', '电商', '阿里'], forbiddenKeywords: [], sourcePatterns: [/马云|Jack Ma|阿里巴巴/i] },

  // ── Western Thinkers ──
  'wittgenstein':      { name: 'Ludwig Wittgenstein', nameZh: '路德维希·维特根斯坦', identityKeywords: ['维特根斯坦', 'Wittgenstein', 'Tractatus'], forbiddenKeywords: [], sourcePatterns: [/Wittgenstein|维特根斯坦|Tractatus/i] },
  'socrates':          { name: 'Socrates', nameZh: '苏格拉底', identityKeywords: ['苏格拉底', 'Socrates', '美德即知识'], forbiddenKeywords: [], sourcePatterns: [/Socrates|苏格拉底/i] },
  'epictetus':         { name: 'Epictetus', nameZh: '爱比克泰德', identityKeywords: ['爱比克泰德', 'Epictetus', '斯多葛'], forbiddenKeywords: [], sourcePatterns: [/Epictetus|爱比克泰德/i] },
  'seneca':            { name: 'Seneca', nameZh: '塞涅卡', identityKeywords: ['塞涅卡', 'Seneca', '斯多葛'], forbiddenKeywords: [], sourcePatterns: [/Seneca|塞涅卡/i] },
  'marcus-aurelius':   { name: 'Marcus Aurelius', nameZh: '马可·奥勒留', identityKeywords: ['马可·奥勒留', 'Marcus Aurelius', '沉思录'], forbiddenKeywords: [], sourcePatterns: [/Marcus Aurelius|马可/i] },
  'alan-turing':       { name: 'Alan Turing', nameZh: '艾伦·图灵', identityKeywords: ['图灵', 'Turing', 'Enigma'], forbiddenKeywords: [], sourcePatterns: [/Turing|图灵/i] },
  'einstein':          { name: 'Albert Einstein', nameZh: '阿尔伯特·爱因斯坦', identityKeywords: ['爱因斯坦', 'Einstein', '相对论'], forbiddenKeywords: [], sourcePatterns: [/Einstein|爱因斯坦/i] },
  'nikola-tesla':     { name: 'Nikola Tesla', nameZh: '尼古拉·特斯拉', identityKeywords: ['特斯拉', 'Tesla', '交流电'], forbiddenKeywords: [], sourcePatterns: [/Tesla|特斯拉/i] },
  'richard-feynman':   { name: 'Richard Feynman', nameZh: '理查德·费曼', identityKeywords: ['费曼', 'Feynman', '量子'], forbiddenKeywords: [], sourcePatterns: [/Feynman|费曼/i] },
  'nassim-taleb':     { name: 'Nassim Taleb', nameZh: '纳西姆·塔勒布', identityKeywords: ['塔勒布', 'Taleb', '反脆弱', '黑天鹅'], forbiddenKeywords: [], sourcePatterns: [/Taleb|塔勒布|Antifragile/i] },
  'charlie-munger':   { name: 'Charlie Munger', nameZh: '查理·芒格', identityKeywords: ['芒格', 'Munger', '格栅', '伯克希尔'], forbiddenKeywords: [], sourcePatterns: [/Munger|芒格|Berkshire/i] },
  'warren-buffett':    { name: 'Warren Buffett', nameZh: '沃伦·巴菲特', identityKeywords: ['巴菲特', 'Buffett', '伯克希尔', '奥马哈'], forbiddenKeywords: [], sourcePatterns: [/Buffett|巴菲特|Berkshire/i] },
  'jeff-bezos':        { name: 'Jeff Bezos', nameZh: '杰夫·贝索斯', identityKeywords: ['贝索斯', 'Bezos', '亚马逊', 'AWS'], forbiddenKeywords: [], sourcePatterns: [/Bezos|贝索斯|Amazon/i] },
  'elon-musk':         { name: 'Elon Musk', nameZh: '埃隆·马斯克', identityKeywords: ['马斯克', 'Musk', '特斯拉', 'SpaceX'], forbiddenKeywords: [], sourcePatterns: [/Musk|马斯克|Tesla|SpaceX/i] },
  'peter-thiel':       { name: 'Peter Thiel', nameZh: '彼得·蒂尔', identityKeywords: ['蒂尔', 'Thiel', 'PayPal', ' Founders Fund'], forbiddenKeywords: [], sourcePatterns: [/Thiel|蒂尔|PayPal/i] },
  'ray-dalio':         { name: 'Ray Dalio', nameZh: '雷·达里奥', identityKeywords: ['达里奥', 'Dalio', '桥水', '原则'], forbiddenKeywords: [], sourcePatterns: [/Dalio|达里奥|Bridgewater/i] },
  'sam-altman':        { name: 'Sam Altman', nameZh: '萨姆·阿尔特曼', identityKeywords: ['阿尔特曼', 'Altman', 'OpenAI', 'Y Combinator'], forbiddenKeywords: [], sourcePatterns: [/Altman|阿尔特曼|OpenAI/i] },
  'paul-graham':       { name: 'Paul Graham', nameZh: '保罗·格雷厄姆', identityKeywords: ['格雷厄姆', 'Paul Graham', 'YC', 'Y Combinator'], forbiddenKeywords: [], sourcePatterns: [/Paul Graham|格雷厄姆|Y Combinator/i] },
  'andrej-karpathy':   { name: 'Andrej Karpathy', nameZh: '安德烈·卡帕西', identityKeywords: ['卡帕西', 'Karpathy', '深度学习', 'CS231n'], forbiddenKeywords: [], sourcePatterns: [/Karpathy|卡帕西|CS231n/i] },
  'ilya-sutskever':    { name: 'Ilya Sutskever', nameZh: '伊尔亚·苏茨克维', identityKeywords: ['苏茨克维', 'Sutskever', 'OpenAI', '神经网络'], forbiddenKeywords: [], sourcePatterns: [/Ilya|Sutskever|苏茨/i] },
  'jensen-huang':      { name: 'Jensen Huang', nameZh: '黄仁勋', identityKeywords: ['黄仁勋', 'Nvidia', 'GPU', 'CUDA'], forbiddenKeywords: [], sourcePatterns: [/Jensen|Nvidia|黄仁勋/i] },
  'steve-jobs':        { name: 'Steve Jobs', nameZh: '史蒂夫·乔布斯', identityKeywords: ['乔布斯', 'Jobs', '苹果', 'iPhone'], forbiddenKeywords: [], sourcePatterns: [/Jobs|乔布斯|Apple/i] },
  'carl-jung':         { name: 'Carl Jung', nameZh: '卡尔·荣格', identityKeywords: ['荣格', 'Jung', '集体无意识', '原型'], forbiddenKeywords: [], sourcePatterns: [/Jung|荣格|unconscious/i] },
  'aleister-crowley': { name: 'Aleister Crowley', nameZh: '阿莱斯特·克劳利', identityKeywords: ['克劳利', 'Crowley', '泰勒玛', 'Thelema'], forbiddenKeywords: [], sourcePatterns: [/Crowley|克劳利|Thelema/i] },
  'john-maynard-keynes': { name: 'John Maynard Keynes', nameZh: '约翰·梅纳德·凯恩斯', identityKeywords: ['凯恩斯', 'Keynes', '宏观经济学'], forbiddenKeywords: [], sourcePatterns: [/Keynes|凯恩斯/i] },
  'naval-ravikant':   { name: 'Naval Ravikant', nameZh: '纳瓦尔·拉维坎特', identityKeywords: ['纳瓦尔', 'Naval', '风投', 'AngelList'], forbiddenKeywords: [], sourcePatterns: [/Naval|纳瓦尔|AngelList/i] },
  'qian-xuesen':       { name: 'Qian Xuesen', nameZh: '钱学森', identityKeywords: ['钱学森', '航天', '两弹一星'], forbiddenKeywords: [], sourcePatterns: [/钱学森|Qian Xuesen/i] },

  // ── Literary ──
  'qu-yuan':           { name: 'Qu Yuan', nameZh: '屈原', identityKeywords: ['屈原', '离骚', '楚辞'], forbiddenKeywords: [], sourcePatterns: [/Qu Yuan|屈原|离骚/i] },
  'shao-yong':         { name: 'Shao Yong', nameZh: '邵雍', identityKeywords: ['邵雍', '易经', '象数'], forbiddenKeywords: [], sourcePatterns: [/邵雍|Shao Yong/i] },

  // ── Classical Texts ──
  'huangdi-neijing':   { name: 'Huang Di Nei Jing', nameZh: '黄帝内经', identityKeywords: ['黄帝内经', '阴阳', '五行'], forbiddenKeywords: [], sourcePatterns: [/黄帝内经|Huangdi/i] },
  'records-grand-historian': { name: 'Records of the Grand Historian', nameZh: '史记', identityKeywords: ['史记', '司马迁', '本纪'], forbiddenKeywords: [], sourcePatterns: [/史记|Records.*Grand Historian|司马/i] },
  'three-kingdoms':    { name: 'Romance of Three Kingdoms', nameZh: '三国演义', identityKeywords: ['三国演义', '魏', '蜀', '吴'], forbiddenKeywords: ['济群'], sourcePatterns: [/三国演义|Three Kingdoms/i] },
  'journey-west':      { name: 'Journey to the West', nameZh: '西游记', identityKeywords: ['西游记', '取经', '唐僧'], forbiddenKeywords: ['济群'], sourcePatterns: [/西游记|Journey.*West/i] },
  'li-chunfeng':       { name: 'Li Chunfeng', nameZh: '李淳风', identityKeywords: ['李淳风', '天文', '易经'], forbiddenKeywords: [], sourcePatterns: [/李淳风|Li Chunfeng/i] },
};

// ─── Audit Functions ──────────────────────────────────────────────────────────

interface AuditIssue {
  severity: 'error' | 'warning' | 'info';
  slug: string;
  field?: string;
  message: string;
  detail?: string;
  fixable?: boolean;
}

function checkNameZh(persona: any, issues: AuditIssue[]): void {
  const { slug, namezh, name } = persona;
  if (!namezh || namezh === '' || namezh === slug) {
    issues.push({
      severity: 'error',
      slug,
      field: 'namezh',
      message: `namezh is empty or placeholder ("${namezh || ''}")`,
      fixable: true,
    });
  }
}

function checkBriefZh(persona: any, identity: any, issues: AuditIssue[]): void {
  const { slug, briefZh } = persona;
  const brief = briefZh || '';

  if (!brief || brief.length < 50) {
    issues.push({
      severity: 'warning',
      slug,
      field: 'briefZh',
      message: `briefZh is empty or too short (${brief.length} chars)`,
      fixable: true,
    });
    return;
  }

  // Check for forbidden keyword contamination
  if (identity?.forbiddenKeywords) {
    for (const kw of identity.forbiddenKeywords) {
      if (brief.includes(kw)) {
        issues.push({
          severity: 'error',
          slug,
          field: 'briefZh',
          message: `briefZh contains "${kw}" — belongs to a different persona`,
          detail: `Content preview: ${brief.slice(0, 150)}...`,
          fixable: false,
        });
      }
    }
  }

  // Check for known wrong-identity patterns
  if (slug === 'jiqun' && brief.includes('济群') && brief.includes('法师')) {
    // This is expected — jiqun IS 济群法师
  }
}

function checkMentalModels(persona: any, identity: any, issues: AuditIssue[]): void {
  const { slug, mentalModels } = persona;
  const mms = mentalModels || [];

  if (!mms || mms.length === 0) {
    issues.push({
      severity: 'error',
      slug,
      field: 'mentalModels',
      message: `mentalModels is empty`,
      fixable: false,
    });
    return;
  }

  // Check first MM's nameZh presence
  const firstMM = mms[0];
  if (firstMM && !firstMM.nameZh) {
    issues.push({
      severity: 'warning',
      slug,
      field: 'mentalModels[0].nameZh',
      message: `first mental model has no nameZh: "${firstMM.name}"`,
      fixable: true,
    });
  }

  // Check first MM's oneLinerZh
  if (firstMM && !firstMM.oneLinerZh && !firstMM.applicationZh) {
    issues.push({
      severity: 'warning',
      slug,
      field: 'mentalModels[0].oneLinerZh',
      message: `first mental model has no oneLinerZh or applicationZh`,
      fixable: true,
    });
  }

  // Check evidence source references
  if (identity && identity.sourcePatterns && !identity.noCorpus) {
    const firstEvidence = ((firstMM || {}).evidence || [])[0] || {};
    const source = firstEvidence.source || '';
    const matched = identity.sourcePatterns.some((p: RegExp) => p.test(source));

    if (!matched && source) {
      issues.push({
        severity: 'warning',
        slug,
        field: 'mentalModels[0].evidence[0].source',
        message: `first evidence source doesn't match expected identity`,
        detail: `Source: "${source.slice(0, 80)}" | Expected pattern: ${identity.sourcePatterns.map((p: RegExp) => p.source).join(' or ')}`,
        fixable: false,
      });
    }
  }

  // Check for contamination in first MM name
  if (identity?.forbiddenKeywords) {
    const firstName = (firstMM?.nameZh || '') + (firstMM?.name || '');
    for (const kw of identity.forbiddenKeywords) {
      if (firstName.includes(kw)) {
        issues.push({
          severity: 'error',
          slug,
          field: 'mentalModels[0].nameZh',
          message: `first MM name contains "${kw}" — belongs to different persona`,
          detail: `MM name: "${firstName}"`,
          fixable: false,
        });
      }
    }
  }
}

function checkCorpusConsistency(slug: string, identity: any): AuditIssue | null {
  // Check if corpus directory exists and contains relevant files
  const corpusDir = join(CORPUS_ROOT, slug, 'texts');
  if (!existsSync(corpusDir)) {
    return {
      severity: 'info',
      slug,
      field: 'corpus',
      message: `No corpus directory found at ${corpusDir}`,
      fixable: false,
    };
  }

  const files = readdirSync(corpusDir).filter(f => !f.startsWith('.'));

  if (files.length === 0) {
    return {
      severity: 'warning',
      slug,
      field: 'corpus',
      message: `Corpus directory exists but is empty`,
      fixable: false,
    };
  }

  // Check if corpus file names mention the correct persona
  if (identity?.identityKeywords && files.length > 0) {
    const firstFile = files[0];
    const matched = identity.identityKeywords.some((kw: string) => firstFile.includes(kw));
    if (!matched) {
      return {
        severity: 'error',
        slug,
        field: 'corpus',
        message: `Corpus file name doesn't match persona identity`,
        detail: `File: "${firstFile}" | Expected keywords: ${identity.identityKeywords.join(', ')}`,
        fixable: false,
      };
    }
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({
    options: {
      prod: { type: 'boolean' },
      fix: { type: 'boolean' },
      json: { type: 'boolean' },
    },
    allowPositionals: false,
  });

  console.log('\n=== Prismatic Pre-Deploy Data Audit ===\n');

  let personas: any[];

  if (values.prod) {
    // Fetch from production API
    console.log('Fetching from production API...\n');
    const https = await import('https');
    const data = await new Promise<any>((resolve, reject) => {
      const req = https.request({
        hostname: 'prismatic.zxqconsulting.com',
        path: '/api/persona-library?limit=100',
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject); req.end();
    });
    personas = data.items || [];
  } else {
    // Load from local V5 JSON files
    console.log(`Loading from local V5 files: ${V5_DIR}\n`);
    const files = readdirSync(V5_DIR).filter(f => f.endsWith('-v5.json'));
    personas = files.map(f => {
      const slug = f.replace('-v5.json', '');
      try {
        const raw = readFileSync(join(V5_DIR, f), 'utf-8');
        const d = JSON.parse(raw);
        return {
          slug,
          name: d.persona?.name || '',
          namezh: d.persona?.nameZh || '',
          briefZh: d.persona?.briefZh || '',
          mentalModels: d.persona?.mentalModels || [],
          decisionHeuristics: d.persona?.decisionHeuristics || [],
        };
      } catch (e) {
        return { slug, name: '', namezh: '', briefZh: '', mentalModels: [], error: e };
      }
    });
  }

  const allIssues: AuditIssue[] = [];

  for (const p of personas) {
    if (p.error) {
      allIssues.push({ severity: 'error', slug: p.slug, message: `Failed to load: ${p.error}` });
      continue;
    }

    const identity = IDENTITY_REGISTRY[p.slug];

    checkNameZh(p, allIssues);
    checkBriefZh(p, identity, allIssues);
    checkMentalModels(p, identity, allIssues);

    if (!values.prod) {
      const corpusIssue = checkCorpusConsistency(p.slug, identity);
      if (corpusIssue) allIssues.push(corpusIssue);
    }
  }

  // Group by severity
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');

  if (values.json) {
    console.log(JSON.stringify({ errors, warnings, infos, total: personas.length }, null, 2));
    return;
  }

  console.log(`Audited ${personas.length} personas\n`);

  if (errors.length > 0) {
    console.log(`\n${'\x1b[31m'}✗ ERRORS (${errors.length}):${'\x1b[0m'} These block deployment.\n`);
    for (const issue of errors) {
      console.log(`  ${'\x1b[31m'}✗${'\x1b[0m'} [${issue.slug}] ${issue.message}`);
      if (issue.field) console.log(`      Field: ${issue.field}`);
      if (issue.detail) console.log(`      ${issue.detail}`);
      if (issue.fixable) console.log(`      ${'\x1b[32m'}[FIXABLE]${'\x1b[0m'}`);
      else console.log(`      ${'\x1b[33m'}[NOT FIXABLE — requires re-distillation]${'\x1b[0m'}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\n${'\x1b[33m'}⚠ WARNINGS (${warnings.length}):${'\x1b[0m'} Review before deploying.\n`);
    for (const issue of warnings) {
      console.log(`  ⚠ [${issue.slug}] ${issue.message}`);
      if (issue.detail) console.log(`      ${issue.detail}`);
    }
  }

  if (infos.length > 0) {
    console.log(`\n${'\x1b[[2m'}ℹ INFO (${infos.length}):${'\x1b[0m'}`);
    for (const issue of infos) {
      console.log(`  ℹ [${issue.slug}] ${issue.message}`);
    }
  }

  console.log('\n' + '─'.repeat(60));
  if (errors.length === 0) {
    console.log(`\n${'\x1b[32m'}✓ PASS — ${warnings.length} warnings, ${infos.length} info${'\x1b[0m'}`);
    console.log('\nDeployment: ALLOWED');
    process.exit(warnings.length > 0 ? 1 : 0);
  } else {
    console.log(`\n${'\x1b[31m'}✗ FAIL — ${errors.length} errors, ${warnings.length} warnings${'\x1b[0m'}`);
    console.log('\nDeployment: BLOCKED');
    console.log('\nTo audit production API: bun run scripts/audit-personas.ts --prod');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
