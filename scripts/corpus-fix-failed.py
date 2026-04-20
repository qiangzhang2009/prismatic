#!/usr/bin/env python3
"""
Fix failed corpus downloads with corrected/alternative sources.
"""
import os, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE = Path("/Users/john/蒸馏2/corpus")

# Corrected sources
FIXES = {
    # Lao Zi - wrong ID
    ("lao-zi", "tao-te-ching-waley.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/21712/pg21712-h.htm",
        "title": "Tao Teh King (Gutenberg 21712)"
    },
    ("lao-zi", "daodejing-ctext.html"): {
        "url": "https://ctext.org/taoteching",
        "title": "道德经原文 (CText)"
    },

    # Kant - wrong ID
    ("kant", "metaphysical-elements-ethics.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/5684/pg5684-h.htm",
        "title": "Metaphysical Elements of Ethics"
    },
    ("kant", "critique-practical-reason.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/5283/pg5283-h.htm",
        "title": "Critique of Practical Reason"
    },

    # Mencius - needs .txt version
    ("mencius", "mengzi-legge.txt"): {
        "url": "https://www.gutenberg.org/files/2304/2304-0.txt",
        "title": "Mencius (Legge translation)"
    },

    # Seneca - missing txt
    ("seneca", "seneca-on-anger.txt"): {
        "url": "https://www.gutenberg.org/files/29444/29444-0.txt",
        "title": "On Anger (Seneca)"
    },

    # Keynes General Theory
    ("john-maynard-keynes", "general-theory.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/20069/pg20069-h.htm",
        "title": "The General Theory"
    },

    # Einstein - need correct IDs
    ("einstein", "relativity.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/30115/pg30115-h.htm",
        "title": "Relativity (Gutenberg 30115)"
    },
    ("einstein", "cosmic-religion.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/8482/pg8482-h.htm",
        "title": "Einstein on Cosmic Religion"
    },

    # Alan Turing
    ("alan-turing", "computing-machinery-intelligence.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/58311/pg58311-h.zip",
        "title": "Turing Mind 1950"
    },

    # Han Feizi
    ("han-fei-zi", "hanfeizi-selected.txt"): {
        "url": "https://www.gutenberg.org/cache/epub/20763/pg20763-h.htm",
        "title": "Han Feizi Selected"
    },

    # Alan Watts - need different archive.org URL
    ("alan-watts", "way-of-zen.txt"): {
        "url": "https://archive.org/download/wayofzen0000watt/wayofzen0000watt_text.txt",
        "title": "The Way of Zen"
    },

    # Donald Trump - Art of Deal
    ("donald-trump", "art-of-the-deal.html"): {
        "url": "https://archive.org/download/artofdeal00trump/artofdeal00trump_text.txt",
        "title": "The Art of the Deal"
    },

    # Osamu Dazai
    ("osamu-dazai", "no-longer-human.txt"): {
        "url": "https://archive.org/download/no-longer-human-dazai-osamu/no-longer-human-dazai-osamu_text.txt",
        "title": "No Longer Human"
    },
    ("osamu-dazai", "setting-sun.txt"): {
        "url": "https://archive.org/download/setting00daza/setting00daza_text.txt",
        "title": "Setting Sun"
    },

    # John Dee
    ("john-dee", "monas-hieroglyphica.txt"): {
        "url": "https://www.sacred-texts.com/oto/monashieroglyphica.htm",
        "title": "Monas Hieroglyphica"
    },

    # Lin Yutang
    ("lin-yutang", "my-country-my-people.txt"): {
        "url": "https://archive.org/download/mycountrymypeopl0000liny/mycountrymypeopl0000liny_text.txt",
        "title": "My Country and My People"
    },
}

def fetch_url(url: str, dest: Path) -> dict:
    try:
        req = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(req, timeout=20) as resp:
            content = resp.read()
            # Handle zip files
            if url.endswith('.zip'):
                import zipfile, io
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    html_files = [n for n in z.namelist() if n.endswith('.htm')]
                    if html_files:
                        content = z.read(html_files[0])
            encoding = 'utf-8'
            if content[:3] == b'\xef\xbb\xbf':
                content = content[3:]
            try:
                text = content.decode('utf-8')
            except:
                text = content.decode('latin-1', errors='replace')

            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding='utf-8')
            wc = len(text.split())
            return {"status": "ok", "words": wc, "url": url}
    except HTTPError as e:
        return {"status": "http_error", "code": e.code, "url": url}
    except Exception as e:
        return {"status": "error", "reason": str(e), "url": url}

def main():
    total_ok = 0
    total_fail = 0
    for (pid, fname), info in sorted(FIXES.items()):
        dest = BASE / pid / "texts" / fname
        result = fetch_url(info["url"], dest)
        if result["status"] == "ok":
            total_ok += 1
            print(f"  [OK] {pid}/{fname} — {result['words']:,} words")
        else:
            total_fail += 1
            print(f"  [FAIL] {pid}/{fname}: {result['status']} {result.get('code', '')}")
        time.sleep(0.3)

    print(f"\n=== Fixes: {total_ok} ok, {total_fail} failed ===\n")

if __name__ == "__main__":
    main()
