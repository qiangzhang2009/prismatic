#!/usr/bin/env python3
"""
scripts/corpus/ni-haixia-inventory.py
盘点倪海厦外部硬盘中的所有文本文件（PDF/DOCX/DOC/TXT/MD/EPUB/MOBI/AZW3）。
使用超时保护，避免 exFAT 慢速目录卡住。
"""
import os
import json
import signal
from datetime import datetime

SRC = "/Volumes/WD-4T-1/disk2-4t-1-2/倪海厦"
OUT = "scripts/corpus/ni-haixia-inventory.json"

EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".md", ".epub", ".mobi", ".azw3"}

results = []
skipped = []
total_size = 0
scan_count = 0

# Per-entry timeout (seconds)
TIMEOUT = 15


def with_timeout(func, default=None):
    """Run a function with alarm-based timeout."""
    def wrapper(*args, **kwargs):
        def handler(signum, frame):
            raise TimeoutError()

        old = signal.signal(signal.SIGALRM, handler)
        signal.alarm(TIMEOUT)
        try:
            return func(*args, **kwargs)
        except TimeoutError:
            return default
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old)
    return wrapper


def safe_scandir(path):
    """Scandir with timeout."""
    try:
        return os.scandir(path)
    except (OSError, PermissionError):
        return None


def safe_stat(entry):
    """Stat with timeout."""
    try:
        return entry.stat()
    except (OSError, TimeoutError, PermissionError):
        return None


def walk_tree(root):
    """Walk tree with per-entry timeout."""
    global scan_count

    scandir = with_timeout(os.scandir, None)(root)
    if scandir is None:
        skipped.append(f"scandir_fail: {root}")
        return

    try:
        for entry in scandir:
            scan_count += 1
            if scan_count % 200 == 0:
                print(f"  ... scanned {scan_count} items, found {len(results)} text files", flush=True)

            st = with_timeout(safe_stat, None)(entry)
            if st is None:
                skipped.append(f"stat_fail: {entry.path}")
                continue

            ext = os.path.splitext(entry.name)[1].lower()
            if ext in EXTENSIONS:
                try:
                    total_size += st.st_size
                    results.append({
                        "path": entry.path,
                        "name": entry.name,
                        "ext": ext,
                        "size_bytes": st.st_size,
                        "size_mb": round(st.st_size / 1024 / 1024, 2),
                    })
                except Exception:
                    pass
            elif os.path.isdir(entry.path) if False else (st.st_mode & 0o170000) == 0o040000:
                # It's a directory — recurse
                walk_tree(entry.path)
    except (TimeoutError, OSError) as e:
        skipped.append(f"walk_timeout: {root}")
    finally:
        try:
            scandir.close()
        except Exception:
            pass


def is_dir(entry, st):
    """Check if entry is a directory."""
    import stat
    return stat.S_ISDIR(st.st_mode)


print(f"[{datetime.now().isoformat()}] Starting inventory of: {SRC}")
print("Scanning... (exFAT disk, this may take a while)")

try:
    walk_tree(SRC)

    by_ext = {}
    for r in results:
        by_ext.setdefault(r["ext"], []).append(r)

    summary = {
        "scan_time": datetime.now().isoformat(),
        "source_dir": SRC,
        "total_items_scanned": scan_count,
        "total_files_found": len(results),
        "total_size_mb": round(total_size / 1024 / 1024, 2),
        "by_extension": {},
        "files": results,
        "skipped": skipped[:200],
    }

    for ext, files in sorted(by_ext.items()):
        ext_size = sum(f["size_bytes"] for f in files)
        summary["by_extension"][ext] = {
            "count": len(files),
            "total_mb": round(ext_size / 1024 / 1024, 2),
            "sample": [f["path"] for f in files[:5]],
        }

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Scanned {scan_count} items, found {len(results)} text files ({summary['total_size_mb']} MB)")
    for ext, info in summary["by_extension"].items():
        print(f"   {ext}: {info['count']} files, {info['total_mb']} MB")
    print(f"\nOutput: {OUT}")
    if skipped:
        print(f"Skipped: {len(skipped)}")
        for s in skipped[:10]:
            print(f"   {s}")

except KeyboardInterrupt:
    print("\nInterrupted by user")
    if results:
        with open(OUT, "w", encoding="utf-8") as f:
            json.dump({"partial": True, "files": results, "skipped": skipped[:100]}, f, ensure_ascii=False, indent=2)
        print(f"Partial results saved to: {OUT}")
