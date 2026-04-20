#!/usr/bin/env python3
"""
Redownload 6 problematic Wittgenstein manuscripts from WittSrc using Playwright.
These files are either missing (Ts-245) or suspiciously small.
"""
import asyncio
import os
import re
from playwright.async_api import async_playwright

OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg'

PROBLEMATIC = [
    {'ms': 'Ts-245',  'docId': '138'},
    {'ms': 'Ts-204',  'docId': '79'},
    {'ms': 'Ts-215c', 'docId': '184'},
    {'ms': 'Ms-178f', 'docId': '95'},
    {'ms': 'Ms-178g', 'docId': '96'},
    {'ms': 'Ms-178h', 'docId': '97'},
]

def clean_text(text):
    if not text:
        return text
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#[0-9]+;', '', text)
    text = re.sub(r'\\bCollapse\\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\\bDrag\\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'http://www\.wittgensteinsource\.org/N[Nn]\\?[^\s]*', '', text)
    text = re.sub(r'\\b(NN)\\b', '', text)
    text = re.sub(r'\\b(1[0-9]{3})\\b', '', text)
    text = re.sub(r'\\b(Vol[. ]?[0-9]+)\\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\\b(Page [0-9]+)\\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

async def extract_manuscript(browser, ms, docId):
    out_path = os.path.join(OUT_DIR, f'{ms}_WittSrc.txt')
    existed = os.path.exists(out_path)
    old_size = os.path.getsize(out_path) if existed else 0

    page = None
    best_text = ''
    best_len = 0

    try:
        for coll in ['1', '3']:
            context = await browser.new_context(
                user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            )
            page = await context.new_page()

            url = f'http://www.wittgensteinsource.org/agora_show_book_transcription/{docId}?collection={coll}'
            coll_name = 'Normalized' if coll == '1' else 'Diplomatic'
            print(f'  [{ms}] Trying {coll_name}: {url}')

            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)
                await asyncio.sleep(3)

                links = await page.query_selector_all('a[href*="full_book_transcription"]')
                clicked = False
                for link in links:
                    href = await link.get_attribute('href')
                    if href and 'full_book_transcription' in href:
                        await link.click()
                        clicked = True
                        print(f'    Clicked: {href[:80]}')
                        break

                if clicked:
                    await asyncio.sleep(15)
                else:
                    print(f'    No full_book_transcription link found')

                text = await page.inner_text('body')
                text = clean_text(text)
                print(f'    {coll_name} text: {len(text)} chars')
                if len(text) > best_len:
                    best_text = text
                    best_len = len(text)

            except Exception as e:
                print(f'    {coll_name} error: {e}')

            await context.close()

        # Save best result
        if best_len > 500:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(best_text)
            new_size = len(best_text)
            change = new_size - old_size if existed else new_size
            print(f'  [SUCCESS] {ms} -> {new_size} chars ({change:+,d} vs old {old_size})')
            return True
        else:
            print(f'  [FAILED] {ms} - best text only {best_len} chars (old: {old_size})')
            return False

    except Exception as e:
        print(f'  [ERROR] {ms}: {e}')
        return False

async def main():
    print('=== Redownloading 6 Problematic Manuscripts ===\n')
    os.makedirs(OUT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        results = {}
        for item in PROBLEMATIC:
            ms = item['ms']
            docId = item['docId']
            print(f'[{ms}] docId={docId}')
            results[ms] = await extract_manuscript(browser, ms, docId)
            print()
        await browser.close()

    print('=== Summary ===')
    for ms, ok in results.items():
        status = 'OK' if ok else 'FAILED'
        path = os.path.join(OUT_DIR, f'{ms}_WittSrc.txt')
        size = os.path.getsize(path) if os.path.exists(path) else 0
        print(f'  {ms}: {status} ({size} bytes)')

if __name__ == '__main__':
    asyncio.run(main())
