#!/usr/bin/env python3
"""Add expressionDNA to TCM personas that are missing it."""

import re

# Default expressionDNA for Chinese medicine practitioners
TCM_EXPRESSION_DNA = '''  expressionDNA: {
    sentenceStyle: [
      "善用「辨证论治」的逻辑框架，先述病因病机，再论治法方药",
      "常引用《黄帝内经》《伤寒论》等经典原文作为论据",
      "偏好使用「……者，……也」的判断句式，如「脾胃为后天之本」"
    ],
    vocabulary: ["辨证", "气血", "阴阳", "五行", "脏腑", "经络", "表里", "寒热", "虚实", "方药", "配伍", "君臣佐使"],
    forbiddenWords: ["脱离辨证", "机械套用", "千人一方"],
    rhythm: "语言沉稳典雅，引经据典，论述条分缕析，偏好使用四字格成语如「审因辨证」「对证下药」。",
    humorStyle: "极少幽默，以严肃的说教为主，强调医学的严谨性和医者的责任感。",
    certaintyLevel: "high",
    rhetoricalHabit: "善用经典引文支撑论点，强调「有是证用是方」的辨证精神。",
    quotePatterns: ["引用《黄帝内经》原文", "引用《伤寒论》条文", "引用金元四大家医论"],
    chineseAdaptation: "保持中医传统的典雅文风，多用四字格和专业术语，如「审因辨证」「对证下药」「君臣佐使」。",
    verbalMarkers: ["辨证论治", "对证下药", "谨守病机"],
    speakingStyle: "表达沉稳厚重，引经据典，论述条理清晰。善用中医经典理论解释病理，用「辨证论治」的框架分析病情，语调笃定自信，体现中医传统的学术严谨性。",
  },
'''

def add_expression_dna():
    with open('src/lib/personas.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = 0
    personas_to_fix = [
        'liduomin', 'liudunhou', 'zhadanxin', 'zhudanhsi', 'zhangjingyue',
        'wujutong', 'wangqingren', 'yetianshi', 'bianque', 'hippocrates',
        'caraka', 'sushruta', 'wangshuhen', 'xueshengbai', 'zhangxichun',
        'tangzonghai', 'caoyingfu'
    ]
    
    for persona_id in personas_to_fix:
        # Find the persona
        pattern = rf"PERSONAS\['{persona_id}'\]"
        match = re.search(pattern, content)
        if not match:
            print(f"Persona '{persona_id}' not found")
            continue
        
        pos = match.start()
        
        # Find identityPrompt: end and then find the closing };
        identity_end = content.find("identityPrompt:", pos)
        if identity_end == -1:
            print(f"Could not find identityPrompt for '{persona_id}'")
            continue
        
        # Find the end of identityPrompt value (look for the closing ')
        # The value ends with ','
        identity_end = content.find("',", identity_end)
        if identity_end == -1:
            # Try "
            identity_end = content.find("',", identity_end)
        
        # Skip past };
        # Find the closing of the object
        insert_pos = content.find("};", identity_end)
        if insert_pos == -1:
            print(f"Could not find end of '{persona_id}'")
            continue
        
        # Insert before the closing };
        content = content[:insert_pos] + TCM_EXPRESSION_DNA + content[insert_pos:]
        modified += 1
        print(f"Added expressionDNA to {persona_id}")
    
    # Write back
    with open('src/lib/personas.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nTotal modified: {modified} personas")

if __name__ == '__main__':
    add_expression_dna()
