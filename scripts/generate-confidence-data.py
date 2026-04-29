#!/usr/bin/env python3
"""
Prismatic — Confidence Data Generator v2
Reads all corpus/distilled/zero/*.json files + corpus/ manifests,
computes proper confidence scores, finds real data sources,
and generates TypeScript entries for src/lib/confidence.ts

Run: python3 scripts/generate-confidence-data.py [--dry-run]
"""
import json
import os
import sys
from pathlib import Path
from typing import Optional

DRY_RUN = '--dry-run' in sys.argv

BASE = Path('/Users/john/蒸馏2')
CORPUS_DIR = BASE / 'corpus'
ZERO_DIR = BASE / 'corpus' / 'distilled' / 'zero'

# ─── Slug mapping: registry slug → zero JSON filename ──────────────────────────
SLUG_TO_FILENAME = {
    'mo-zi': 'mo-zi',
    'alan-turing': 'alan-turing',
    'aleister-crowley': 'aleister-crowley',
    'carl-jung': 'carl-jung',
    'charlie-munger': 'charlie-munger',
    'confucius': 'confucius',
    'donald-trump': 'donald-trump',
    'einstein': 'einstein',
    'elon-musk': 'elon-musk',
    'epictetus': 'epictetus',
    'han-fei-zi': 'han-fei-zi',
    'hui-neng': 'hui-neng',
    'jack-ma': 'jack-ma',
    'jiqun': 'jiqun',
    'journey-west': 'journey-west',
    'laozi': 'laozi',
    'marcus-aurelius': 'marcus-aurelius',
    'naval-ravikant': 'naval-ravikant',
    'ni-haixia': 'ni-haixia',
    'nikola-tesla': 'nikola-tesla',
    'paul-graham': 'paul-graham',
    'peter-thiel': 'peter-thiel',
    'qian-xuesen': 'qian-xuesen',
    'qu-yuan': 'qu-yuan',
    'ray-dalio': 'ray-dalio',
    'sam-altman': 'sam-altman',
    'seneca': 'seneca',
    'sima-qian': 'sima-qian',
    'sun-tzu': 'sun-tzu',
    'sun-wukong': 'sun-wukong',
    'three-kingdoms': 'three-kingdoms',
    'tripitaka': 'tripitaka',
    'wang-dongyue': 'wang-dongyue',
    'warren-buffett': 'warren-buffett',
    'zhang-xuefeng': 'zhang-xuefeng',
    'zhu-bajie': 'zhu-bajie',
    'zhuangzi': 'zhuangzi',
    'zhuge-liang': 'zhuge-liang',
    'liu-bei': 'liu-bei',
    'cao-cao': 'cao-cao',
    'mencius': 'mencius',
    'xiang-yu': 'xiang-yu',
}

# Manifest paths per persona slug
MANIFEST_MAP = {
    'mo-zi': 'mo-zi/manifest.json',
    'alan-turing': 'alan-turing/manifest.json',
    'carl-jung': 'carl-jung/manifest.json',
    'charlie-munger': 'charlie-munger/manifest.json',
    'confucius': 'confucius/manifest.json',
    'donald-trump': 'donald-trump/manifest.json',
    'einstein': 'einstein/manifest.json',
    'elon-musk': 'elon-musk/manifest.json',
    'epictetus': 'epictetus/manifest.json',
    'han-fei-zi': 'han-fei-zi/manifest.json',
    'hui-neng': 'hui-neng/manifest.json',
    'jack-ma': 'jack-ma/manifest.json',
    'jiqun': 'jiqun/manifest.json',
    'laozi': 'laozi/manifest.json',
    'naval-ravikant': 'naval-ravikant/manifest.json',
    'ni-haixia': 'ni-haixia/manifest.json',
    'nikola-tesla': 'nikola-tesla/manifest.json',
    'paul-graham': 'paul-graham/manifest.json',
    'peter-thiel': 'peter-thiel/manifest.json',
    'qian-xuesen': 'qian-xuesen/manifest.json',
    'qu-yuan': 'qu-yuan/manifest.json',
    'ray-dalio': 'ray-dalio/manifest.json',
    'sam-altman': 'sam-altman/manifest.json',
    'seneca': 'seneca/manifest.json',
    'sima-qian': 'sima-qian/manifest.json',
    'sun-tzu': 'sun-tzu/manifest.json',
    'warren-buffett': 'warren-buffett/manifest.json',
    'zhang-xuefeng': 'zhang-xuefeng/manifest.json',
    'zhuangzi': 'zhuangzi/manifest.json',
    'zhuge-liang': 'zhuge-liang/manifest.json',
    'liu-bei': 'liu-bei/manifest.json',
    'cao-cao': 'cao-cao/manifest.json',
    'mencius': 'mencius/manifest.json',
    'xiang-yu': 'xiang-yu/manifest.json',
    'sun-wukong': 'sun-wukong/manifest.json',
    'zhu-bajie': 'zhu-bajie/manifest.json',
    'aleister-crowley': 'aleister-crowley/manifest.json',
    'journey-west': 'journey-west/manifest.json',
    'three-kingdoms': 'three-kingdoms/manifest.json',
    'tripitaka': 'tripitaka/manifest.json',
    'wang-dongyue': 'wang-dongyue/manifest.json',
    'marcus-aurelius': 'marcus-aurelius/manifest.json',
}

# Personas that already have good static entries - we KEEP those as-is
KEEP_STATIC = {
    'wittgenstein', 'elon-musk', 'peter-thiel', 'steve-jobs', 'naval-ravikant',
    'charlie-munger', 'paul-graham', 'jeff-bezos', 'ray-dalio', 'jensen-huang',
    'sam-altman', 'hui-neng', 'feynman', 'warren-buffett', 'confucius',
    'lao-zi', 'zhuang-zi', 'sun-tzu', 'socrates', 'seneca', 'marcus-aurelius',
    'alan-turing', 'nikola-tesla', 'einstein', 'nassim-taleb', 'sima-qian',
    'alan-watts', 'jiqun',
}

# Slug aliases: from → to
SLUG_ALIASES = {
    'richard-feynman': 'feynman',   # registry slug → static key
}


def load_zero_json(slug: str) -> Optional[dict]:
    filename = SLUG_TO_FILENAME.get(slug)
    if not filename:
        return None
    path = ZERO_DIR / (filename + '-zero.json')
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'  [WARN] {slug}: failed to load {path}: {e}', file=sys.stderr)
    return None


def load_manifest(slug: str) -> Optional[dict]:
    manifest_path = MANIFEST_MAP.get(slug)
    if not manifest_path:
        return None
    path = CORPUS_DIR / manifest_path
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f'  [WARN] {slug}: manifest parse error: {e}', file=sys.stderr)
    return None


def get_overall(obj) -> int:
    if isinstance(obj, dict):
        return int(obj.get('overall', 0))
    return int(obj) if obj else 0


def compute_breakdown(zero_data: Optional[dict]) -> dict:
    if not zero_data:
        return {'voiceFidelity': 0, 'knowledgeDepth': 0, 'reasoningPattern': 0, 'safetyCompliance': 0}
    score = zero_data.get('score', {})
    return {
        'voiceFidelity': get_overall(score.get('voice', {})),
        'knowledgeDepth': get_overall(score.get('knowledge', {})),
        'reasoningPattern': get_overall(score.get('reasoning', {})),
        'safetyCompliance': get_overall(score.get('safety', {})),
    }


def compute_overall(breakdown: dict) -> int:
    return round(
        breakdown['voiceFidelity'] * 0.30 +
        breakdown['knowledgeDepth'] * 0.30 +
        breakdown['reasoningPattern'] * 0.25 +
        breakdown['safetyCompliance'] * 0.15
    )


def get_grade(overall: int) -> str:
    if overall >= 90: return 'A'
    if overall >= 75: return 'B'
    if overall >= 60: return 'C'
    if overall >= 45: return 'D'
    return 'F'


def q(num: float) -> str:
    """Convert quality number (0-1 or 1-5) to star label.

    For corpusReport qualityScore (0-100 scale): 90+ = 5, 75+ = 4, 60+ = 3, else = 2
    For LLM confidence (0-1 scale): 0.9+ = 5, 0.75+ = 4, 0.6+ = 3, 0.4+ = 2, else = 1
    For pre-existing quality (1-5): direct mapping
    """
    if num >= 90:
        return '5'
    if num >= 75:
        return '4'
    if num >= 60:
        return '3'
    if num >= 40:
        return '2'
    return '1'


def corpus_quality_stars(zero_data: Optional[dict]) -> str:
    """Determine overall corpus quality stars from zero JSON."""
    if not zero_data:
        return '2'
    report = zero_data.get('corpusReport', {})
    # corpusReport uses 0-100 scale
    score = float(report.get('qualityScore', 0))
    return q(score)


def source_quality_stars(title: str, src_type: str, zero_data: Optional[dict]) -> str:
    """Determine quality stars for a single source.

    Classical primary texts (Chinese/Western canon): 5
    Well-known published books: 4-5
    Academic papers/reliable transcripts: 4
    News/secondary sources: 3
    LLM-extracted or corpus-derived: 3-4
    Unknown/weak sources: 2
    """
    title_lower = title.lower()
    src_lower = src_type.lower() if src_type else ''

    # Classical primary texts - highest quality
    classical_keywords = [
        '《', '》', 'mencius', 'analects', 'dao', 'de ', 'zhuangzi', 'chuang tzu',
        'tractatus', 'philosophical investigations', 'meditations', 'discourses',
        'poor charlie', 'zero to one', 'principles', 'book of the law',
    ]
    if any(kw in title_lower for kw in classical_keywords):
        return '5'

    # Academic / well-known publications
    academic_keywords = [
        'engineering cybernetics', 'collected papers', 'gutenberg',
        'lex fridman', 'almanack', 'rich', 'warren buffett',
    ]
    if any(kw in title_lower for kw in academic_keywords):
        return '4'

    # Primary speeches / transcripts - strong primary sources
    if 'speech' in title_lower or src_lower == 'primary':
        return '4'

    # Interview / transcript
    if 'interview' in title_lower or 'transcript' in title_lower:
        return '4'

    # LLM-extracted from corpus (titles with numbers, filenames, etc.)
    if any(c.isdigit() for c in title[:5]):
        return '3'

    # Background / secondary
    if '背景' in title or 'background' in title_lower:
        return '3'

    # Unknown
    return '3'


def extract_sources(zero_data: Optional[dict], manifest: Optional[dict]) -> list:
    """Extract real, meaningful data sources from zero JSON + manifest."""
    sources = []
    seen = set()
    corp_q = corpus_quality_stars(zero_data)

    def add(src_type, source, quantity, quality):
        key = (src_type, source, quantity)
        if key not in seen:
            seen.add(key)
            sources.append({
                'type': src_type,
                'source': source,
                'quantity': quantity,
                'quality': quality,
            })

    # 1. From zero JSON knowledge.sources (the most reliable source reference)
    if zero_data:
        knowledge = zero_data.get('knowledge', {})
        for ref in knowledge.get('sources', []):
            if isinstance(ref, dict):
                title = ref.get('title', '')
                if title:
                    src_type = ref.get('type', 'source')
                    quality = source_quality_stars(title, src_type, zero_data)
                    add(src_type, title, '原文引用', quality)

        # corpusReport totalWordCount
        report = zero_data.get('corpusReport', {})
        total_words = report.get('totalWordCount', 0)
        if total_words > 1000:
            add('corpus', '蒸馏语料', str(total_words) + ' 字', corp_q)

        # corpusReport corpusItems
        for item in report.get('corpusItems', [])[:3]:
            if isinstance(item, dict):
                title = item.get('title', '') or item.get('name', '')
                if title:
                    wc = item.get('wordCount', '全文')
                    quality = source_quality_stars(title, item.get('type', ''), zero_data)
                    add('corpus', title, str(wc), quality)

    # 2. From manifest.json texts
    if manifest:
        for t in manifest.get('texts', []):
            if isinstance(t, dict):
                title = t.get('title', '') or t.get('name', '')
                if title:
                    quality = source_quality_stars(title, t.get('type', ''), zero_data)
                    add(t.get('type', 'text'), title, '全文', quality)
        # corpus.totalWordCount
        for key in ['totalWordCount', 'wordCount']:
            wc = manifest.get(key, 0)
            if wc and wc > 1000 and not any('字' in str(s['quantity']) for s in sources):
                add('corpus', '语料库', str(wc) + ' 字', corp_q)
                break

    if not sources:
        add('corpus', '蒸馏管道语料', '语料数据', '2')

    return sources[:6]  # Limit to 6 most important sources


def generate_entry(slug: str, zero_data: Optional[dict], manifest: Optional[dict]) -> dict:
    breakdown = compute_breakdown(zero_data)
    overall = compute_overall(breakdown)
    data_sources = extract_sources(zero_data, manifest)

    version = 'zero-v1'
    if zero_data:
        version = zero_data.get('distillationVersion', 'zero-v1')

    gaps = []
    if zero_data:
        score = zero_data.get('score', {})
        expr = zero_data.get('expression', {})
        knowledge = zero_data.get('knowledge', {})
        report = zero_data.get('corpusReport', {})

        voice = get_overall(score.get('voice', {}))
        knowledge_score = get_overall(score.get('knowledge', {}))
        reasoning = get_overall(score.get('reasoning', {}))

        if voice < 60:
            gaps.append('表达DNA还原度偏低（' + str(voice) + '），零蒸馏对古典文本表达特征提取有限，建议补充演讲/访谈原文')

        vocab = expr.get('vocabulary', {}) if isinstance(expr, dict) else {}
        if isinstance(vocab, dict) and not vocab.get('topWords'):
            gaps.append('标志性词汇未从语料中提取，表达还原度受影响')

        mm = knowledge.get('mentalModels', []) if isinstance(knowledge, dict) else []
        if len(mm) < 3:
            gaps.append('思维模型数量不足（' + str(len(mm)) + '），需补充更多核心思想')

        total_words = report.get('totalWordCount', 0)
        if total_words < 10000:
            gaps.append('语料规模偏小（' + str(total_words) + '字），可能影响知识覆盖深度')

        if reasoning < 70:
            gaps.append('思维模式一致性偏低（' + str(reasoning) + '），需补充价值观和认知张力描述')
    else:
        gaps.append('尚未通过零蒸馏管道，质量评分待计算')
        gaps.append('建议运行：bun run scripts/zero/distill-zero.mjs --persona <slug>')

    return {
        'overall': overall,
        'breakdown': breakdown,
        'version': version,
        'dataSources': data_sources,
        'mainGaps': gaps,
    }


def ts_str(s) -> str:
    """Escape string for TypeScript single-quote context."""
    if s is None:
        return "''"
    s = str(s)
    s = s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ').replace('\r', '')
    return "'" + s + "'"


def ts_entry(slug: str, e: dict) -> str:
    bd = e['breakdown']
    ds_lines = []
    for ds in e['dataSources']:
        ds_lines.append(
            "      { type: " + ts_str(ds['type']) + ", source: " + ts_str(ds['source']) +
            ", quantity: " + ts_str(ds['quantity']) + ", quality: " + ts_str(ds['quality']) + " }"
        )
    ds_block = ',\n'.join(ds_lines)

    gap_lines = []
    for g in e['mainGaps']:
        gap_lines.append("      " + ts_str(g))
    gap_block = ',\n'.join(gap_lines)

    return (
        "  '" + slug + "': {\n" +
        "    overall: " + str(e['overall']) + ",\n" +
        "    breakdown: { voiceFidelity: " + str(bd['voiceFidelity']) +
        ", knowledgeDepth: " + str(bd['knowledgeDepth']) +
        ", reasoningPattern: " + str(bd['reasoningPattern']) +
        ", safetyCompliance: " + str(bd['safetyCompliance']) + " },\n" +
        "    version: " + ts_str(e['version']) + ",\n" +
        "    source: 'static',\n" +
        "    dataSources: [\n" + ds_block + "\n    ],\n" +
        "    mainGaps: [\n" + gap_block + "\n    ],\n" +
        "  },"
    )


# ─── All registry slugs (from personas.ts) ────────────────────────────────────
ALL_REGISTRY_SLUGS = [
    'steve-jobs', 'elon-musk', 'charlie-munger', 'richard-feynman', 'zhang-yiming',
    'paul-graham', 'andrej-karpathy', 'nassim-taleb', 'zhang-xuefeng', 'donald-trump',
    'mrbeast', 'ilya-sutskever', 'jiqun', 'kant', 'alan-watts', 'jensen-huang',
    'ni-haixia', 'osamu-dazai', 'wang-dongyue', 'lin-yutang', 'yuan-tiangang',
    'john-dee', 'marcus-aurelius-stoic', 'wittgenstein', 'alan-turing', 'aleister-crowley',
    'cao-cao', 'carl-jung', 'confucius', 'einstein', 'epictetus', 'han-fei-zi',
    'huangdi-neijing', 'hui-neng', 'jack-ma', 'jeff-bezos', 'john-maynard-keynes',
    'journey-west', 'lao-zi', 'li-chunfeng', 'liu-bei', 'marcus-aurelius',
    'mencius', 'mo-zi', 'naval-ravikant', 'nikola-tesla', 'peter-thiel',
    'qian-xuesen', 'qu-yuan', 'ray-dalio', 'records-grand-historian', 'sam-altman',
    'seneca', 'shao-yong', 'sima-qian', 'socrates', 'sun-tzu', 'sun-wukong',
    'three-kingdoms', 'tripitaka', 'warren-buffett', 'wittgenstein', 'xiang-yu',
    'zhu-bajie', 'zhuang-zi', 'zhuge-liang'
]

print('=== Confidence Data Generation v2 ===')
print()

# Process each slug (deduplicated)
seen_slugs = set()
entries = {}
for slug in ALL_REGISTRY_SLUGS:
    if slug in seen_slugs:
        continue
    seen_slugs.add(slug)

    if slug in KEEP_STATIC:
        entries[slug] = {'status': 'static', 'reason': 'keep-existing'}
        continue
    if slug in SLUG_ALIASES:
        # Will be added as alias, skip duplicate key
        entries[slug] = {'status': 'alias', 'target': SLUG_ALIASES[slug]}
        continue

    zero_data = load_zero_json(slug)
    manifest = load_manifest(slug)
    entry = generate_entry(slug, zero_data, manifest)
    entries[slug] = {'status': 'generated', 'entry': entry}
    if zero_data:
        entries[slug]['grade'] = get_grade(entry['overall'])

print('Slug                           Status        Overall  Grade  VF   KD   RP   SC')
print('-' * 90)
for slug in sorted(seen_slugs):
    r = entries.get(slug, {})
    s = r.get('status', 'unknown')
    if s == 'static':
        print(f'{slug:<30} keep-existing')
    elif s == 'alias':
        print(f'{slug:<30} alias -> {r["target"]}')
    elif s == 'generated':
        e = r['entry']
        grade = r.get('grade', '?')
        bd = e['breakdown']
        print(f'{slug:<30} generated    {e["overall"]:<8} {grade:<6} {bd["voiceFidelity"]:<5} {bd["knowledgeDepth"]:<5} {bd["reasoningPattern"]:<5} {bd["safetyCompliance"]}')

print()
print(f'Total unique slugs: {len(seen_slugs)}')
print(f'  Keep static: {len([r for r in entries.values() if r["status"]=="static"])}')
print(f'  Generated:  {len([r for r in entries.values() if r["status"]=="generated"])}')
print(f'  Aliases:    {len([r for r in entries.values() if r["status"]=="alias"])}')

# Print all generated TypeScript entries
print()
print('=' * 60)
print('GENERATED TYPESCRIPT ENTRIES:')
print('=' * 60)
for slug in sorted(seen_slugs):
    r = entries.get(slug, {})
    if r.get('status') == 'generated':
        print()
        print('// --- ' + slug + ' ---')
        print(ts_entry(slug, r['entry']))

print()
print('=' * 60)
print('NOTE: The following slugs are handled as aliases:')
for slug, r in sorted(entries.items()):
    if r.get('status') == 'alias':
        print(f'  {slug} -> {r["target"]} (uses same static entry)')
print()
print('Done.')
