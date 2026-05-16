#!/usr/bin/env python3
"""
Fill in missing fields for all 87 personas.
Inserts new fields before the closing brace of each persona.
"""
import json
import re

with open('scripts/personas-data.json') as f:
    DATA = json.load(f)
with open('scripts/expressiondna-data.json') as f:
    EXPRESSIONDNA = json.load(f)
with open('scripts/sigwords-data.json') as f:
    SIGNATUREWORDS = json.load(f)

print(f"Loaded: {len(DATA)} personas, {len(EXPRESSIONDNA)} expressionDNA, {len(SIGNATUREWORDS)} signatureWords")

with open('src/lib/personas.ts') as f:
    lines = f.readlines()

def js_str(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

new_lines = []
i = 0
updated = 0

while i < len(lines):
    line = lines[i]
    m = re.search(r"PERSONAS\[(['\"])(.+?)\1", line)

    if m and '= {' in line:
        pid = m.group(2)
        depth = 1
        persona_start_i = len(new_lines)

        # Add persona start line
        new_lines.append(line)
        i += 1

        # Process persona body
        while i < len(lines):
            next_line = lines[i]
            new_lines.append(next_line)

            # Track depth
            for ch in next_line:
                if ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1

            # Check if we just closed the persona (depth becomes 0)
            if depth == 0:
                # Now insert new fields BEFORE this closing brace
                # The closing brace was just added as new_lines[-1]
                # Remove it, add insertions, then re-add closing brace
                new_lines.pop()  # remove '}\n'

                # Build insertions
                insertions = []
                if pid in DATA:
                    d = DATA[pid]

                    kq = ["  keyQuotes: ["]
                    for q in d.get('keyQuotes', []):
                        kq.append('    { quote: "' + js_str(q['quote']) + '", source: "' + js_str(q['source']) + '" },')
                    kq.append("  ],")
                    insertions.extend(kq)

                    insertions.append("  reasoningStyle: \"" + js_str(d.get('reasoningStyle', '')) + "\",")

                    insertions.append("  decisionFramework: [")
                    for df in d.get('decisionFramework', []):
                        insertions.append("    \"" + js_str(df) + "\",")
                    insertions.append("  ],")

                    lp = d.get('lifePhilosophy', '')
                    if isinstance(lp, dict):
                        insertions.append("  lifePhilosophy: {")
                        insertions.append("    core: \"" + js_str(lp.get('core', '')) + "\",")
                        insertions.append("    threeLevels: {")
                        insertions.append("      person: \"" + js_str(lp.get('threeLevels', {}).get('person', '')) + "\",")
                        insertions.append("      becoming: \"" + js_str(lp.get('threeLevels', {}).get('becoming', '')) + "\",")
                        insertions.append("      ultimate: \"" + js_str(lp.get('threeLevels', {}).get('ultimate', '')) + "\",")
                        insertions.append("    },")
                        insertions.append("  },")
                    else:
                        insertions.append("  lifePhilosophy: \"" + js_str(lp) + "\",")

                    dis = d.get('distillation', {})
                    insertions.append("  distillation: {")
                    insertions.append("    corpusTier: " + str(dis.get('corpusTier', 1)) + ",")
                    insertions.append("    wordFingerprint: [")
                    for wf in dis.get('wordFingerprint', []):
                        insertions.append("      \"" + js_str(wf) + "\",")
                    insertions.append("    ],")
                    insertions.append("    syntaxPattern: \"" + js_str(dis.get('syntaxPattern', '')) + "\",")
                    tt = dis.get('toneTrajectory', '')
                    if isinstance(tt, dict):
                        parts = ['"' + js_str(k) + '": "' + js_str(v) + '"' for k, v in tt.items()]
                        insertions.append("    toneTrajectory: {" + ", ".join(parts) + "},")
                    else:
                        insertions.append("    toneTrajectory: \"" + js_str(tt) + "\",")
                    insertions.append("    thinkingPace: " + str(dis.get('thinkingPace', 0.5)) + ",")
                    insertions.append("    voiceBoundary: [")
                    for vb in dis.get('voiceBoundary', []):
                        insertions.append("      \"" + js_str(vb) + "\",")
                    insertions.append("    ],")
                    insertions.append("  },")

                # expressionDNA
                if pid in EXPRESSIONDNA:
                    exp = EXPRESSIONDNA[pid]
                    insertions.append("  expressionDNA: {")
                    insertions.append("    sentenceStyle: [\"" + "\", \"".join(exp.get('sentenceStyle', [])) + "\"],")
                    insertions.append("    vocabulary: [\"" + "\", \"".join(exp.get('vocabulary', [])) + "\"],")
                    insertions.append("    forbiddenWords: [\"" + "\", \"".join(exp.get('forbiddenWords', [])) + "\"],")
                    insertions.append("    rhythm: \"" + js_str(exp.get('rhythm', '')) + "\",")
                    insertions.append("    humorStyle: \"" + js_str(exp.get('humorStyle', '')) + "\",")
                    insertions.append("    certaintyLevel: \"" + exp.get('certaintyLevel', 'medium') + "\",")
                    insertions.append("    rhetoricalHabit: \"" + js_str(exp.get('rhetoricalHabit', '')) + "\",")
                    insertions.append("    quotePatterns: [\"" + "\", \"".join(exp.get('quotePatterns', [])) + "\"],")
                    insertions.append("    chineseAdaptation: \"" + js_str(exp.get('chineseAdaptation', '')) + "\",")
                    insertions.append("  },")

                # signatureWords
                if pid in SIGNATUREWORDS:
                    sigs = SIGNATUREWORDS[pid]
                    insertions.append("  signatureWords: [")
                    for sg in sigs:
                        insertions.append('    { word: "' + js_str(sg.get('word', '')) + '", wordZh: "' + js_str(sg.get('wordZh', '')) + '", context: "' + js_str(sg.get('context', '')) + '", contextZh: "' + js_str(sg.get('contextZh', '')) + '", source: "' + js_str(sg.get('source', '')) + '" },')
                    insertions.append("  ],")

                if insertions:
                    for ins in insertions:
                        new_lines.append('  ' + ins + '\n')
                    print(f"Updated: {pid}")
                    updated += 1

                # Re-add closing brace
                new_lines.append(next_line)

                i += 1
                break
            i += 1
    else:
        new_lines.append(line)
        i += 1

with open('src/lib/personas.ts', 'w') as f:
    f.writelines(new_lines)

print(f"\nDone! {updated} personas updated")
