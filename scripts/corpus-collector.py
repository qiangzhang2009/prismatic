#!/usr/bin/env python3
"""
scripts/corpus-collector.py
批量采集语料：Gutenberg / CText / Internet Archive 公版文本
Usage: python3 scripts/corpus-collector.py --persona=sima-qian
       python3 scripts/corpus-collector.py --all
       python3 scripts/corpus-collector.py --priority=P0
"""
import os, sys, re, json, time, hashlib
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE = Path("/Users/john/蒸馏2/corpus")

# ─── Corpus Sources ────────────────────────────────────────────────────────────

SOURCES = {
    # ── P0: 语料丰富 ──────────────────────────────────────────────────────

    "sima-qian": [
        {"url": "https://www.gutenberg.org/cache/epub/24226/pg24226-images.html",
         "file": "shiji-gutenberg.html", "title": "Records of the Grand Historian (Gutenberg HTML)"},
        # CText chapters (high priority)
        {"url": "https://ctext.org/shiji", "file": "shiji-ctext.html", "title": "Records of the Grand Historian (CText)"},
    ],
    "journey-west": [
        {"url": "https://www.gutenberg.org/files/23962/23962-0.txt",
         "file": "journey-west-arthur-waley.txt", "title": "Journey to the West (Waley translation)"},
        {"url": "https://ctext.org/xiyouji", "file": "xiyouji-ctext.html", "title": "西游记原文 (CText)"},
    ],
    "three-kingdoms": [
        {"url": "https://www.gutenberg.org/files/23950/23950-0.txt",
         "file": "three-kingdoms-brett.txt", "title": "Romance of Three Kingdoms (Brett translation)"},
        {"url": "https://ctext.org/three-kingdoms", "file": "sanguoyanyi-ctext.html", "title": "三国演义原文 (CText)"},
    ],
    "seneca": [
        {"url": "https://www.gutenberg.org/cache/epub/24148/pg24148-images.html",
         "file": "seneca-moral-letters.html", "title": "Seneca - Moral Letters to Lucilius"},
        {"url": "https://www.gutenberg.org/cache/epub/16742/pg16742-images.html",
         "file": "seneca-shortness-of-life.html", "title": "On the Shortness of Life"},
        {"url": "https://www.gutenberg.org/files/29444/29444-0.txt",
         "file": "seneca-on-anger.txt", "title": "On Anger"},
    ],
    "carl-jung": [
        {"url": "https://www.gutenberg.org/cache/epub/48225/pg48225-images.html",
         "file": "jung-symbols-of-transformation.html", "title": "Symbols of Transformation"},
    ],
    "osamu-dazai": [
        {"url": "https://archive.org/download/no-longer-human-dazai-osamu/no-longer-human-dazai-osamu.txt",
         "file": "no-longer-human.txt", "title": "No Longer Human (archive.org)"},
        {"url": "https://archive.org/download/setting00daza/setting00daza_text.txt",
         "file": "setting-sun.txt", "title": "Setting Sun (archive.org)"},
    ],
    "zhuang-zi": [
        {"url": "https://www.gutenberg.org/cache/epub/23856/pg23856-images.html",
         "file": "zhuangzi-watson.html", "title": "Zhuangzi (Burton Watson translation)"},
        {"url": "https://ctext.org/zhuangzi", "file": "zhuangzi-ctext.html", "title": "庄子原文 (CText)"},
    ],
    "lin-yutang": [
        {"url": "https://archive.org/download/mycountrymypeopl0000liny/mycountrymypeopl0000liny_text.txt",
         "file": "my-country-my-people.txt", "title": "My Country and My People"},
    ],
    "confucius": [
        {"url": "https://www.gutenberg.org/files/2302/2302-0.txt",
         "file": "analects-legge.txt", "title": "Analects (Legge translation)"},
        {"url": "https://www.gutenberg.org/files/21971/21971-0.txt",
         "file": "great-learning.txt", "title": "The Great Learning"},
        {"url": "https://ctext.org/analects", "file": "lunyu-ctext.html", "title": "论语原文 (CText)"},
    ],
    "marcus-aurelius": [
        {"url": "https://www.gutenberg.org/files/55317/55317-0.txt",
         "file": "meditations-hays.txt", "title": "Meditations (Gregory Hays)"},
        {"url": "https://www.gutenberg.org/cache/epub/15877/pg15877-images.html",
         "file": "meditations-hays-gutenberg.html", "title": "Meditations (Gutenberg)"},
    ],
    "epictetus": [
        {"url": "https://www.gutenberg.org/cache/epub/45109/pg45109-images.html",
         "file": "enchiridion.html", "title": "Enchiridion (Epictetus)"},
    ],
    "einstein": [
        {"url": "https://www.gutenberg.org/files/30115/30115-0.txt",
         "file": "relativity.txt", "title": "Relativity: Special and General Theory"},
        {"url": "https://www.gutenberg.org/files/5604/5604-0.txt",
         "file": "cosmic-religion.txt", "title": "Einstein on Cosmic Religion"},
        {"url": "https://www.gutenberg.org/files/5853/5853-0.txt",
         "file": "ideas-opinions.txt", "title": "Ideas and Opinions"},
    ],
    "aleister-crowley": [
        {"url": "https://www.sacred-texts.com/oto/engccxx.htm",
         "file": "book-of-the-law.txt", "title": "Book of the Law"},
    ],

    # ── P1: 语料中等 ──────────────────────────────────────────────────────

    "sun-tzu": [
        {"url": "https://www.gutenberg.org/files/17405/17405-0.txt",
         "file": "art-of-war.txt", "title": "The Art of War (Sun Tzu)"},
        {"url": "https://ctext.org/art-of-war", "file": "sunjia-ctext.html", "title": "孙子兵法原文 (CText)"},
    ],
    "lao-zi": [
        {"url": "https://www.gutenberg.org/files/22423/22423-0.txt",
         "file": "tao-te-ching-waley.txt", "title": "Tao Te Ching (Arthur Waley)"},
        {"url": "https://ctext.org/taoteching", "file": "daodejing-ctext.html", "title": "道德经原文 (CText)"},
    ],
    "mencius": [
        {"url": "https://www.gutenberg.org/files/2304/2304-0.txt",
         "file": "mengzi-legge.txt", "title": "Mencius (Legge translation)"},
        {"url": "https://ctext.org/mengzi", "file": "mengzi-ctext.html", "title": "孟子原文 (CText)"},
    ],
    "mo-zi": [
        {"url": "https://ctext.org/Mozi", "file": "mozi-ctext.html", "title": "墨子全文 (CText)"},
    ],
    "han-fei-zi": [
        {"url": "https://www.gutenberg.org/files/20763/20763-0.txt",
         "file": "hanfeizi-selected.txt", "title": "Han Feizi Selected Works"},
        {"url": "https://ctext.org/hanfeizi", "file": "hanfeizi-ctext.html", "title": "韩非子原文 (CText)"},
    ],
    "qu-yuan": [
        {"url": "https://ctext.org/chuci", "file": "chuci-ctext.html", "title": "楚辞·离骚 (CText)"},
    ],
    "huangdi-neijing": [
        {"url": "https://ctext.org/suwen", "file": "huangdi-neijing-suwen.html", "title": "黄帝内经·素问 (CText)"},
        {"url": "https://ctext.org/lingshu", "file": "huangdi-neijing-lingshu.html", "title": "黄帝内经·灵枢 (CText)"},
    ],
    "hui-neng": [
        {"url": "https://www.gutenberg.org/cache/epub/46197/pg46197-images.html",
         "file": "platform-sutra.html", "title": "Platform Sutra of Hui Neng"},
        {"url": "https://ctext.org/platform-sutra", "file": "liuzu-tanjing-ctext.html", "title": "六祖坛经原文 (CText)"},
    ],
    "shao-yong": [
        {"url": "https://ctext.org", "file": "shao-yong-placeholder.txt", "title": "邵雍著作 (需手动检索)"},
    ],
    "li-chunfeng": [
        {"url": "https://ctext.org", "file": "li-chunfeng-placeholder.txt", "title": "李淳风著作 (需手动检索)"},
    ],
    "nikola-tesla": [
        {"url": "https://www.gutenberg.org/files/10755/10755-0.txt",
         "file": "inventions-researches.txt", "title": "Inventions, Researches and Writings of Nikola Tesla"},
    ],
    "alan-watts": [
        {"url": "https://archive.org/download/wayofzen0000watt/wayofzen0000watt_text.txt",
         "file": "way-of-zen.txt", "title": "The Way of Zen"},
    ],
    "alan-turing": [
        {"url": "https://www.gutenberg.org/files/58311/58311-0.txt",
         "file": "computing-machinery-intelligence.txt", "title": "Computing Machinery and Intelligence"},
    ],
    "qian-xuesen": [
        {"url": "https://archive.org/details/engineeringcyber0000xues",
         "file": "engineering-cybernetics.html", "title": "Engineering Cybernetics"},
    ],
    "naval-ravikant": [
        {"url": "https://navalmanack.com/",
         "file": "naval-almanack.html", "title": "The Almanack of Naval Ravikant"},
    ],
    "peter-thiel": [
        {"url": "https://tim.blog/peter-thiel/",
         "file": "tim-ferriss-interview.html", "title": "Peter Thiel Interview (Tim Ferriss)"},
    ],
    "ray-dalio": [
        {"url": "https://www.youtube.com/watch?v=Nu4KQnF6QA4",
         "file": "principles-ted-placeholder.txt", "title": "Principles - How Economic Machines Work (TED)"},
    ],
    "sam-altman": [
        {"url": "https://blog.samaltman.com/",
         "file": "sam-altman-blog.html", "title": "Sam Altman Blog"},
    ],
    "jeff-bezos": [
        {"url": "https://ir.aboutamazon.com/",
         "file": "amazon-ir-placeholder.txt", "title": "Amazon Investor Relations"},
    ],
    "jack-ma": [
        {"url": "https://singjupost.com/",
         "file": "jack-ma-placeholder.txt", "title": "Jack Ma Speeches"},
    ],
    "donald-trump": [
        {"url": "https://archive.org/details/artofdeal00trump",
         "file": "art-of-the-deal.html", "title": "The Art of the Deal"},
    ],
    "socrates": [
        {"url": "https://www.gutenberg.org/files/1727/1727-0.txt",
         "file": "plato-complete.txt", "title": "Plato Complete Works (includes Apology, Republic, etc.)"},
    ],
    "kant": [
        {"url": "https://www.gutenberg.org/files/5684/5684-0.txt",
         "file": "metaphysical-elements-ethics.txt", "title": "Metaphysical Elements of Ethics"},
        {"url": "https://www.gutenberg.org/files/5289/5289-0.txt",
         "file": "critique-practical-reason.txt", "title": "Critique of Practical Reason"},
    ],
    "john-dee": [
        {"url": "https://www.sacred-texts.com/oto/monashieroglyphica.htm",
         "file": "monas-hieroglyphica.txt", "title": "Monas Hieroglyphica"},
    ],
    "john-maynard-keynes": [
        {"url": "https://www.gutenberg.org/files/20069/20069-0.txt",
         "file": "general-theory.txt", "title": "The General Theory of Employment, Interest and Money"},
        {"url": "https://www.gutenberg.org/files/15776/15776-0.txt",
         "file": "economic-consequences-peace.txt", "title": "The Economic Consequences of the Peace"},
    ],

    # ── P2: 语料有限 ──────────────────────────────────────────────────────

    "xiang-yu": [
        {"url": "https://ctext.org/shiji/xia",
         "file": "xiangyu-shiji-ctext.html", "title": "史记·项羽本纪"},
    ],
    "sun-wukong": [
        # Same corpus as journey-west, just tag for extraction later
        {"url": "https://www.gutenberg.org/files/23962/23962-0.txt",
         "file": "journey-west-source.txt", "title": "Journey to the West (source for sun-wukong extraction)"},
    ],
    "zhu-bajie": [
        {"url": "https://www.gutenberg.org/files/23962/23962-0.txt",
         "file": "journey-west-source.txt", "title": "Journey to the West (source for zhu-bajie extraction)"},
    ],
    "tripitaka": [
        {"url": "https://www.gutenberg.org/files/23962/23962-0.txt",
         "file": "journey-west-source.txt", "title": "Journey to the West (source for tripitaka extraction)"},
    ],
    "zhuge-liang": [
        {"url": "https://www.gutenberg.org/files/23950/23950-0.txt",
         "file": "three-kingdoms-source.txt", "title": "Romance of Three Kingdoms (source for zhuge-liang extraction)"},
        {"url": "https://ctext.org/chuci", "file": "chu-ci-ctext.html", "title": "出师表 etc. (CText)"},
    ],
    "cao-cao": [
        {"url": "https://www.gutenberg.org/files/23950/23950-0.txt",
         "file": "three-kingdoms-source.txt", "title": "Romance of Three Kingdoms (source for cao-cao extraction)"},
    ],
    "liu-bei": [
        {"url": "https://www.gutenberg.org/files/23950/23950-0.txt",
         "file": "three-kingdoms-source.txt", "title": "Romance of Three Kingdoms (source for liu-bei extraction)"},
    ],
    "records-grand-historian": [
        # Same as sima-qian
        {"url": "https://www.gutenberg.org/cache/epub/24226/pg24226-images.html",
         "file": "shiji-gutenberg.html", "title": "Records of the Grand Historian (shared with sima-qian)"},
    ],
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; PrismaticBot/1.0; corpus collection)",
}

def fetch_url(url: str, dest: Path) -> dict:
    """Download a URL and save to dest. Returns status dict."""
    try:
        req = Request(url, headers=HEADERS)
        with urlopen(req, timeout=15) as resp:
            content = resp.read()
            encoding = 'utf-8'
            # Try to detect encoding
            if content.startswith(b'\xef\xbb\xbf'):
                content = content[3:]
                encoding = 'utf-8-sig'
            elif content[:4] == b'\xff\xfe' or content[:4] == b'\xfe\xff':
                encoding = 'utf-16'
            try:
                text = content.decode(encoding)
            except:
                text = content.decode('latin-1', errors='replace')

            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding='utf-8')

            wc = len(text.split())
            sz = len(text.encode('utf-8'))
            return {"status": "ok", "words": wc, "bytes": sz, "url": url}
    except HTTPError as e:
        return {"status": "http_error", "code": e.code, "url": url}
    except URLError as e:
        return {"status": "url_error", "reason": str(e.reason), "url": url}
    except Exception as e:
        return {"status": "error", "reason": str(e), "url": url}

def collect_persona(persona_id: str) -> dict:
    """Collect all sources for a persona."""
    texts_dir = BASE / persona_id / "texts"
    texts_dir.mkdir(parents=True, exist_ok=True)

    results = []
    sources = SOURCES.get(persona_id, [])

    for src in sources:
        dest = texts_dir / src["file"]
        already = dest.exists()
        result = fetch_url(src["url"], dest)
        result["file"] = src["file"]
        result["title"] = src["title"]
        result["already_existed"] = already
        results.append(result)
        time.sleep(0.5)  # Rate limiting

    return {"persona": persona_id, "results": results}

def corpus_stats(persona_id: str) -> dict:
    """Get corpus statistics for a persona."""
    texts_dir = BASE / persona_id / "texts"
    if not texts_dir.exists():
        return {"persona": persona_id, "files": 0, "words": 0, "bytes": 0, "files_list": []}

    files = list(texts_dir.iterdir())
    total_words = 0
    total_bytes = 0
    file_list = []

    for f in files:
        if f.is_file() and f.suffix in (".txt", ".html", ".htm"):
            try:
                content = f.read_text(encoding='utf-8', errors='replace')
                wc = len(content.split())
                bz = f.stat().st_size
                total_words += wc
                total_bytes += bz
                file_list.append({"file": f.name, "words": wc, "bytes": bz})
            except:
                pass

    return {"persona": persona_id, "files": len(file_list), "words": total_words, "bytes": total_bytes, "files_list": file_list}

def main():
    mode = None
    target = None

    for arg in sys.argv[1:]:
        if arg.startswith("--persona="):
            target = arg.split("=", 1)[1]
            mode = "persona"
        elif arg == "--all":
            mode = "all"
        elif arg.startswith("--priority="):
            target = arg.split("=", 1)[1]
            mode = "priority"
        elif arg == "--stats":
            mode = "stats"

    if mode == "persona" and target:
        print(f"\n=== Collecting corpus for: {target} ===\n")
        result = collect_persona(target)
        for r in result["results"]:
            icon = "✓" if r["status"] == "ok" else "✗"
            extra = f" ({r.get('words', 0):,} words)" if r["status"] == "ok" else f" [{r.get('status')}]"
            action = "already" if r.get("already_existed") else "downloaded"
            print(f"  {icon} {r['file']} — {action}{extra}")

        stats = corpus_stats(target)
        print(f"\n  Total: {stats['files']} files, {stats['words']:,} words\n")

    elif mode == "all":
        print(f"\n=== Collecting corpus for ALL {len(SOURCES)} personas ===\n")
        total_ok = 0
        total_fail = 0
        for pid in sorted(SOURCES.keys()):
            result = collect_persona(pid)
            for r in result["results"]:
                if r["status"] == "ok":
                    total_ok += 1
                else:
                    total_fail += 1
                    print(f"  [FAIL] {pid}/{r['file']}: {r['status']} {r.get('code', r.get('reason', ''))}")
        print(f"\n=== Done: {total_ok} downloaded, {total_fail} failed ===\n")

    elif mode == "stats":
        print("\n=== Corpus Statistics ===\n")
        all_personas = [p.name for p in BASE.iterdir() if p.is_dir() and not p.name.startswith('.')]
        for pid in sorted(all_personas):
            stats = corpus_stats(pid)
            if stats["files"] > 0:
                print(f"  {pid:<30} {stats['files']:>2} files  {stats['words']:>8,} words")

    else:
        print("Usage:")
        print("  python3 scripts/corpus-collector.py --persona=sima-qian")
        print("  python3 scripts/corpus-collector.py --all")
        print("  python3 scripts/corpus-collector.py --stats")

if __name__ == "__main__":
    main()
