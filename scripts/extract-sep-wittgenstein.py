#!/usr/bin/env python3
"""
SEP/IEP Content Extractor for Wittgenstein corpus
Properly extracts article body from SEP/IEP HTML pages
"""
import re
import sys
import json
import os
from pathlib import Path

CORPUS_DIR = Path("/Users/john/蒸馏2/corpus/wittgenstein/texts")

def strip_html(html: str) -> str:
    """Remove HTML markup, scripts, styles, and normalize whitespace"""
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<nav[^>]*>.*?</nav>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<footer[^>]*>.*?</footer>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<header[^>]*>.*?</header>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<aside[^>]*>.*?</aside>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&#39;', "'", text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def count_words(text: str) -> int:
    chinese = len(re.findall(r'[\u4e00-\u9fff]', text))
    english = len(re.findall(r'[a-zA-Z]+', text))
    return chinese + english

def extract_sep_content(html: str) -> str:
    """Extract main article content from SEP HTML"""
    text = strip_html(html)

    # SEP content is typically between the table of contents and the bibliography
    # Look for the main body content
    # The article content starts after "Entry Contents" and ends before "Bibliography"

    # Try to find the main philosophical content
    # SEP pages have numbered sections starting with "1. " or section headings

    # Find the section after "Entry Navigation" / "Entry Contents"
    toc_end = text.find("Entry Navigation")
    if toc_end == -1:
        toc_end = text.find("Entry Contents")
    if toc_end == -1:
        toc_end = text.find("Bibliography")
    if toc_end == -1:
        toc_end = 0

    body_start = toc_end

    # Find bibliography section to cut off
    bib_match = re.search(r'\bBibliography\b', text)
    ref_match = re.search(r'\bReferences\b', text)

    bib_end = len(text)
    if bib_match:
        bib_end = min(bib_end, bib_match.start())
    if ref_match:
        bib_end = min(bib_end, ref_match.start())

    body = text[body_start:bib_end]

    # Clean up
    body = re.sub(r'^Entry Navigation\s*', '', body)
    body = re.sub(r'^Entry Contents\s*', '', body)
    body = re.sub(r'Stanford Encyclopedia of Philosophy\s*', '', body)
    body = re.sub(r'Menu Browse Table of Contents.*?Back to Top\s*', '', body)

    # Remove repetitive navigation elements
    body = re.sub(r'( SEP | Stanford Encyclopedia | Entry | Table of Contents | Back to Top | Advanced Tools )+', ' ', body)

    body = re.sub(r'\s+', ' ', body).strip()

    return body

def process_sep_file(work_id: str, html_path: str) -> dict:
    """Process a SEP HTML file and save extracted text"""
    with open(html_path, encoding='utf-8') as f:
        html = f.read()

    # Check if page is valid
    if 'Document Not Found' in html or '<title>\n</title>' in html:
        return {'success': False, 'work_id': work_id, 'reason': 'not found'}

    if 'Page not found' in html:
        return {'success': False, 'work_id': work_id, 'reason': 'page not found'}

    content = extract_sep_content(html)
    wc = count_words(content)

    if wc < 200:
        return {'success': False, 'work_id': work_id, 'reason': f'too few words ({wc})', 'content': content[:500]}

    # Save to file
    out_path = CORPUS_DIR / f"{work_id}.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return {'success': True, 'work_id': work_id, 'words': wc, 'path': str(out_path)}

def process_sep_from_url(work_id: str, url: str) -> dict:
    """Download and process a SEP entry from URL"""
    import urllib.request

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
    }

    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        return {'success': False, 'work_id': work_id, 'reason': str(e)}

    return process_sep_file(work_id, html_path=None, html=html)

def process_sep_file_from_content(work_id: str, html: str) -> dict:
    """Process SEP HTML content directly"""
    if 'Document Not Found' in html or '<title>\n</title>' in html:
        return {'success': False, 'work_id': work_id, 'reason': 'not found'}

    content = extract_sep_content(html)
    wc = count_words(content)

    if wc < 200:
        return {'success': False, 'work_id': work_id, 'reason': f'too few words ({wc})'}

    out_path = CORPUS_DIR / f"{work_id}.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return {'success': True, 'work_id': work_id, 'words': wc, 'path': str(out_path)}

def main():
    print("\n🔍 SEP/IEP Content Extractor for Wittgenstein")
    print("=" * 50)

    results = []

    # Process already-fetched files from /tmp
    tmp_files = {
        'sep-wittgenstein-main': '/tmp/sep-witt.html',
        'sep-rule-following': '/tmp/sep-rule.html',
    }

    for work_id, html_path in tmp_files.items():
        if not os.path.exists(html_path):
            print(f"  ⚠️  {work_id}: file not found at {html_path}")
            continue

        result = process_sep_file(work_id, html_path)
        results.append(result)
        status = '✅' if result['success'] else '❌'
        reason = result.get('reason', '')
        words = result.get('words', 0)
        print(f"  {status} {work_id}: {words} words ({reason})")

    # Also fetch missing SEP entries directly
    sep_entries = [
        ('sep-wittgenstein-tractatus', 'https://plato.stanford.edu/entries/wittgenstein-tractatus/'),
        ('sep-wittgenstein-rule-following', 'https://plato.stanford.edu/entries/rule-following/'),
        ('sep-wittgenstein-philosophy-mind', 'https://plato.stanford.edu/entries/wittgenstein-mind/'),
    ]

    for work_id, url in sep_entries:
        print(f"\n  Fetching: {work_id} from {url}")

        # Check if already successfully collected
        existing = CORPUS_DIR / f"{work_id}.txt"
        if existing.exists():
            wc = count_words(existing.read_text(encoding='utf-8'))
            if wc > 500:
                print(f"  ⏭️  Already exists: {wc} words, skipping")
                continue

        result = process_sep_file_from_content(work_id, '')
        # Actually do the fetch
        import urllib.request
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f"  ❌ Fetch error: {e}")
            continue

        result = process_sep_file_from_content(work_id, html)
        status = '✅' if result['success'] else '❌'
        reason = result.get('reason', '')
        words = result.get('words', 0)
        print(f"  {status} {work_id}: {words} words ({reason})")
        results.append(result)

    # Summary
    success = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    total_words = sum(r.get('words', 0) for r in success)

    print(f"\n{'='*50}")
    print(f"Results: {len(success)}/{len(results)} successful, {total_words} total words")

    if failed:
        print("\nFailed:")
        for r in failed:
            print(f"  - {r['work_id']}: {r['reason']}")

    print(f"{'='*50}")

if __name__ == '__main__':
    main()
