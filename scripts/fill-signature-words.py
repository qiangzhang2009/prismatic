#!/usr/bin/env python3
"""Fill signatureWords for all personas based on their mentalModels."""

import re

def fill_signature_words():
    with open('src/lib/personas.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    modified = 0
    
    # Find all personas by finding PERSONAS[ entries
    start_positions = [m.start() for m in re.finditer(r"PERSONAS\['", content)]
    
    for i, start_pos in enumerate(start_positions):
        # Find end position (next PERSONAS[ or end of file)
        end_pos = start_positions[i + 1] if i + 1 < len(start_positions) else len(content)
        
        # Extract this persona's section
        full_section = content[start_pos:end_pos]
        
        # Find persona ID
        id_match = re.search(r"PERSONAS\['([^\']+)'\]", full_section)
        if not id_match:
            continue
        persona_id = id_match.group(1)
        
        # Check if signatureWords is empty
        if 'signatureWords: []' not in full_section:
            continue
        
        # Extract mental model names from nameZh
        mm_start = full_section.find("mentalModels: [")
        if mm_start == -1:
            continue
        
        # Find end of mentalModels
        mm_section = full_section[mm_start:]
        mm_end = mm_section.find("decisionHeuristics:")
        if mm_end == -1:
            mm_end = mm_section.find("expressionDNA:")
        if mm_end == -1:
            continue
        
        mm_section = mm_section[len("mentalModels: ["):mm_end]
        
        # Extract nameZh - handles both single and double quote formats
        names_zh = re.findall(r"""nameZh:\s*['"]([^'"]+)['"]""", mm_section)
        
        if not names_zh:
            continue
        
        # Build signatureWords content
        words = []
        for name_zh in names_zh[:8]:  # Max 8
            name_zh_escaped = name_zh.replace("'", "\\'")
            words.append(f"{{ word: '{name_zh_escaped}', wordZh: '{name_zh_escaped}' }}")
        
        new_sig = "signatureWords: [\n      " + ",\n      ".join(words) + "\n    ],"
        old_sig = "signatureWords: [],"
        
        # Replace in the original content
        old_pos = start_pos + full_section.find(old_sig)
        content = content[:old_pos] + new_sig + content[old_pos + len(old_sig):]
        modified += 1
        print(f"Updated {persona_id}: {len(names_zh)} words")
    
    # Write back
    with open('src/lib/personas.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nTotal modified: {modified} personas")

if __name__ == '__main__':
    fill_signature_words()
