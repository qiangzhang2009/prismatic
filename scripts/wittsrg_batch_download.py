#!/usr/bin/env python3
"""
Wittgenstein Source - Batch Manuscript Downloader
================================================
Downloads normalized transcriptions from Wittgenstein Source (wittgensteinsource.org)
using Playwright automation.

WittSrc uses a JavaScript boxview system to load transcription content dynamically.
This script automates the browser to:
1. Navigate to each manuscript transcription page
2. Click on each transcription section in the boxview list
3. Wait for content to load
4. Extract and save the text

Usage:
    python3 wittsrv_batch_download.py [--limit N] [--delay S]

Output:
    corpus/wittgenstein/texts/wittsrg_{doc_id}_{ms_name}.txt
"""
import json
import time
import re
import asyncio
from pathlib import Path
from datetime import datetime

# Manuscripts to download (doc_id -> title mapping from WittSrc)
MANUSCRIPTS = [
    ("31", "Ms-101"), ("32", "Ms-102"), ("33", "Ms-103"), ("167", "Ms-104"),
    ("71", "Ms-105"), ("72", "Ms-106"), ("73", "Ms-107"), ("34", "Ms-108"),
    ("35", "Ms-109"), ("36", "Ms-110"), ("37", "Ms-111"), ("168", "Ms-112"),
    ("169", "Ms-113"), ("12", "Ms-114"), ("1", "Ms-115"), ("140", "Ms-116"),
    ("141", "Ms-117"), ("38", "Ms-118"), ("142", "Ms-119"), ("39", "Ms-120"),
    ("40", "Ms-121"), ("41", "Ms-122"), ("42", "Ms-123"), ("143", "Ms-124"),
    ("43", "Ms-125"), ("144", "Ms-126"), ("145", "Ms-127"), ("146", "Ms-128"),
    ("147", "Ms-129"), ("170", "Ms-130"), ("148", "Ms-131"), ("149", "Ms-132"),
    ("44", "Ms-133"), ("171", "Ms-134"), ("45", "Ms-135"), ("150", "Ms-136"),
    ("151", "Ms-137"), ("152", "Ms-138"), ("4", "Ms-139a"), ("83", "Ms-139b"),
    ("13", "Ms-140"), ("14", "Ms-141"), ("84", "Ms-142"), ("46", "Ms-143"),
    ("74", "Ms-144"), ("85", "Ms-145"), ("86", "Ms-146"), ("47", "Ms-147"),
    ("15", "Ms-148"), ("16", "Ms-149"), ("17", "Ms-150"), ("48", "Ms-151"),
    ("18", "Ms-152"), ("8", "Ms-153a"), ("9", "Ms-153b"), ("10", "Ms-154"),
    ("11", "Ms-155"), ("19", "Ms-156a"), ("87", "Ms-156b"), ("153", "Ms-157a"),
    ("49", "Ms-157b"), ("50", "Ms-158"), ("51", "Ms-159"), ("154", "Ms-160"),
    ("155", "Ms-161"), ("52", "Ms-162a"), ("53", "Ms-162b"), ("54", "Ms-163"),
    ("55", "Ms-164"), ("56", "Ms-165"), ("57", "Ms-166"), ("58", "Ms-167"),
    ("59", "Ms-168"), ("60", "Ms-169"), ("61", "Ms-170"), ("88", "Ms-171"),
    ("89", "Ms-172"), ("62", "Ms-173"), ("63", "Ms-174"), ("64", "Ms-175"),
    ("65", "Ms-176"), ("66", "Ms-177"), ("90", "Ms-178a"), ("91", "Ms-178b"),
    ("92", "Ms-178c"), ("93", "Ms-178d"), ("94", "Ms-178e"), ("95", "Ms-178f"),
    ("96", "Ms-178g"), ("97", "Ms-178h"), ("67", "Ms-179"), ("98", "Ms-180a"),
    ("68", "Ms-180b"), ("69", "Ms-181"), ("70", "Ms-182"), ("75", "Ms-183"),
    ("2", "Ts-201a1"), ("3", "Ts-201a2"), ("172", "Ts-202"), ("76", "Ts-203"),
    ("77", "Ts-204"), ("182", "Ts-205"), ("99", "Ts-206"), ("20", "Ts-207"),
    ("100", "Ts-208"), ("101", "Ts-209"), ("102", "Ts-210"), ("183", "Ts-211"),
    ("6", "Ts-212"), ("5", "Ts-213"), ("103", "Ts-214a1"), ("105", "Ts-214b1"),
    ("107", "Ts-214c1"), ("109", "Ts-215a"), ("110", "Ts-215b"), ("184", "Ts-215c"),
    ("111", "Ts-216"), ("112", "Ts-217"), ("113", "Ts-218"), ("114", "Ts-219"),
    ("115", "Ts-220"), ("116", "Ts-221a"), ("156", "Ts-222"), ("118", "Ts-223"),
    ("119", "Ts-224"), ("120", "Ts-225"), ("121", "Ts-226"), ("122", "Ts-227a"),
    ("185", "Ts-227b"), ("123", "Ts-228"), ("124", "Ts-229"), ("125", "Ts-230a"),
    ("186", "Ts-230b"), ("187", "Ts-230c"), ("126", "Ts-231"), ("127", "Ts-232"),
    ("173", "Ts-233a"), ("174", "Ts-233b"), ("128", "Ts-235"), ("129", "Ts-236"),
    ("130", "Ts-237"), ("131", "Ts-238"), ("132", "Ts-239"), ("133", "Ts-240"),
    ("134", "Ts-241a"), ("135", "Ts-241b"), ("188", "Ts-242a"), ("196", "Ts-242b"),
    ("136", "Ts-243"), ("137", "Ts-244"), ("138", "Ts-245"), ("78", "Ts-247"),
    ("197", "Ts-248"), ("189", "Ms-301"), ("190", "Ts-302"), ("191", "Ts-303"),
    ("192", "Ts-304"), ("193", "Ms-305"), ("194", "Ts-306"), ("195", "Ts-309"),
    ("7", "Ts-310"), ("21", "Legend"),
]

OUT_DIR = Path("/Users/john/蒸馏2/corpus/wittgenstein/texts")
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_FILE = OUT_DIR / "wittsrg_download_log.json"

def load_log():
    if LOG_FILE.exists():
        return json.loads(LOG_FILE.read_text())
    return {}

def save_log(log):
    LOG_FILE.write_text(json.dumps(log, indent=2))

async def download_wittsrg(doc_id: str, title: str, page, progress_callback=None) -> dict:
    """
    Download a single manuscript from WittSrc.
    Uses Playwright page to navigate and extract text.
    """
    ms_safe = re.sub(r'[^a-zA-Z0-9]', '-', title)
    out_file = OUT_DIR / f"wittsrg_{doc_id}_{ms_safe}.txt"
    
    # Skip if already downloaded with good content
    if out_file.exists():
        content = out_file.read_text()
        words = len(re.findall(r'[a-zA-Z]+', content))
        if words > 1000:
            return {"doc_id": doc_id, "title": title, "status": "skipped", "words": words}
    
    url = f"http://www.wittgensteinsource.org/agora_show_book_transcription/{doc_id}"
    
    try:
        # Navigate to transcription page
        await page.goto(url, wait_until="domcontentloaded", timeout=15000)
        await asyncio.sleep(2)  # Wait for JS to settle
        
        all_text_parts = []
        
        # Find all transcription section links in the page
        # These are the LI elements with class="transcription"
        transcription_links = await page.query_selector_all("li.transcription a")
        
        if not transcription_links:
            # Try alternative: find all links with 'transcription' text
            all_links = await page.query_selector_all("li a")
            transcription_links = []
            for link in all_links:
                text = await link.text_content()
                href = await link.get_attribute("href") or ""
                if "transcription" in text.lower() or "agora_show_full" in href:
                    transcription_links.append(link)
        
        print(f"  [{doc_id}] Found {len(transcription_links)} transcription sections")
        
        # Click each transcription section and collect text
        for i, link in enumerate(transcription_links[:20]):  # Limit to first 20 sections
            try:
                href = await link.get_attribute("href") or ""
                if "agora_show_full" not in href:
                    continue
                
                # Click the link
                await link.click()
                await asyncio.sleep(2)  # Wait for boxview content to load
                
                # After clicking, look for the boxview content
                # The content is loaded into a dialog/popup
                # Try to get text from the dialog
                dialog_text = await page.evaluate("""() => {
                    // Look for any element with substantial text content
                    // that appeared after clicking
                    const allDivs = Array.from(document.querySelectorAll('div'));
                    const textDivs = allDivs.filter(d => {
                        const text = d.textContent || '';
                        return text.length > 500 && text.length < 500000;
                    });
                    
                    // Get the largest text element
                    let largest = null;
                    let maxLen = 0;
                    for (const div of textDivs) {
                        if (div.textContent.length > maxLen) {
                            maxLen = div.textContent.length;
                            largest = div;
                        }
                    }
                    
                    if (largest) {
                        return largest.textContent || '';
                    }
                    
                    // Fallback: try to get text from any .boxview-content or .widget_content
                    const boxContent = document.querySelector('.boxview-content') ||
                                       document.querySelector('.widget_content') ||
                                       document.querySelector('.ui-dialog-content');
                    if (boxContent) {
                        return boxContent.textContent || '';
                    }
                    
                    return '';
                }""")
                
                if dialog_text and len(dialog_text) > 500:
                    all_text_parts.append(dialog_text)
                    print(f"    Section {i+1}: {len(dialog_text)} chars")
                
                # Close any open dialogs
                await page.evaluate("""() => {
                    const dialogs = document.querySelectorAll('.ui-dialog, .boxview-popup, [role="dialog"]');
                    for (const d of dialogs) { d.remove(); }
                }""")
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"    Section {i+1} error: {e}")
        
        # Also try: directly extract text from the page after waiting
        if not all_text_parts:
            page_text = await page.evaluate("""() => {
                // Get text from the main content area
                const content = document.querySelector('.pundit-content') ||
                               document.querySelector('.content') ||
                               document.body;
                return content ? content.textContent : '';
            }""")
            
            # Try to get boxview popup text
            boxview_text = await page.evaluate("""() => {
                // Look for any dynamically loaded content
                const popups = document.querySelectorAll('[class*="boxview"], [class*="popup"], [role="dialog"]');
                const texts = [];
                for (const p of popups) {
                    const text = p.textContent || '';
                    if (text.length > 500) texts.push(text);
                }
                return texts.join('\\n');
            }""")
            
            if boxview_text and len(boxview_text) > 500:
                all_text_parts.append(boxview_text)
        
        if all_text_parts:
            # Deduplicate and combine
            combined = "\n\n".join(all_text_parts)
            # Clean up
            combined = re.sub(r'\n{4,}', '\n\n\n', combined)
            combined = combined.strip()
            
            words = len(re.findall(r'[a-zA-Z]+', combined))
            
            if words > 100:
                out_file.write_text(combined)
                print(f"  [{doc_id}] {title}: {words} words -> {out_file.name}")
                return {"doc_id": doc_id, "title": title, "status": "success", "words": words}
        
        print(f"  [{doc_id}] {title}: no content extracted")
        return {"doc_id": doc_id, "title": title, "status": "no_content", "words": 0}
        
    except Exception as e:
        print(f"  [{doc_id}] {title}: ERROR {e}")
        return {"doc_id": doc_id, "title": title, "status": "error", "error": str(e)}

async def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Limit number of manuscripts to download")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between requests (seconds)")
    parser.add_argument("--resume", action="store_true", default=True, help="Resume from previous run")
    args = parser.parse_args()
    
    from playwright.async_api import async_playwright
    
    manuscripts = MANUSCRIPTS
    if args.limit > 0:
        manuscripts = manuscripts[:args.limit]
    
    log = load_log() if args.resume else {}
    results = []
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        total = len(manuscripts)
        for idx, (doc_id, title) in enumerate(manuscripts):
            print(f"[{idx+1}/{total}] Processing {title} (doc_id={doc_id})...")
            
            result = await download_wittsrg(doc_id, title, page)
            results.append(result)
            
            log[doc_id] = result
            
            # Save progress every 10 manuscripts
            if (idx + 1) % 10 == 0:
                save_log(log)
                print(f"  [PROGRESS] Saved log at {idx+1}/{total}")
            
            await asyncio.sleep(args.delay)
        
        await browser.close()
    
    # Final save
    save_log(log)
    
    # Summary
    success = sum(1 for r in results if r["status"] == "success")
    skipped = sum(1 for r in results if r["status"] == "skipped")
    errors = sum(1 for r in results if r["status"] in ("error", "no_content"))
    total_words = sum(r.get("words", 0) for r in results)
    
    print(f"\n=== FINAL SUMMARY ===")
    print(f"  Success: {success}")
    print(f"  Skipped: {skipped}")
    print(f"  Errors/No content: {errors}")
    print(f"  Total words: {total_words:,}")
    
    # Update corpus report
    update_corpus_report(results)

def update_corpus_report(results):
    """Update the corpus manifest and report with WittSrc downloads."""
    manifest_path = Path("/Users/john/蒸馏2/corpus/wittgenstein/manifest.json")
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
        wittsrgs = [r for r in results if r.get("status") == "success"]
        wittsrgs_words = sum(r.get("words", 0) for r in wittsrgs)
        
        manifest["wittsrgDownload"] = {
            "timestamp": datetime.now().isoformat(),
            "totalManuscripts": len(results),
            "successCount": sum(1 for r in results if r["status"] == "success"),
            "totalWordsFromWittSrc": wittsrgs_words,
            "results": results,
        }
        manifest_path.write_text(json.dumps(manifest, indent=2))
        print(f"\nUpdated manifest.json with WittSrc download results")

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--install":
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "playwright"])
        subprocess.run(["playwright", "install", "chromium"])
    else:
        asyncio.run(main())
