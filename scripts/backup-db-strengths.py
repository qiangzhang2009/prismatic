#!/usr/bin/env python3
"""
Backup DB strengths/blindspots for all personas.
Saves to data/db-strengths-blindspots-backup.json
"""
import json
import urllib.request
import time

def fetch(url, timeout=15):
    try:
        req = urllib.request.Request(url, headers={'Accept': 'application/json', 'User-Agent': 'python/3'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  ERROR {url}: {e}")
        return None

# Get all slugs
print("Fetching persona list...")
data = fetch("https://prismatic.zxqconsulting.com/api/persona-library")
if not data:
    print("Failed to fetch persona list")
    exit(1)

slugs = [p['slug'] for p in data.get('items', [])]
print(f"Found {len(slugs)} personas")

# Fetch each persona's strengths/blindspots
backup = {}
for i, slug in enumerate(sorted(slugs)):
    url = f"https://prismatic.zxqconsulting.com/api/persona-library/{slug}"
    result = fetch(url)
    if result and 'persona' in result:
        p = result['persona']
        backup[slug] = {
            'name': p.get('name', ''),
            'distillVersion': p.get('distillVersion', ''),
            'strengths': p.get('strengths', []),
            'blindspots': p.get('blindspots', []),
        }
        print(f"  [{i+1}/{len(slugs)}] {slug}: {len(p.get('strengths', []))} strengths, {len(p.get('blindspots', []))} blindspots")
    else:
        print(f"  [{i+1}/{len(slugs)}] {slug}: FAILED")
    time.sleep(0.3)  # be nice to the server

# Save
with open('data/db-strengths-blindspots-backup.json', 'w', encoding='utf-8') as f:
    json.dump(backup, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(backup)} records to data/db-strengths-blindspots-backup.json")

# Summary stats
eng_only_strengths = {}
eng_only_blindspots = {}
for slug, data in backup.items():
    for s in data.get('strengths', []):
        if isinstance(s, dict):
            textZh = s.get('textZh', '')
            text = s.get('text', '')
            # Check if textZh is English (no Chinese chars)
            import re
            has_zh = bool(re.search(r'[\u4e00-\u9fff]', textZh))
            if not has_zh and textZh:
                eng_only_strengths.setdefault(slug, []).append(textZh)
    for b in data.get('blindspots', []):
        if isinstance(b, dict):
            textZh = b.get('textZh', '')
            text = b.get('text', '')
            import re
            has_zh = bool(re.search(r'[\u4e00-\u9fff]', textZh))
            if not has_zh and textZh:
                eng_only_blindspots.setdefault(slug, []).append(textZh)

print(f"\n=== English-only textZh (no Chinese) ===")
print(f"Strengths: {len(eng_only_strengths)} personas affected")
for slug, items in sorted(eng_only_strengths.items()):
    print(f"  {slug}: {items[:3]}")
print(f"\nBlindspots: {len(eng_only_blindspots)} personas affected")
for slug, items in sorted(eng_only_blindspots.items()):
    print(f"  {slug}: {items[:3]}")
