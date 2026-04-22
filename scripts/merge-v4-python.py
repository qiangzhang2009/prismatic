#!/usr/bin/env python3
"""
Robust V4 -> PERSONAS.ts Merger
"""
import json, os, re, shutil, sys
from pathlib import Path

V4_DIR = Path("corpus/distilled/v4")
PERSONAS_TS = Path("src/lib/personas.ts")
BACKUP_DIR = Path("src/lib/backup")
BACKUP_DIR.mkdir(exist_ok=True)

PERSONA_META = {
    'wittgenstein': {'Name': 'Ludwig Wittgenstein', 'nameZh': '路德维希·维特根斯坦', 'domain': ['philosophy'], 'accentColor': '#6366f1', 'gradientFrom': '#6366f1', 'gradientTo': '#8b5cf6'},
    'alan-turing': {'Name': 'Alan Turing', 'nameZh': '艾伦·图灵', 'domain': ['science', 'philosophy'], 'accentColor': '#3b82f6', 'gradientFrom': '#3b82f6', 'gradientTo': '#60a5fa'},
    'aleister-crowley': {'Name': 'Aleister Crowley', 'nameZh': '阿莱斯特·克劳利', 'domain': ['spirituality'], 'accentColor': '#8b5cf6', 'gradientFrom': '#8b5cf6', 'gradientTo': '#a78bfa'},
    'cao-cao': {'Name': 'Cao Cao', 'nameZh': '曹操', 'domain': ['history'], 'accentColor': '#dc2626', 'gradientFrom': '#dc2626', 'gradientTo': '#f87171'},
    'carl-jung': {'Name': 'Carl Jung', 'nameZh': '卡尔·荣格', 'domain': ['psychology'], 'accentColor': '#f59e0b', 'gradientFrom': '#f59e0b', 'gradientTo': '#fbbf24'},
    'confucius': {'Name': 'Confucius', 'nameZh': '孔子', 'domain': ['philosophy'], 'accentColor': '#7c3aed', 'gradientFrom': '#7c3aed', 'gradientTo': '#a78bfa'},
    'einstein': {'Name': 'Albert Einstein', 'nameZh': '阿尔伯特·爱因斯坦', 'domain': ['science'], 'accentColor': '#fbbf24', 'gradientFrom': '#fbbf24', 'gradientTo': '#fde68a'},
    'epictetus': {'Name': 'Epictetus', 'nameZh': '爱比克泰德', 'domain': ['stoicism'], 'accentColor': '#059669', 'gradientFrom': '#059669', 'gradientTo': '#34d399'},
    'han-fei-zi': {'Name': 'Han Fei Zi', 'nameZh': '韩非子', 'domain': ['strategy', 'philosophy'], 'accentColor': '#0891b2', 'gradientFrom': '#0891b2', 'gradientTo': '#22d3ee'},
    'huangdi-neijing': {'Name': 'Huang Di Nei Jing', 'nameZh': '黄帝内经', 'domain': ['medicine'], 'accentColor': '#16a34a', 'gradientFrom': '#16a34a', 'gradientTo': '#4ade80'},
    'hui-neng': {'Name': 'Hui Neng', 'nameZh': '慧能', 'domain': ['zen-buddhism'], 'accentColor': '#ca8a04', 'gradientFrom': '#ca8a04', 'gradientTo': '#eab308'},
    'jack-ma': {'Name': 'Jack Ma', 'nameZh': '马云', 'domain': ['business'], 'accentColor': '#ea580c', 'gradientFrom': '#ea580c', 'gradientTo': '#fb923c'},
    'jeff-bezos': {'Name': 'Jeff Bezos', 'nameZh': '杰夫·贝索斯', 'domain': ['business'], 'accentColor': '#2563eb', 'gradientFrom': '#2563eb', 'gradientTo': '#60a5fa'},
    'john-maynard-keynes': {'Name': 'John Maynard Keynes', 'nameZh': '约翰·梅纳德·凯恩斯', 'domain': ['economics'], 'accentColor': '#0d9488', 'gradientFrom': '#0d9488', 'gradientTo': '#2dd4bf'},
    'journey-west': {'Name': 'Journey to the West', 'nameZh': '西游记', 'domain': ['literature'], 'accentColor': '#d97706', 'gradientFrom': '#d97706', 'gradientTo': '#fbbf24'},
    'lao-zi': {'Name': 'Lao Zi', 'nameZh': '老子', 'domain': ['philosophy'], 'accentColor': '#65a30d', 'gradientFrom': '#65a30d', 'gradientTo': '#a3e635'},
    'li-chunfeng': {'Name': 'Li Chunfeng', 'nameZh': '李淳风', 'domain': ['history'], 'accentColor': '#b45309', 'gradientFrom': '#b45309', 'gradientTo': '#d97706'},
    'liu-bei': {'Name': 'Liu Bei', 'nameZh': '刘备', 'domain': ['history'], 'accentColor': '#65a30d', 'gradientFrom': '#65a30d', 'gradientTo': '#84cc16'},
    'marcus-aurelius': {'Name': 'Marcus Aurelius', 'nameZh': '马可·奥勒留', 'domain': ['stoicism'], 'accentColor': '#b45309', 'gradientFrom': '#b45309', 'gradientTo': '#d97706'},
    'mencius': {'Name': 'Mencius', 'nameZh': '孟子', 'domain': ['philosophy'], 'accentColor': '#7c3aed', 'gradientFrom': '#7c3aed', 'gradientTo': '#a78bfa'},
    'mo-zi': {'Name': 'Mo Zi', 'nameZh': '墨子', 'domain': ['philosophy'], 'accentColor': '#0891b2', 'gradientFrom': '#0891b2', 'gradientTo': '#22d3ee'},
    'naval-ravikant': {'Name': 'Naval Ravikant', 'nameZh': '纳瓦尔·拉维坎特', 'domain': ['investment', 'philosophy'], 'accentColor': '#059669', 'gradientFrom': '#059669', 'gradientTo': '#34d399'},
    'nikola-tesla': {'Name': 'Nikola Tesla', 'nameZh': '尼古拉·特斯拉', 'domain': ['science'], 'accentColor': '#0891b2', 'gradientFrom': '#0891b2', 'gradientTo': '#22d3ee'},
    'peter-thiel': {'Name': 'Peter Thiel', 'nameZh': '彼得·蒂尔', 'domain': ['investment'], 'accentColor': '#1e1b4b', 'gradientFrom': '#1e1b4b', 'gradientTo': '#4338ca'},
    'qian-xuesen': {'Name': 'Qian Xuesen', 'nameZh': '钱学森', 'domain': ['science'], 'accentColor': '#dc2626', 'gradientFrom': '#dc2626', 'gradientTo': '#f87171'},
    'qu-yuan': {'Name': 'Qu Yuan', 'nameZh': '屈原', 'domain': ['literature', 'philosophy'], 'accentColor': '#0891b2', 'gradientFrom': '#0891b2', 'gradientTo': '#22d3ee'},
    'ray-dalio': {'Name': 'Ray Dalio', 'nameZh': '雷·达里奥', 'domain': ['investment'], 'accentColor': '#1d4ed8', 'gradientFrom': '#1d4ed8', 'gradientTo': '#3b82f6'},
    'records-grand-historian': {'Name': 'Sima Qian', 'nameZh': '司马迁', 'domain': ['history'], 'accentColor': '#7c3aed', 'gradientFrom': '#7c3aed', 'gradientTo': '#a78bfa'},
    'sam-altman': {'Name': 'Sam Altman', 'nameZh': '萨姆·阿尔特曼', 'domain': ['AI'], 'accentColor': '#10b981', 'gradientFrom': '#10b981', 'gradientTo': '#34d399'},
    'seneca': {'Name': 'Seneca', 'nameZh': '塞涅卡', 'domain': ['stoicism'], 'accentColor': '#b45309', 'gradientFrom': '#b45309', 'gradientTo': '#d97706'},
    'shao-yong': {'Name': 'Shao Yong', 'nameZh': '邵雍', 'domain': ['philosophy'], 'accentColor': '#7c3aed', 'gradientFrom': '#7c3aed', 'gradientTo': '#a78bfa'},
    'sima-qian': {'Name': 'Sima Qian', 'nameZh': '司马迁', 'domain': ['history'], 'accentColor': '#7c3aed', 'gradientFrom': '#7c3aed', 'gradientTo': '#a78bfa'},
    'socrates': {'Name': 'Socrates', 'nameZh': '苏格拉底', 'domain': ['philosophy'], 'accentColor': '#6366f1', 'gradientFrom': '#6366f1', 'gradientTo': '#8b5cf6'},
    'sun-tzu': {'Name': 'Sun Tzu', 'nameZh': '孙子', 'domain': ['strategy'], 'accentColor': '#b45309', 'gradientFrom': '#b45309', 'gradientTo': '#d97706'},
    'sun-wukong': {'Name': 'Sun Wukong', 'nameZh': '孙悟空', 'domain': ['fiction'], 'accentColor': '#dc2626', 'gradientFrom': '#dc2626', 'gradientTo': '#f87171'},
    'three-kingdoms': {'Name': 'Romance of Three Kingdoms', 'nameZh': '三国演义', 'domain': ['history', 'literature'], 'accentColor': '#dc2626', 'gradientFrom': '#dc2626', 'gradientTo': '#f87171'},
    'tripitaka': {'Name': 'Tripitaka', 'nameZh': '大唐西域记', 'domain': ['philosophy'], 'accentColor': '#ca8a04', 'gradientFrom': '#ca8a04', 'gradientTo': '#eab308'},
    'xiang-yu': {'Name': 'Xiang Yu', 'nameZh': '项羽', 'domain': ['history'], 'accentColor': '#dc2626', 'gradientFrom': '#dc2626', 'gradientTo': '#f87171'},
    'zhu-bajie': {'Name': 'Zhu Bajie', 'nameZh': '猪八戒', 'domain': ['fiction'], 'accentColor': '#ea580c', 'gradientFrom': '#ea580c', 'gradientTo': '#fb923c'},
    'zhuang-zi': {'Name': 'Zhuang Zi', 'nameZh': '庄子', 'domain': ['philosophy'], 'accentColor': '#65a30d', 'gradientFrom': '#65a30d', 'gradientTo': '#a3e635'},
    'zhuge-liang': {'Name': 'Zhuge Liang', 'nameZh': '诸葛亮', 'domain': ['strategy', 'history'], 'accentColor': '#0891b2', 'gradientFrom': '#0891b2', 'gradientTo': '#22d3ee'},
}

AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6', '#f97316', '#84b6f4']

def get_avatar(name, color):
    parts = name.split()[:2]
    initials = ''.join(p[0] for p in parts).upper()[:2]
    return 'https://ui-avatars.com/api/?name=' + initials + '&background=' + color[1:] + '&color=fff&bold=true&format=svg'

def hcode(s):
    h = 0
    for c in s:
        h = (h * 31 + ord(c)) & 0xFFFFFFFF
    return h

# ─── Helpers ───────────────────────────────────────────────────────────────────
def s(s):
    if not s: return ''
    return s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

def arr(lst):
    if not lst: return '[]'
    return '[' + ', '.join("'" + s(v) + "'" for v in lst) + ']'

def ev_list(ev):
    parts = []
    for e in ev:
        q = s(e.get('quote', ''))
        src = s(e.get('source', ''))
        yr = e.get('year')
        yr_str = str(yr) if yr is not None else 'undefined'
        parts.append('{ quote: \'' + q + '\', source: \'' + src + '\', year: ' + yr_str + ' }')
    return '[' + ', '.join(parts) + ']'

def gen_mm(mm):
    ev = ev_list(mm.get('evidence') or [])
    return (
        '    {\n'
        '      id: \'' + s(mm['id']) + '\',\n'
        '      name: \'' + s(mm['name']) + '\',\n'
        '      nameZh: \'' + s(mm['nameZh']) + '\',\n'
        '      oneLiner: \'' + s(mm['oneLiner']) + '\',\n'
        '      evidence: ' + ev + ',\n'
        '      crossDomain: ' + arr(mm.get('crossDomain') or []) + ',\n'
        '      application: \'' + s(mm['application']) + '\',\n'
        '      limitation: \'' + s(mm['limitation']) + '\'\n'
        '    }'
    )

def gen_dh(dh):
    ex = dh.get('example')
    example_part = ',\n      example: \'' + s(ex) + '\'' if ex else ''
    return (
        '    {\n'
        '      id: \'' + s(dh['id']) + '\',\n'
        '      name: \'' + s(dh['name']) + '\',\n'
        '      nameZh: \'' + s(dh['nameZh']) + '\',\n'
        '      description: \'' + s(dh['description']) + '\',\n'
        '      application: \'' + s(dh['application']) + '\'' + example_part + '\n'
        '    }'
    )

def gen_block(pid, p):
    edna = p.get('expressionDNA') or {}
    mms = p.get('mentalModels') or []
    dhs = p.get('decisionHeuristics') or []
    vals = p.get('values') or []
    tensions = p.get('tensions') or []
    hbs = p.get('honestBoundaries') or []
    sources = p.get('sources') or []

    mms_str = '[\n' + ',\n'.join(gen_mm(m) for m in mms) + '\n  ]' if mms else '[]'
    dhs_str = '[\n' + ',\n'.join(gen_dh(d) for d in dhs) + '\n  ]' if dhs else '[]'

    vals_parts = []
    for v in vals:
        nm = s(v.get('name', ''))
        nmz = s(v.get('nameZh', v.get('name', '')))
        desc = s(v.get('description', ''))
        pri = v.get('priority', 3)
        vals_parts.append('    { name: \'' + nm + '\', nameZh: \'' + nmz + '\', priority: ' + str(pri) + ', description: \'' + desc + '\' }')
    vals_str = '[\n' + ',\n'.join(vals_parts) + '\n  ]' if vals_parts else '[]'

    tens_parts = []
    for t in tensions:
        dim = s(t.get('dimension', ''))
        tzh = s(t.get('tensionZh', t.get('tension', '')))
        desc = s(t.get('description', ''))
        descz = s(t.get('descriptionZh', t.get('description', '')))
        tens_parts.append('    { dimension: \'' + dim + '\', tensionZh: \'' + tzh + '\', description: \'' + desc + '\', descriptionZh: \'' + descz + '\' }')
    tens_str = '[\n' + ',\n'.join(tens_parts) + '\n  ]' if tens_parts else '[]'

    hb_parts = []
    for hb in hbs:
        txt = s(hb.get('text', ''))
        txz = s(hb.get('textZh', hb.get('text', '')))
        hb_parts.append('    { text: \'' + txt + '\', textZh: \'' + txz + '\' }')
    hb_str = '[\n' + ',\n'.join(hb_parts) + '\n  ]' if hb_parts else '[]'

    src_parts = []
    for sr in sources:
        typ = sr.get('type', 'book')
        ttl = s(sr.get('title', ''))
        desc = s(sr.get('description', ''))
        src_parts.append('    { type: \'' + typ + '\', title: \'' + ttl + '\', description: \'' + desc + '\' }')
    src_str = '[\n' + ',\n'.join(src_parts) + '\n  ]' if src_parts else '[]'

    domain_str = '[' + ', '.join("'" + d + "'" for d in p.get('domain', [])) + ']'

    lines = [
        "PERSONAS['" + pid + "'] = {",
        "  id: '" + pid + "',",
        "  slug: '" + pid + "',",
        "  name: '" + s(p['name']) + "',",
        "  nameZh: '" + s(p['nameZh']) + "',",
        "  nameEn: '" + s(p['nameEn']) + "',",
        "  domain: " + domain_str + ",",
        "  tagline: '" + s(p['tagline']) + "',",
        "  taglineZh: '" + s(p['taglineZh']) + "',",
        "  avatar: '" + p['avatar'] + "',",
        "  accentColor: '" + p['accentColor'] + "',",
        "  gradientFrom: '" + p['gradientFrom'] + "',",
        "  gradientTo: '" + p['gradientTo'] + "',",
        "  brief: '" + s(p['brief']) + "',",
        "  briefZh: '" + s(p['briefZh']) + "',",
        "  mentalModels: " + mms_str + ",",
        "  decisionHeuristics: " + dhs_str + ",",
        "  expressionDNA: {",
        "    sentenceStyle: " + arr(edna.get('sentenceStyle', [])) + ",",
        "    vocabulary: " + arr(edna.get('vocabulary', [])) + ",",
        "    forbiddenWords: " + arr(edna.get('forbiddenWords', [])) + ",",
        "    rhythm: '" + s(edna.get('rhythm', '')) + "',",
        "    humorStyle: '" + s(edna.get('humorStyle', '')) + "',",
        "    certaintyLevel: '" + edna.get('certaintyLevel', 'medium') + "',",
        "    rhetoricalHabit: '" + s(edna.get('rhetoricalHabit', '')) + "',",
        "    quotePatterns: " + arr(edna.get('quotePatterns', [])) + ",",
        "    chineseAdaptation: '" + s(edna.get('chineseAdaptation', '')) + "',",
        "    verbalMarkers: " + arr(edna.get('verbalMarkers', [])) + ",",
        "    speakingStyle: '" + s(edna.get('speakingStyle', '')) + "'",
        "  },",
        "  values: " + vals_str + ",",
        "  antiPatterns: " + arr(p.get('antiPatterns') or []) + ",",
        "  tensions: " + tens_str + ",",
        "  honestBoundaries: " + hb_str + ",",
        "  strengths: " + arr(p.get('strengths') or []) + ",",
        "  blindspots: " + arr(p.get('blindspots') or []) + ",",
        "  sources: " + src_str + ",",
        "  researchDate: '" + p.get('researchDate', '') + "',",
        "  version: '" + p.get('version', '') + "',",
        "  researchDimensions: [],",
        "  systemPromptTemplate: '" + s(p.get('systemPromptTemplate', '')) + "',",
        "  identityPrompt: '" + s(p.get('identityPrompt', '')) + "',",
        "}",
    ]
    return '\n'.join(lines)

# ─── Converter ────────────────────────────────────────────────────────────────
def convert_v4(pid, v4):
    meta = PERSONA_META.get(pid, {
        'Name': ' '.join(p.capitalize() for p in pid.split('-')),
        'nameZh': pid, 'domain': ['philosophy'],
        'accentColor': AVATAR_COLORS[abs(hcode(pid)) % len(AVATAR_COLORS)],
        'gradientFrom': AVATAR_COLORS[abs(hcode(pid)) % len(AVATAR_COLORS)],
        'gradientTo': '#8b5cf6',
    })

    k = v4.get('knowledge', {})
    e = v4.get('expression', {})
    mv4 = v4.get('meta', {})

    def mm_map(m_obj, i):
        return {
            'id': m_obj.get('id', 'mm-' + str(i)),
            'name': m_obj.get('name', 'Model ' + str(i+1)),
            'nameZh': m_obj.get('nameZh', m_obj.get('name', '思维模型' + str(i+1))),
            'oneLiner': m_obj.get('oneLiner') or m_obj.get('oneLinerZh', ''),
            'evidence': [{'quote': ev.get('quote', ''), 'source': ev.get('source', ''), 'year': ev.get('year')} for ev in (m_obj.get('evidence') or [])],
            'crossDomain': m_obj.get('crossDomain') or [],
            'application': m_obj.get('application') or m_obj.get('applicationZh', ''),
            'limitation': m_obj.get('limitation') or m_obj.get('limitationZh', ''),
        }

    def dh_map(h, i):
        return {
            'id': h.get('id', 'dh-' + str(i)),
            'name': h.get('name', 'Heuristic ' + str(i+1)),
            'nameZh': h.get('nameZh', h.get('name', '决策启发式' + str(i+1))),
            'description': h.get('description') or h.get('descriptionZh', ''),
            'application': h.get('application') or h.get('applicationZh', ''),
            'example': h.get('example') or h.get('exampleZh', ''),
        }

    mental_models = [mm_map(m_obj, i) for i, m_obj in enumerate(k.get('mentalModels') or [])]
    decision_heuristics = [dh_map(h, i) for i, h in enumerate(k.get('decisionHeuristics') or [])]
    values = [{
        'name': v.get('name', ''), 'nameZh': v.get('nameZh', v.get('name', '')),
        'priority': v.get('priority', 3),
        'description': v.get('description') or v.get('descriptionZh', ''),
    } for v in (k.get('values') or [])]
    tensions = [{
        'dimension': t.get('dimension', '') or t.get('dimensionZh', ''),
        'tensionZh': t.get('tensionZh', '') or t.get('tension', ''),
        'description': t.get('description', ''),
        'descriptionZh': t.get('descriptionZh', t.get('description', '')),
    } for t in (k.get('tensions') or [])]
    honest_boundaries = [{
        'text': hb.get('text', ''), 'textZh': hb.get('textZh', hb.get('text', '')),
    } for hb in (k.get('honestBoundaries') or [])]

    tagline = (values[0]['nameZh'] if values else '') or meta['nameZh']

    tone = e.get('tone', 'medium')
    tone_desc = '正式严谨' if tone == 'formal' else '轻松自然' if tone == 'casual' else '中性'
    cert = e.get('certaintyLevel', 'medium')
    cert_desc = '表达确定果断' if cert == 'high' else '保持适度不确定' if cert == 'low' else '平衡客观'
    core_vals = ', '.join(v['nameZh'] or v['name'] for v in values[:3] if v.get('nameZh') or v.get('name')) or '待定义'
    identity = k.get('identityPromptZh') or k.get('identityPrompt') or meta['nameZh']
    sp = identity.split('。')[0]
    system_prompt = '你是' + sp + '。表达风格：' + (e.get('speakingStyle') or e.get('tone') or 'formal') + '。语气：' + tone_desc + '。确信程度：' + cert_desc + '。核心价值观：' + core_vals + '。'

    return {
        'id': pid, 'slug': pid,
        'name': meta['Name'], 'nameZh': meta['nameZh'],
        'nameEn': meta['Name'],
        'domain': meta['domain'],
        'tagline': tagline, 'taglineZh': tagline,
        'avatar': get_avatar(meta['Name'], meta['accentColor']),
        'accentColor': meta['accentColor'],
        'gradientFrom': meta['gradientFrom'],
        'gradientTo': meta['gradientTo'],
        'brief': (k.get('identityPrompt') or '')[:200],
        'briefZh': (k.get('identityPromptZh') or k.get('identityPrompt') or '')[:200],
        'mentalModels': mental_models,
        'decisionHeuristics': decision_heuristics,
        'expressionDNA': {
            'sentenceStyle': e.get('sentenceStyle', []),
            'vocabulary': e.get('vocabulary', []),
            'forbiddenWords': e.get('forbiddenWords', []),
            'rhythm': e.get('rhythm') or e.get('rhythmDescription', ''),
            'humorStyle': '', 'certaintyLevel': e.get('certaintyLevel', 'medium'),
            'rhetoricalHabit': e.get('rhetoricalHabit', ''),
            'quotePatterns': e.get('quotePatterns', []),
            'chineseAdaptation': e.get('chineseAdaptation', ''),
            'verbalMarkers': e.get('verbalMarkers', []),
            'speakingStyle': e.get('speakingStyle', ''),
        },
        'values': values,
        'antiPatterns': k.get('antiPatterns') or [],
        'tensions': tensions,
        'honestBoundaries': honest_boundaries,
        'strengths': k.get('strengths') or [],
        'blindspots': k.get('blindspots') or [],
        'sources': [{'type': sr.get('type', 'book'), 'title': sr.get('title', ''), 'description': sr.get('description', '')} for sr in (k.get('sources') or [])],
        'researchDate': mv4.get('createdAt', '')[:10] if mv4.get('createdAt') else '',
        'version': 'v4-' + str(v4.get('score', {}).get('overall', 0)),
        'researchDimensions': [],
        'systemPromptTemplate': system_prompt,
        'identityPrompt': k.get('identityPrompt') or 'I am ' + meta['Name'] + '.',
    }

# ─── Block Scanner ────────────────────────────────────────────────────────────
class Block:
    def __init__(self, pid, start, end):
        self.id = pid; self.start = start; self.end = end

def find_blocks(content):
    blocks = []
    for m in re.finditer(r"PERSONAS\[([\"'])([^\1]+?)\1\]\s*=\s*\{", content):
        pid = m.group(2)
        start = m.start()
        after = start + m.end() - start
        depth = 1
        end_idx = -1
        for i in range(after, len(content)):
            c = content[i]
            if c == '{': depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    if content[i+1:i+2] == ';':
                        end_idx = i + 2
                    else:
                        semi = content.find(';', i+1)
                        end_idx = semi + 1 if semi >= 0 and semi <= i + 50 else i + 1
                    break
        if end_idx >= 0:
            blocks.append(Block(pid, start, end_idx))
        else:
            print('  WARN: could not find end for ' + pid)
    blocks.sort(key=lambda b: b.start, reverse=True)
    return blocks

# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    write_mode = '--write' in sys.argv

    print('Scanning V4 files...')
    v4_files = sorted(f for f in os.listdir(V4_DIR) if f.endswith('-v4.json'))
    print('Found ' + str(len(v4_files)) + ' V4 files')

    v4_data = {}
    for file in v4_files:
        pid = file.replace('-v4.json', '')
        v4 = json.load(open(V4_DIR / file, encoding='utf-8'))
        p = convert_v4(pid, v4)
        v4_data[pid] = {'p': p, 'score': v4.get('score', {}).get('overall', 0), 'grade': v4.get('score', {}).get('grade', '?'), 'route': v4.get('meta', {}).get('route', 'unknown')}

    original = PERSONAS_TS.read_text(encoding='utf-8')
    export_marker = '// ─── Legacy Exports'
    export_idx = original.find(export_marker)

    blocks = find_blocks(original)
    print('Scanner found ' + str(len(blocks)) + ' blocks')

    existing_ids = {b.id for b in blocks}
    to_replace = []
    to_append = []

    for pid in sorted(v4_data.keys()):
        info = v4_data[pid]
        ts_block = gen_block(pid, info['p'])
        existing = next((b for b in blocks if b.id == pid), None)
        if existing:
            to_replace.append((existing, ts_block))
            print('  [REPLACE] ' + pid + ': score=' + str(info['score']) + ' grade=' + info['grade'] + ' route=' + info['route'])
        else:
            to_append.append((pid, ts_block))
            print('  [NEW]     ' + pid + ': score=' + str(info['score']) + ' grade=' + info['grade'] + ' route=' + info['route'])

    print('\nSummary: ' + str(len(to_replace)) + ' replace, ' + str(len(to_append)) + ' append')

    if not write_mode:
        print('\nDry run -- use --write to apply')
        return

    content = original
    replaced = 0
    for block, ts_block in to_replace:
        key = "PERSONAS['" + block.id + "']"
        pos = content.find(key)
        if pos < 0:
            key_dq = 'PERSONAS["' + block.id + '"]'
            pos = content.find(key_dq)
        if pos >= 0:
            depth = 0
            started = False
            end_pos = -1
            for i in range(pos, len(content)):
                if content[i] == '{' and started:
                    depth += 1
                elif content[i] == '{':
                    started = True
                    depth = 1
                elif content[i] == '}' and started:
                    depth -= 1
                    if depth == 0:
                        end_pos = i + 1
                        break
            if end_pos >= 0 and content[end_pos:end_pos+1] == ';':
                end_pos += 1
            if end_pos >= 0:
                content = content[:pos] + ts_block + content[end_pos:]
                print('  Replaced ' + block.id + ' at ' + str(pos))
                replaced += 1
            else:
                print('  WARN: could not find end for ' + block.id)
        else:
            print('  WARN: could not find ' + block.id)

    if to_append and export_idx >= 0:
        before = content[:export_idx].rstrip()
        after = content[export_idx:]
        new_blocks = '\n\n'.join(ts for _, ts in to_append)
        content = before + '\n\n' + new_blocks + '\n\n' + after

    backup_file = BACKUP_DIR / ('personas-pre-v4-' + str(int(os.times().elapsed * 1000000)) + '.ts')
    shutil.copy2(PERSONAS_TS, backup_file)
    print('\nBackup: ' + str(backup_file))

    PERSONAS_TS.write_text(content, encoding='utf-8')
    print('Written: ' + str(PERSONAS_TS))
    print('  Replaced: ' + str(replaced) + ' | Appended: ' + str(len(to_append)))

if __name__ == '__main__':
    main()
