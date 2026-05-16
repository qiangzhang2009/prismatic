#!/usr/bin/env python3
import re

with open('src/lib/personas.ts', 'r') as f:
    lines = f.readlines()

changes = 0

# ============================================================
# Fix 1: alan-turing (lines 5426-5470)
# identityPrompt ends at 5426, } at 5427, new fields at 5429-5470
# ============================================================
# Find alan-turing identityPrompt line
alan_id_line = None
alan_close_line = None
for i, line in enumerate(lines):
    if "PERSONAS['alan-turing']" in line and '=' in line:
        # find identityPrompt in next 20 lines
        for j in range(i+1, min(i+30, len(lines))):
            if "identityPrompt:" in lines[j]:
                alan_id_line = j
                # find closing } after identityPrompt
                for k in range(j+1, min(j+50, len(lines))):
                    if lines[k].strip() == '};' and lines[k-1].strip() == '}':
                        alan_close_line = k
                        break
                    if lines[k].strip() == '},' and lines[k-1].strip() == '  },':
                        alan_close_line = k
                        break
                break
        break

if alan_id_line and alan_close_line:
    # The new fields to insert are between alan_close_line+1 and the next PERSONAS
    # We need to remove them from their current position and insert before the close
    # Find where alan-turing block ends (next PERSONAS[)
    alan_block_end = None
    for i in range(alan_close_line+1, len(lines)):
        if "PERSONAS['" in lines[i] and '=' in lines[i]:
            alan_block_end = i
            break
    
    # The content between alan_close_line+1 and alan_block_end is the misplaced fields
    misplaced = ''.join(lines[alan_close_line+1:alan_block_end])
    
    # Build new content: insert misplaced before closing }, keep the } and clean up
    new_lines = lines[:alan_close_line+1]  # everything up to and including the closing }
    # Actually we want to INSERT before the close, so find the "}, " or "};" line
    # The line at alan_close_line is "},\n" (the close of distillation)
    # And the line before it is "  },\n" (end of distillation object)
    # So the actual persona close is one more line
    
    # Let me re-examine: at line 5427 we have "}\n" (after identityPrompt)
    # But the distillation block ends at 5470 with "  },\n"
    # So we need to find the REAL persona close
    # Actually, let me look more carefully at the structure
    print(f"alan: id_line={alan_id_line+1}, close_line={alan_close_line+1}, block_end={alan_block_end+1}")
    print(f"  lines[{alan_close_line}] = {repr(lines[alan_close_line])}")
    print(f"  lines[{alan_close_line-1}] = {repr(lines[alan_close_line-1])}")
    print(f"  lines[{alan_close_line-2}] = {repr(lines[alan_close_line-2])}")
else:
    print("Could not find alan-turing identityPrompt")
    alan_block_end = None

# ============================================================
# Fix 2: confucius (lines 6482-6535)
# ============================================================
conf_id_line = None
conf_close_line = None
for i, line in enumerate(lines):
    if "PERSONAS['confucius']" in line and '=' in line:
        for j in range(i+1, min(i+30, len(lines))):
            if "identityPrompt:" in lines[j]:
                conf_id_line = j
                for k in range(j+1, min(j+100, len(lines))):
                    if lines[k].strip() == '}' and k > j:
                        conf_close_line = k
                        break
                break
        break

if conf_id_line and conf_close_line:
    conf_block_end = None
    for i in range(conf_close_line+1, len(lines)):
        if "PERSONAS['" in lines[i] and '=' in lines[i]:
            conf_block_end = i
            break
    print(f"confucius: id_line={conf_id_line+1}, close_line={conf_close_line+1}, block_end={conf_block_end+1}")
    print(f"  lines[{conf_close_line}] = {repr(lines[conf_close_line])}")
    print(f"  lines[{conf_close_line+1}] = {repr(lines[conf_close_line+1])}")
else:
    print("Could not find confucius")
    conf_block_end = None

# ============================================================
# Fix 3: einstein (lines 6722-6759)
# ============================================================
ein_id_line = None
ein_close_line = None
for i, line in enumerate(lines):
    if "PERSONAS['einstein']" in line and '=' in line:
        for j in range(i+1, min(i+30, len(lines))):
            if "identityPrompt:" in lines[j]:
                ein_id_line = j
                for k in range(j+1, min(j+100, len(lines))):
                    if lines[k].strip() == '}' and k > j:
                        ein_close_line = k
                        break
                break
        break

if ein_id_line and ein_close_line:
    ein_block_end = None
    for i in range(ein_close_line+1, len(lines)):
        if "PERSONAS['" in lines[i] and '=' in lines[i]:
            ein_block_end = i
            break
    print(f"einstein: id_line={ein_id_line+1}, close_line={ein_close_line+1}, block_end={ein_block_end+1}")
    print(f"  lines[{ein_close_line}] = {repr(lines[ein_close_line])}")
    print(f"  lines[{ein_close_line+1}] = {repr(lines[ein_close_line+1])}")
else:
    print("Could not find einstein")
    ein_block_end = None

print("\nDone scanning. No changes made yet.")
