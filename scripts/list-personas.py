#!/usr/bin/env python3
import re

with open('src/lib/personas.ts') as f:
    lines = f.readlines()

personas = []
for i, line in enumerate(lines):
    if "PERSONAS['" in line and '= {' in line:
        m = re.search(r"PERSONAS\[(['\"])(.+?)\1", line)
        if m:
            personas.append(m.group(2))

print('All 87 persona IDs:')
for i, p in enumerate(personas):
    print(f'{i+1:3d}. {p}')
