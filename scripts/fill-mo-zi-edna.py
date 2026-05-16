#!/usr/bin/env python3
"""Fill empty expressionDNA fields for all personas."""

import re

# Templates for different types of personas
MOZI_EDNA = {
    'sentenceStyle': [
        '使用反问和排比句增强论证气势，如"圣人以治天下为事者，必知乱之所自起"',
        '善用比喻和具体事例论证抽象道理，如以医攻疾喻治国',
        '偏好"兼相爱，交相利"的对称句式，强调互利共赢'
    ],
    'vocabulary': ['兼爱', '非攻', '尚贤', '节用', '天志', '明鬼', '功利', '交利'],
    'forbiddenWords': ['浪费', '奢侈', '等级', '差别'],
    'rhythm': '语言质朴有力，善用排比和对偶增强气势，论证逻辑严密，以实用为导向。',
    'humorStyle': '极少幽默，以严肃说教为主，强调道德使命感。',
    'rhetoricalHabit': '善用反问和排比增强论证力度，通过"兼相爱，交相利"等核心命题贯穿全文。',
    'quotePatterns': ['引用古代圣王事迹，如尧舜禹汤', '引用日常事例，如医攻人疾'],
    'chineseAdaptation': '保持原文的质朴风格，使用"兼相爱，交相利"等核心概念，避免过度文学化。',
    'verbalMarkers': ['兼相爱，交相利', '兴天下之利，除天下之害', '法天而行'],
    'speakingStyle': '墨子的语言风格激昂坚定，以反问和排比强化论证，大量引用历史事例和经典，逻辑严密，具有强烈的道德感召力。'
}

def fill_empty_fields():
    with open('src/lib/personas.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = 0
    
    # Handle mo-zi specifically
    mozi_start = content.find("PERSONAS['mo-zi']")
    if mozi_start != -1:
        mozi_end = content.find("PERSONAS['naval-ravikant']", mozi_start)
        mozi_section = content[mozi_start:mozi_end]
        
        if 'sentenceStyle: []' in mozi_section:
            mozi_section = mozi_section.replace(
                'sentenceStyle: [],',
                f"sentenceStyle: {MOZI_EDNA['sentenceStyle']},"
            )
        if 'vocabulary: []' in mozi_section:
            mozi_section = mozi_section.replace(
                'vocabulary: [],',
                f"vocabulary: {MOZI_EDNA['vocabulary']},"
            )
        if 'forbiddenWords: []' in mozi_section:
            mozi_section = mozi_section.replace(
                'forbiddenWords: [],',
                f"forbiddenWords: {MOZI_EDNA['forbiddenWords']},"
            )
        if "rhythm: ''" in mozi_section:
            mozi_section = mozi_section.replace(
                "rhythm: '',",
                f"rhythm: '{MOZI_EDNA['rhythm']}',"
            )
        if "humorStyle: ''" in mozi_section:
            mozi_section = mozi_section.replace(
                "humorStyle: '',",
                f"humorStyle: '{MOZI_EDNA['humorStyle']}',"
            )
        if "rhetoricalHabit: ''" in mozi_section:
            mozi_section = mozi_section.replace(
                "rhetoricalHabit: '',",
                f"rhetoricalHabit: '{MOZI_EDNA['rhetoricalHabit']}',"
            )
        if 'quotePatterns: []' in mozi_section:
            mozi_section = mozi_section.replace(
                'quotePatterns: [],',
                f"quotePatterns: {MOZI_EDNA['quotePatterns']},"
            )
        if "chineseAdaptation: ''" in mozi_section:
            mozi_section = mozi_section.replace(
                "chineseAdaptation: '',",
                f"chineseAdaptation: '{MOZI_EDNA['chineseAdaptation']}',"
            )
        if 'verbalMarkers: []' in mozi_section:
            mozi_section = mozi_section.replace(
                'verbalMarkers: [],',
                f"verbalMarkers: {MOZI_EDNA['verbalMarkers']},"
            )
        
        content = content[:mozi_start] + mozi_section + content[mozi_end:]
        modified += 1
        print("Updated mo-zi expressionDNA fields")
    
    # Write back
    with open('src/lib/personas.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Total modified: {modified}")

if __name__ == '__main__':
    fill_empty_fields()
