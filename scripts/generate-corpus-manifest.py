#!/usr/bin/env python3
"""
scripts/generate-corpus-manifest.py
为所有人物生成 corpus manifest，记录语料统计信息
"""
import json, os, time
from pathlib import Path

BASE = Path("/Users/john/蒸馏2/corpus")
MANIFEST_FILE = Path("/Users/john/蒸馏2/corpus/corpus-manifest.json")

def scan_persona(persona_id: str) -> dict:
    texts_dir = BASE / persona_id / "texts"
    if not texts_dir.exists():
        return None

    files = sorted([f for f in texts_dir.iterdir() if f.is_file() and f.suffix in (".txt", ".html", ".htm")])

    total_words = 0
    total_bytes = 0
    file_list = []

    for f in files:
        try:
            content = f.read_text(encoding='utf-8', errors='replace')
            wc = len(content.split())
            bz = f.stat().st_size
            total_words += wc
            total_bytes += bz
            file_list.append({
                "filename": f.name,
                "words": wc,
                "bytes": bz,
            })
        except:
            pass

    return {
        "personaId": persona_id,
        "files": len(file_list),
        "totalWords": total_words,
        "totalBytes": total_bytes,
        "sources": file_list,
    }

def main():
    all_personas = sorted([p.name for p in BASE.iterdir() if p.is_dir() and not p.name.startswith('.') and p.name != 'distilled' and p.name != 'wittgenstain'])

    manifest = []
    for pid in all_personas:
        result = scan_persona(pid)
        if result:
            manifest.append(result)

    # Add metadata
    full_manifest = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "totalPersonas": len(manifest),
        "totalWords": sum(m["totalWords"] for m in manifest),
        "totalBytes": sum(m["totalBytes"] for m in manifest),
        "personas": manifest,
    }

    MANIFEST_FILE.write_text(json.dumps(full_manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f"Manifest written: {len(manifest)} personas, {sum(m['totalWords'] for m in manifest):,} total words")

    # Print summary table
    print(f"\n{'Persona':<35} {'Files':>5} {'Words':>10}")
    print("-" * 55)
    for m in sorted(manifest, key=lambda x: x["totalWords"], reverse=True):
        print(f"  {m['personaId']:<33} {m['files']:>3}  {m['totalWords']:>9,} words")

if __name__ == "__main__":
    main()
