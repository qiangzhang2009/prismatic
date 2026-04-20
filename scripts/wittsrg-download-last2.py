#!/usr/bin/env python3
"""
Download 2 missing Wittgenstein manuscripts from WittSrc using Playwright.
Target: Ts-242a (docId=188) and Ts-246 (docId=139)
"""
import asyncio
import os
import re
from playwright.async_api import async_playwright

OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg'

MISSING = [
    {'ms': 'Ts-242a', 'docId': '188'},
    {'ms': 'Ts-246', 'docId': '139'},
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
    text = re.sub(r'\\s+', ' ', text)
    return text.strip()

async def extract_manuscript(browser, ms, docId):
    out_path = os.path.join(OUT_DIR, f'{ms}_WittSrc.txt')

    # Check if already exists with good content
    if os.path.exists(out_path):
        size = os.path.getsize(out_path)
        if size > 2000:
            print(f'  [SKIP] {ms} already exists ({size} bytes)')
            return True

    page = None
    try:
        context = await browser.new_context(
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()

        # Try Normalized first (collection=1)
        url = f'http://www.wittgensteinsource.org/agora_show_book_transcription/{docId}?collection=1'
        print(f'  [{ms}] Trying Normalized: {url}')
        await page.goto(url, wait_until='networkidle', timeout=30000)
        await asyncio.sleep(3)

        # Find and click the full_book_transcription link
        link_found = False
        async def try_click_transcription():
            nonlocal link_found
            try:
                # Try Normalized first
                links = await page.query_selector_all('a[href*="full_book_transcription"]')
                for link in links:
                    href = await link.get_attribute('href')
                    text = await link.inner_text()
                    print(f'    Found link: {href} | text: {text[:50]}')
                    if href and 'full_book_transcription' in href:
                        await link.click()
                        link_found = True
                        print(f'    Clicked: {href[:80]}')
                        return True
            except Exception as e:
                print(f'    Click error: {e}')
            return False

        clicked = await try_click_transcription()
        if clicked:
            await asyncio.sleep(12)
            text = await page.inner_text('body')
            text = clean_text(text)
            print(f'  [{ms}] Normalized text length: {len(text)}')
        else:
            text = ''

        # If too short, try Diplomatic (collection=3)
        if len(text) < 2000:
            print(f'  [{ms}] Normalized too short ({len(text)}), trying Diplomatic...')
            await page.goto(f'http://www.wittgensteinsource.org/agora_show_book_transcription/{docId}?collection=3',
                          wait_until='networkidle', timeout=30000)
            await asyncio.sleep(3)
            links = await page.query_selector_all('a[href*="full_book_transcription"]')
            for link in links:
                href = await link.get_attribute('href')
                if href and 'full_book_transcription' in href:
                    await link.click()
                    link_found = True
                    print(f'    Clicked Diplomatic: {href[:80]}')
                    break
            if link_found:
                await asyncio.sleep(12)
                text = await page.inner_text('body')
                text = clean_text(text)
                print(f'  [{ms}] Diplomatic text length: {len(text)}')

        await context.close()

        # Save
        if text and len(text) > 500:
            with open(out_path, 'w', encoding='utf-8') as f:
                f.write(text)
            print(f'  [SUCCESS] {ms} -> {out_path} ({len(text)} chars)')
            return True
        else:
            print(f'  [FAILED] {ms} - text too short ({len(text)} chars)')
            return False

    except Exception as e:
        print(f'  [ERROR] {ms}: {e}')
        if page:
            try:
                await page.inner_text('body')
            except:
                pass
        return False

async def main():
    print('=== Downloading 2 Missing Wittgenstein Manuscripts ===')
    os.makedirs(OUT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        results = {}
        for item in MISSING:
            ms = item['ms']
            docId = item['docId']
            print(f'\n[{ms}] docId={docId}')
            results[ms] = await extract_manuscript(browser, ms, docId)
        await browser.close()

    print('\n=== Summary ===')
    for ms, ok in results.items():
        print(f'  {ms}: {"OK" if ok else "FAILED"}')

if __name__ == '__main__':
    asyncio.run(main())
