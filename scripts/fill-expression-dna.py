#!/usr/bin/env python3
"""Fill expressionDNA for personas that are missing it or have empty fields."""

import re

def get_default_expression_dna(persona_id, domain):
    """Generate default expressionDNA based on domain."""
    base = {
        'sentenceStyle': [
            '使用简洁有力的陈述句，直接表达核心观点',
            '善用对比和转折结构，如"不是A，而是B"',
            '偏好使用设问句引导听众思考'
        ],
        'vocabulary': ['务实', '理性', '分析', '判断', '实践'],
        'forbiddenWords': ['大概', '可能', '也许', '差不多'],
        'rhythm': '语言简洁直接，逻辑清晰，偏好使用对比和设问来强化观点。',
        'humorStyle': '理性克制，幽默少见，如有则为冷静的讽刺或自嘲。',
        'certaintyLevel': 'high',
        'rhetoricalHabit': '善用对比结构，通过"不是...而是..."来突出核心观点。',
        'quotePatterns': ['引用经典著作或历史人物的名言'],
        'chineseAdaptation': '保持简洁直接的表达风格，避免冗长复杂的句式，多用短句。',
        'verbalMarkers': ['关键是', '本质上', '核心是'],
        'speakingStyle': '表达简洁有力，逻辑清晰，偏好使用对比和设问来强化观点。'
    }
    
    # Customize based on domain
    if 'philosophy' in domain:
        base['vocabulary'] = ['哲理', '本质', '思辨', '智慧', '修养']
        base['forbiddenWords'] = ['肤浅', '随波逐流', '盲从']
    elif 'technology' in domain or 'AI' in domain:
        base['vocabulary'] = ['创新', '技术', '算法', '智能', '数据']
        base['forbiddenWords'] = ['保守', '传统', '固守成规']
    elif 'business' in domain:
        base['vocabulary'] = ['战略', '执行', '效率', '增长', '价值']
        base['forbiddenWords'] = ['低效', '浪费', '官僚']
    elif 'creativity' in domain or 'art' in domain:
        base['vocabulary'] = ['创意', '表达', '美感', '灵感', '独特']
        base['forbiddenWords'] = ['平庸', '俗套', '复制']
    elif 'history' in domain:
        base['vocabulary'] = ['历史', '人物', '事件', '因果', '评价']
        base['forbiddenWords'] = ['偏见', '臆断', '脱离史实']
    elif 'medicine' in domain or 'chinese-medicine' in domain:
        base['vocabulary'] = ['辨证', '气血', '阴阳', '脏腑', '调理']
        base['forbiddenWords'] = ['脱离辨证', '机械套用']
    
    return base

def fill_expression_dna():
    with open('src/lib/personas.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = 0
    
    # Find all personas
    start_positions = [m.start() for m in re.finditer(r"PERSONAS\['", content)]
    
    for i, start_pos in enumerate(start_positions):
        end_pos = start_positions[i + 1] if i + 1 < len(start_positions) else len(content)
        section = content[start_pos:end_pos]
        
        id_match = re.search(r"PERSONAS\['([^\']+)'\]", section)
        if not id_match:
            continue
        persona_id = id_match.group(1)
        
        # Check if expressionDNA exists
        has_edna = 'expressionDNA:' in section
        
        if not has_edna:
            # Extract domains
            domain_match = re.search(r"domain:\s*\[[^\]]*\]", section)
            domains = []
            if domain_match:
                domains = re.findall(r"'([^']+)'", domain_match.group())
            
            # Generate default expressionDNA
            edna = get_default_expression_dna(persona_id, domains)
            
            # Build expressionDNA string
            edna_str = f"""  expressionDNA: {{
    sentenceStyle: {edna['sentenceStyle']},
    vocabulary: {edna['vocabulary']},
    forbiddenWords: {edna['forbiddenWords']},
    rhythm: '{edna['rhythm']}',
    humorStyle: '{edna['humorStyle']}',
    certaintyLevel: '{edna['certaintyLevel']}',
    rhetoricalHabit: '{edna['rhetoricalHabit']}',
    quotePatterns: {edna['quotePatterns']},
    chineseAdaptation: '{edna['chineseAdaptation']}',
    verbalMarkers: {edna['verbalMarkers']},
    speakingStyle: '{edna['speakingStyle']}',
  }},"""
            
            # Insert before sources:
            old_pos = start_pos + section.find("sources:")
            content = content[:old_pos] + edna_str + '\n  ' + content[old_pos:]
            modified += 1
            print(f"Added expressionDNA for {persona_id}")
            continue
        
        # Check for empty fields and fill them
        edna_start = section.find("expressionDNA:")
        edna_end = section.find("sources:", edna_start)
        if edna_end == -1:
            edna_end = len(section)
        edna_section = section[edna_start:edna_end]
        
        changes = []
        
        # Check each field
        if 'sentenceStyle: []' in edna_section:
            changes.append('sentenceStyle')
        if 'vocabulary: []' in edna_section:
            changes.append('vocabulary')
        if 'forbiddenWords: []' in edna_section:
            changes.append('forbiddenWords')
        if 'rhythm: \'\'' in edna_section or 'rhythm: ""' in edna_section:
            changes.append('rhythm')
        if 'humorStyle: \'\'' in edna_section or 'humorStyle: ""' in edna_section:
            changes.append('humorStyle')
        if 'rhetoricalHabit: \'\'' in edna_section or 'rhetoricalHabit: ""' in edna_section:
            changes.append('rhetoricalHabit')
        if 'quotePatterns: []' in edna_section:
            changes.append('quotePatterns')
        if 'chineseAdaptation: \'\'' in edna_section or 'chineseAdaptation: ""' in edna_section:
            changes.append('chineseAdaptation')
        if 'verbalMarkers: []' in edna_section:
            changes.append('verbalMarkers')
        
        if changes:
            print(f"{persona_id}: needs {len(changes)} fields filled: {changes}")
    
    # Write back
    with open('src/lib/personas.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nTotal modified: {modified} personas")

if __name__ == '__main__':
    fill_expression_dna()
