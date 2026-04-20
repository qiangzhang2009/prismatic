#!/usr/bin/env python3
"""
WittSrc BNE Batch Downloader using Playwright
Uses Playwright to control a real Chromium browser to extract 
Wittgenstein Nachlass manuscripts from wittgensteinsource.org
"""
import asyncio
import os
import re
from playwright.async_api import async_playwright

OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg'

# The 34 remaining manuscripts with their CORRECT docIds
# (verified by manual browsing)
REMAINING = [
    {'ms': 'Ms-158', 'docId': '50'},
    {'ms': 'Ms-159', 'docId': '51'},
    {'ms': 'Ms-160', 'docId': '52'},
    {'ms': 'Ms-161', 'docId': '53'},
    {'ms': 'Ms-165', 'docId': '57'},
    {'ms': 'Ms-166', 'docId': '58'},
    {'ms': 'Ms-167', 'docId': '59'},
    {'ms': 'Ms-169', 'docId': '61'},
    {'ms': 'Ms-171', 'docId': '88'},
    {'ms': 'Ms-172', 'docId': '89'},
    {'ms': 'Ms-173', 'docId': '63'},
    {'ms': 'Ms-176', 'docId': '66'},
    {'ms': 'Ms-177', 'docId': '67'},
    {'ms': 'Ms-178a', 'docId': '90'},
    {'ms': 'Ms-178b', 'docId': '91'},
    {'ms': 'Ms-178c', 'docId': '92'},
    {'ms': 'Ms-178d', 'docId': '93'},
    {'ms': 'Ms-178e', 'docId': '94'},
    {'ms': 'Ms-178f', 'docId': '95'},
    {'ms': 'Ms-178g', 'docId': '96'},
    {'ms': 'Ms-178h', 'docId': '97'},
    {'ms': 'Ms-179', 'docId': '68'},
    {'ms': 'Ms-180a', 'docId': '98'},
    {'ms': 'Ms-180b', 'docId': '69'},
    {'ms': 'Ms-181', 'docId': '70'},
    {'ms': 'Ts-203', 'docId': '78'},
    {'ms': 'Ts-204', 'docId': '79'},
    {'ms': 'Ts-206', 'docId': '99'},
    {'ms': 'Ts-214a1', 'docId': '103'},
    {'ms': 'Ts-214c1', 'docId': '107'},
    {'ms': 'Ts-215c', 'docId': '184'},
    {'ms': 'Ts-218', 'docId': '113'},
    {'ms': 'Ts-240', 'docId': '133'},
    {'ms': 'Ms-305', 'docId': '193'},
    {'ms': 'Ts-306', 'docId': '194'},
]

async def download_one(browser, item):
    """Download one manuscript."""
    ms = item['ms']
    doc_id = item['docId']
    out_path = os.path.join(OUT_DIR, f'{ms}_WittSrc.txt')
    
    # Skip if already exists with good content
    if os.path.exists(out_path):
        size = os.path.getsize(out_path)
        if size > 5000:
            return {'ms': ms, 'status': 'skip', 'chars': size}
    
    context = await browser.new_context(
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport={'width': 1280, 'height': 800},
    )
    page = await context.new_page()
    
    try:
        # Step 1: Open the book transcription page (Normalized)
        url = f'http://www.wittgensteinsource.org/agora_show_book_transcription/{doc_id}?collection=1'
        await page.goto(url, timeout=30000, wait_until='networkidle')
        await page.wait_for_timeout(5000)  # Wait for JS to render
        
        # Step 2: Find and click the link that has TEXT matching the manuscript name
        # The link text is exactly the manuscript name (e.g., "Ms-158")
        # This link goes to full_book_transcription
        link_found = False
        try:
            # Try exact match
            link = page.locator(f'a:text("{ms}")').first
            if await link.count() > 0:
                href = await link.get_attribute('href')
                if href and 'transcription' in href:
                    await link.click(timeout=10000)
                    link_found = True
        except Exception as e:
            pass
        
        if not link_found:
            # Try by partial text match
            try:
                link = page.locator(f'a:text-is("{ms}")').first
                if await link.count() > 0:
                    href = await link.get_attribute('href')
                    if href and 'transcription' in href:
                        await link.click(timeout=10000)
                        link_found = True
            except Exception:
                pass
        
        if not link_found:
            # Last resort: find the first transcription link in the list
            try:
                links = page.locator('a[href*="full_book_transcription"]')
                count = await links.count()
                if count > 0:
                    await links.nth(0).click(timeout=10000)
                    link_found = True
            except Exception:
                pass
        
        await page.wait_for_timeout(8000)  # Wait for content to load
        await page.wait_for_load_state('networkidle', timeout=15000)
        
        # Step 3: Extract text
        text = await page.inner_text('body')
        text = text.strip()
        
        # Step 4: Try diplomatic if text is too short
        if len(text) < 5000:
            url2 = f'http://www.wittgensteinsource.org/agora_show_book_transcription/{doc_id}?collection=3'
            await page.goto(url2, timeout=30000, wait_until='networkidle')
            await page.wait_for_timeout(5000)
            
            link_found2 = False
            try:
                link = page.locator(f'a:text("{ms}")').first
                if await link.count() > 0:
                    href = await link.get_attribute('href')
                    if href and 'transcription' in href:
                        await link.click(timeout=10000)
                        link_found2 = True
            except Exception:
                pass
            
            if not link_found2:
                try:
                    links = page.locator('a[href*="full_book_transcription"]')
                    if await links.count() > 0:
                        await links.nth(0).click(timeout=10000)
                        link_found2 = True
                except Exception:
                    pass
            
            await page.wait_for_timeout(8000)
            await page.wait_for_load_state('networkidle', timeout=15000)
            text2 = await page.inner_text('body')
            text2 = text2.strip()
            if len(text2) > len(text):
                text = text2
        
    except Exception as e:
        text = f"ERROR: {str(e)[:200]}"
    finally:
        await context.close()
    
    chars = len(text)
    if chars > 1000:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
        words = len(text.split())
        return {'ms': ms, 'status': 'success', 'chars': chars, 'words': words, 'path': out_path}
    else:
        return {'ms': ms, 'status': 'failed', 'chars': chars}

async def main():
    print(f'Will download {len(REMAINING)} manuscripts...')
    print()
    
    async with async_playwright() as p:
        # Launch Chromium (headed for debugging)
        browser = await p.chromium.launch(headless=True)
        
        success = 0
        failed = 0
        skipped = 0
        
        for i, item in enumerate(REMAINING):
            ms = item['ms']
            print(f'[{i+1}/{len(REMAINING)}] {ms}... ', end='', flush=True)
            
            result = await download_one(browser, item)
            
            if result['status'] == 'success':
                print(f"OK: {result['chars']} chars, ~{result['words']} words")
                success += 1
            elif result['status'] == 'skip':
                print(f"SKIP: already exists ({result['chars']} bytes)")
                skipped += 1
            else:
                print(f"FAIL: {result['chars']} chars")
                failed += 1
        
        await browser.close()
        
        print()
        print('=' * 50)
        print(f'Results: {success} success, {skipped} skipped, {failed} failed')
        print('=' * 50)

if __name__ == '__main__':
    asyncio.run(main())
