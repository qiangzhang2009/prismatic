#!/usr/bin/env python3
"""
scripts/corpus/ni-haixia-inventory.py
盘点倪海厦外部硬盘中的所有文本文件（PDF/DOCX/DOC/TXT/MD/EPUB/MOBI/AZW3）。
使用超时保护，避免 exFAT 慢速目录卡住。
"""
import os
import json
import stat
from datetime import datetime

# 源目录
SRC = "/Volumes/WD-4T-1/disk2-4t-1-2/倪海厦"
OUT = "scripts/corpus/ni-haixia-inventory.json"

EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".epub", ".mobi", ".azw3"}

results = []
skipped = []
total_size = 0

def safe_walk(root, timeout_sec=5):
    """os.walk with per-entry timeout fallback."""
    import signal

    class TimeoutError(Exception):
        pass

    def handler(signum, frame):
        raise TimeoutError(f"Timeout after {timeout_sec}s on {root}")

    prev_handler = signal.signal(signal.SIGALRM, handler)

    try:
        for item in os.scandir(root):
            signal.alarm(timeout_sec)
            try:
                if item.is_dir(follow_symlinks=False):
                    yield from safe_walk(item.path, timeout_sec)
                elif item.is_file(follow_symlinks=False):
                    yield item
            except (OSError, PermissionError):
                skipped.append(str(item.path))
            finally:
                signal.alarm(0)
    except TimeoutError as e:
        skipped.append(f"TIMEOUT: {root} — {e}")
    finally:
        signal.signal(signal.SIGALRM, prev_handler)

print(f"[{datetime.now().isoformat()}] Starting inventory of: {SRC}")
print("Scanning... (exFAT disk, this may take a while)")

try:
    for i, entry in enumerate(safe_walk(SRC)):
        ext = os.path.splitext(entry.name)[1].lower()
        if ext in EXTENSIONS:
            try:
                size = entry.stat().st_size
                total_size += size
                results.append({
                    "path": entry.path,
                    "name": entry.name,
                    "ext": ext,
                    "size_bytes": size,
                    "size_mb": round(size / 1024 / 1024, 2),
                })
            except OSError:
                pass

        if (i + 1) % 500 == 0:
            print(f"  ... scanned {i + 1} items, found {len(results)} text files")

    # Summary
    by_ext = {}
    for r in results:
        by_ext.setdefault(r["ext"], []).append(r)

    summary = {
        "scan_time": datetime.now().isoformat(),
        "source_dir": SRC,
        "total_items_found": len(results),
        "total_size_mb": round(total_size / 1024 / 1024, 2),
        "by_extension": {},
        "files": results,
        "skipped": skipped[:100],
    }

    for ext, files in sorted(by_ext.items()):
        ext_size = sum(f["size_bytes"] for f in files)
        summary["by_extension"][ext] = {
            "count": len(files),
            "total_mb": round(ext_size / 1024 / 1024, 2),
        }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Done! Found {len(results)} text files ({summary['total_size_mb']} MB)")
    for ext, info in summary["by_extension"].items():
        print(f"   {ext}: {info['count']} files, {info['total_mb']} MB")
    print(f"\nOutput: {OUT}")
    if skipped:
        print(f"⚠️  {len(skipped)} items skipped (timeouts/permissions)")
        for s in skipped[:5]:
            print(f"   {s}")

except KeyboardInterrupt:
    print("\n⚠️ Interrupted by user")
    print(f"Partial results saved to: {OUT}")
