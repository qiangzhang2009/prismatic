#!/usr/bin/env python3
"""
WittSrc BNE Batch Downloader (Python version)
Downloads WittSrc manuscripts using direct HTTP requests + HTML parsing.
This approach bypasses the need for a real browser by:
1. Downloading the book_transcription page (which contains the page list)
2. Finding all transcription entry links with their data IDs
3. For each entry, using the TEI XML source directly from the WAB repository
"""
import urllib.request
import ssl
import time
import re
import os
import sys

OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

# Correct docId mappings discovered by scraping collection list
# Format: ms_name -> docId
MISSING_DOCIDS = {
    'Ms-158': '51',
    'Ms-159': '52',
    'Ms-160': '155',
    'Ms-161': '156',
    'Ms-162a': '53',
    'Ms-162b': '54',
    'Ms-163': '55',
    'Ms-164': '56',
    'Ms-165': '57',
    'Ms-166': '58',
    'Ms-167': '59',
    'Ms-168': '60',
    'Ms-169': '61',
    'Ms-170': '62',
    'Ms-171': '88',
    'Ms-172': '89',
    'Ms-173': '63',
    'Ms-174': '64',
    'Ms-175': '65',
    'Ms-176': '66',
    'Ms-177': '67',
    'Ms-178a': '90',
    'Ms-178b': '91',
    'Ms-178c': '92',
    'Ms-178d': '93',
    'Ms-178e': '94',
    'Ms-178f': '95',
    'Ms-178g': '96',
    'Ms-178h': '97',
    'Ms-179': '68',
    'Ms-180a': '98',
    'Ms-180b': '69',
    'Ms-181': '70',
    'Ms-182': '75',
    'Ts-203': '78',
    'Ts-204': '79',
    'Ts-206': '99',
    'Ts-214a1': '103',
    'Ts-214c1': '107',
    'Ts-215c': '184',
    'Ts-218': '113',
    'Ts-240': '133',
    'Ts-243': '136',
    'Ts-244': '137',
    'Ts-245': '138',
    'Ts-248': '197',
    'Ms-301': '189',
    'Ts-302': '190',
    'Ts-303': '191',
    'Ts-304': '192',
    'Ms-305': '193',
    'Ts-306': '194',
    'Ts-309': '195',
}

def fetch(url, timeout=30):
    """Fetch a URL and return content."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=timeout)
        content = resp.read()
        encoding = resp.headers.get_content_charset() or 'utf-8'
        return content.decode(encoding, errors='replace')
    except Exception as e:
        return None

def extract_text_from_html(html):
    """Extract text from HTML, removing scripts, styles, and navigation."""
    if not html:
        return ''
    
    # Remove script and style tags
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove navigation elements
    html = re.sub(r'<nav[^>]*>.*?</nav>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<header[^>]*>.*?</header>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<footer[^>]*>.*?</footer>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<aside[^>]*>.*?</aside>', '', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove specific unwanted elements
    html = re.sub(r'<div[^>]*class="[^"]*collapse[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<div[^>]*class="[^"]*drag[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
    
    # Remove all HTML tags
    text = re.sub(r'<[^>]+>', ' ', html)
    
    # Clean whitespace
    text = re.sub(r'\s+', ' ', text)
    
    return text.strip()

def get_manuscript_text_normalized(docId, ms):
    """Try to get full manuscript text via multiple strategies."""
    
    # Strategy 1: Try the full book transcription page
    url1 = f'http://www.wittgensteinsource.org/agora_show_full_book_transcription/{docId}?collection=1'
    html1 = fetch(url1)
    if html1:
        text1 = extract_text_from_html(html1)
        if len(text1) > 5000:
            return text1, url1, 'full_transcription_normalized'
    
    # Strategy 2: Try the TEI XML from wab.uib.no
    # Try common TEI XML URLs
    for suffix in ['_OA.xml', '.xml', '_TEI_P5.xml']:
        wab_url = f'http://wab.uib.no/cost-a32_xml/{ms}{suffix}'
        wab_html = fetch(wab_url)
        if wab_html and len(wab_html) > 5000:
            text_wab = extract_text_from_html(wab_html)
            if len(text_wab) > 5000:
                return text_wab, wab_url, 'wab_xml'
    
    # Strategy 3: Try the book_transcription page + extract all entries
    url2 = f'http://www.wittgensteinsource.org/agora_show_book_transcription/{docId}?collection=1'
    html2 = fetch(url2)
    if html2:
        text2 = extract_text_from_html(html2)
        if len(text2) > 5000:
            return text2, url2, 'book_transcription'
    
    # Strategy 4: Try diplomatic version
    url3 = f'http://www.wittgensteinsource.org/agora_show_full_book_transcription/{docId}?collection=3'
    html3 = fetch(url3)
    if html3:
        text3 = extract_text_from_html(html3)
        if len(text3) > 5000:
            return text3, url3, 'full_transcription_diplomatic'
    
    return '', '', 'failed'

def main():
    total = len(MISSING_DOCIDS)
    success = 0
    failed = []
    
    for i, (ms, docId) in enumerate(MISSING_DOCIDS.items()):
        out_path = os.path.join(OUT_DIR, f'{ms}_WittSrc.txt')
        
        # Skip if already exists with good content
        if os.path.exists(out_path):
            size = os.path.getsize(out_path)
            if size > 5000:
                print(f'[{i+1}/{total}] {ms} - SKIP (exists: {size} bytes)')
                continue
        
        print(f'[{i+1}/{total}] {ms} (docId={docId})...', end=' ', flush=True)
        
        text, url, method = get_manuscript_text_normalized(docId, ms)
        word_count = len(text.split()) if text else 0
        
        if len(text) > 1000:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'OK: {len(text)} chars, ~{word_count} words ({method})')
            success += 1
        else:
            print(f'FAIL: {len(text)} chars ({method})')
            failed.append((ms, docId, len(text), method))
        
        time.sleep(1)  # Be polite to the server
    
    print(f'\n=== DONE ===')
    print(f'Success: {success}/{total}')
    if failed:
        print(f'Failed ({len(failed)}):')
        for ms, docId, chars, method in failed:
            print(f'  {ms} (docId={docId}): {chars} chars ({method})')

if __name__ == '__main__':
    main()
