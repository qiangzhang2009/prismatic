#!/usr/bin/env python3
"""
Fix TypeScript errors for alan-turing, confucius, and einstein.
These personas have reasoningStyle/decisionFramework/lifePhilosophy/distillation
inserted OUTSIDE their closing brace. We need to move them INSIDE.
"""
import re

with open('src/lib/personas.ts', 'r') as f:
    lines = f.readlines()

def find_persona_block(lines, pid):
    """Find (start_line, end_line) for a persona. Returns (start, end) 0-indexed."""
    start = None
    for i, line in enumerate(lines):
        if f"PERSONAS['{pid}']" in line and '= {' in line:
            start = i
            break
    if start is None:
        return None, None
    depth = 0
    end = start
    for i in range(start, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if depth == 0 and i > start + 5:
            end = i
            break
    return start, end

# ============================================================
# Fix each persona
# ============================================================
targets = ['alan-turing', 'confucius', 'einstein']

for pid in targets:
    start, end = find_persona_block(lines, pid)
    if start is None:
        print(f"ERROR: Could not find {pid}")
        continue
    
    print(f"\n{pid}: lines {start+1}-{end+1}")
    print(f"  Line {end+1}: {repr(lines[end][:80])}")
    print(f"  Line {end+2}: {repr(lines[end+1][:80])}")
    print(f"  Line {end+3}: {repr(lines[end+2][:80])}")
    
    # Check if fields are outside the persona
    if end + 2 < len(lines) and 'reasoningStyle' in lines[end + 1]:
        print(f"  -> Confirmed: fields are outside the persona object")
        # Find the last line of the misplaced block
        misplaced_end = end + 1
        while misplaced_end + 1 < len(lines):
            if "PERSONAS['" in lines[misplaced_end + 1] and '= {' in lines[misplaced_end + 1]:
                break
            misplaced_end += 1
        
        print(f"  -> Misplaced block: lines {end+2}-{misplaced_end+1}")
        
        # Remove misplaced lines from their current position
        misplaced_lines = lines[end + 1:misplaced_end + 1]
        del lines[end + 1:misplaced_end + 1]
        
        # Re-find the closing brace position (it shifted)
        depth = 0
        new_end = start
        for i in range(start, len(lines)):
            depth += lines[i].count('{') - lines[i].count('}')
            if depth == 0 and i > start + 5:
                new_end = i
                break
        
        # Insert before the closing brace
        # Indent each line by 2 spaces to match persona field indentation
        indented = [re.sub(r'^  ', '    ', line) for line in misplaced_lines]
        # Remove trailing newline from last line if needed
        if indented and indented[-1].endswith('\n'):
            indented[-1] = indented[-1].rstrip('\n')
        # Add back newline
        indented = [line + '\n' for line in indented]
        
        lines.insert(new_end, ''.join(indented))
        print(f"  -> Fixed: inserted {len(indented)} lines before closing brace at line {new_end+1}")
    else:
        print(f"  -> Fields appear to be inside (or not found at expected position)")

with open('src/lib/personas.ts', 'w') as f:
    f.writelines(lines)

print("\nDone!")
