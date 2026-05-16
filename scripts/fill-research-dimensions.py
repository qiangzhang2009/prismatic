#!/usr/bin/env python3
"""Fill researchDimensions for all personas based on their domain and mentalModels."""

import re

# Common research dimension templates
DIMENSION_TEMPLATES = {
    'philosophy': [
        {'dimension': 'thinking', 'dimensionZh': '思维方式', 'focus': ['核心认知模式', '推理路径', '决策风格']},
        {'dimension': 'values', 'dimensionZh': '价值观', 'focus': ['核心价值', '价值优先级', '价值冲突处理']},
        {'dimension': 'ethics', 'dimensionZh': '伦理学', 'focus': ['道德判断', '价值取舍', '行动准则']},
    ],
    'technology': [
        {'dimension': 'innovation', 'dimensionZh': '创新', 'focus': ['技术突破', '产品设计', '用户体验']},
        {'dimension': 'engineering', 'dimensionZh': '工程', 'focus': ['系统架构', '技术选型', '实现路径']},
    ],
    'business': [
        {'dimension': 'strategy', 'dimensionZh': '战略', 'focus': ['商业模式', '竞争优势', '长期规划']},
        {'dimension': 'leadership', 'dimensionZh': '领导力', 'focus': ['团队管理', '决策风格', '组织文化']},
    ],
    'investment': [
        {'dimension': 'value', 'dimensionZh': '价值投资', 'focus': ['估值方法', '风险评估', '持有周期']},
        {'dimension': 'psychology', 'dimensionZh': '心理', 'focus': ['市场情绪', '逆向思维', '认知偏见']},
    ],
    'science': [
        {'dimension': 'method', 'dimensionZh': '方法论', 'focus': ['实验设计', '证据评估', '理论建构']},
        {'dimension': 'curiosity', 'dimensionZh': '好奇心', 'focus': ['问题发现', '假设生成', '验证方法']},
    ],
    'creativity': [
        {'dimension': 'inspiration', 'dimensionZh': '灵感', 'focus': ['创意来源', '美学标准', '表现形式']},
        {'dimension': 'craft', 'dimensionZh': '技艺', 'focus': ['技巧打磨', '风格形成', '作品完成']},
    ],
    'history': [
        {'dimension': 'analysis', 'dimensionZh': '分析', 'focus': ['史料解读', '因果分析', '评价标准']},
        {'dimension': 'narrative', 'dimensionZh': '叙事', 'focus': ['叙述结构', '人物塑造', '价值导向']},
    ],
    'strategy': [
        {'dimension': 'analysis', 'dimensionZh': '分析', 'focus': ['形势研判', '力量对比', '趋势把握']},
        {'dimension': 'execution', 'dimensionZh': '执行', 'focus': ['资源配置', '时机把握', '灵活应变']},
    ],
    'leadership': [
        {'dimension': 'influence', 'dimensionZh': '影响力', 'focus': ['愿景传递', '团队凝聚', '危机处理']},
        {'dimension': 'character', 'dimensionZh': '品格', 'focus': ['道德榜样', '决策原则', '担当精神']},
    ],
    'default': [
        {'dimension': 'thinking', 'dimensionZh': '思维方式', 'focus': ['核心认知模式', '推理路径', '决策风格']},
        {'dimension': 'values', 'dimensionZh': '价值观', 'focus': ['核心价值', '价值优先级', '价值冲突处理']},
    ],
}

def get_dimensions_for_domain(domains):
    """Get research dimensions based on domains."""
    dimensions = []
    seen = set()
    
    for domain in domains:
        # Map domain to template
        if domain in DIMENSION_TEMPLATES:
            for dim in DIMENSION_TEMPLATES[domain]:
                if dim['dimension'] not in seen:
                    dimensions.append(dim)
                    seen.add(dim['dimension'])
        # Try partial match
        for key in DIMENSION_TEMPLATES:
            if key in domain or domain in key:
                for dim in DIMENSION_TEMPLATES[key]:
                    if dim['dimension'] not in seen:
                        dimensions.append(dim)
                        seen.add(dim['dimension'])
    
    # Ensure we have at least some dimensions
    if not dimensions:
        dimensions = DIMENSION_TEMPLATES['default'].copy()
    
    return dimensions[:3]  # Limit to 3 dimensions

def fill_research_dimensions():
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
        
        # Check if researchDimensions is empty
        if 'researchDimensions: []' not in section:
            continue
        
        # Extract domains
        domain_match = re.search(r"domain:\s*\[[^\]]*\]", section)
        domains = []
        if domain_match:
            domains = re.findall(r"'([^']+)'", domain_match.group())
        
        # Get dimensions for these domains
        dimensions = get_dimensions_for_domain(domains)
        
        # Build researchDimensions content
        dims_str = '\n    '
        dims_str += ',\n    '.join([
            f"{{ dimension: '{d['dimension']}', dimensionZh: '{d['dimensionZh']}', focus: {d['focus']} }}"
            for d in dimensions
        ])
        dims_str += '\n  '
        
        new_rd = f"researchDimensions: [{dims_str}],"
        old_rd = "researchDimensions: [],"
        
        # Replace
        old_pos = start_pos + section.find(old_rd)
        content = content[:old_pos] + new_rd + content[old_pos + len(old_rd):]
        modified += 1
        print(f"Updated {persona_id}: {[d['dimensionZh'] for d in dimensions]}")
    
    # Write back
    with open('src/lib/personas.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nTotal modified: {modified} personas")

if __name__ == '__main__':
    fill_research_dimensions()
