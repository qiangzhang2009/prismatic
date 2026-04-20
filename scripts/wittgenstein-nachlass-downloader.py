#!/usr/bin/env python3
"""
Wittgenstein Nachlass Comprehensive Downloader
==========================================
Downloads ALL available Wittgenstein Nachlass texts from multiple sources:

1. CLARINO Repository (CC BY-NC 3.0):
   - 19 manuscripts from the CC-licensed subset
   - XML TEI format, ~5M words from character-entity converted version

2. WAB Bergen Direct XML (CC BY-NC 3.0):
   - Same 19 manuscripts via direct XML download
   - Raw TEI format, ~3.6M words

3. WittSrc Bergen Nachlass Edition (requires browser automation):
   - 162 manuscripts via jQuery boxview dynamic loading
   - Requires Playwright for JavaScript execution
   - ~20,000 pages of the complete Nachlass

Usage:
    python3 wittgenstein_nachlass_downloader.py [--clarino] [--wab] [--wab-idp] [--all]

Output:
    corpus/wittgenstein/
    ├── wab_xml/          # Raw WAB XML files
    ├── texts/             # Extracted plain text files
    └── REPORT.md          # Download report
"""
import re, ssl, urllib.request, zipfile, io, json, os, sys, time
from pathlib import Path
from datetime import datetime
import xml.etree.ElementTree as ET

# ─── Configuration ───────────────────────────────────────────────────────────────

OUT_DIR = Path("/Users/john/蒸馏2/corpus/wittgenstain")
OUT_DIR.mkdir(parents=True, exist_ok=True)
TEXT_DIR = OUT_DIR / "texts"
XML_DIR = OUT_DIR / "wab_xml"
TEXT_DIR.mkdir(exist_ok=True)
XML_DIR.mkdir(exist_ok=True)

REPORT_FILE = OUT_DIR / "DOWNLOAD_REPORT.md"
MANIFEST_FILE = OUT_DIR / "manifest.json"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

# ─── HTTP Utilities ────────────────────────────────────────────────────────────

def fetch(url, timeout=30, is_binary=False):
    """Fetch a URL and return content."""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            data = resp.read()
            if is_binary:
                return data
            return data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  ERROR {url[:60]}: {e}")
        return None

def fetch_head(url, timeout=5):
    """Check if a URL exists via HEAD request."""
    try:
        req = urllib.request.Request(url, headers=HEADERS, method='HEAD')
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return {
                'size': int(resp.headers.get('Content-Length', 0)),
                'type': resp.headers.get('Content-Type', ''),
                'ok': True
            }
    except:
        return {'ok': False}

def count_words(text):
    return len(re.findall(r'[a-zA-Z]+', text))

# ─── TEI XML Extraction ──────────────────────────────────────────────────────

TEI_NS = "http://www.tei-c.org/ns/1.0"
SKIP_TAGS = {
    'teiHeader', 'fileDesc', 'encodingDesc', 'profileDesc', 'revisionDesc',
    'titleStmt', 'publicationStmt', 'sourceDesc', 'biblFull', 'bibl', 'note',
    'figDesc', 'head', 'docAuthor', 'teiCorpus', 'standOff', 'listChange'
}

def extract_text_from_tei(xml_content):
    """Extract plain text from TEI XML, handling namespaces and structure."""
    try:
        cleaned = re.sub(r'<\?oxygen[^?]*\?>', '', xml_content)
        root = ET.fromstring(cleaned)
    except Exception as e:
        text = re.sub(r'<[^>]+>', ' ', xml_content)
        text = re.sub(r'\s+', ' ', text).strip()
        return text, 0
    
    parts = []
    
    # Try body element
    body = root.find(f'.//{{{TEI_NS}}}body')
    if body is None:
        body = root.find('.//body')
    
    if body is not None:
        for elem in body.iter():
            tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            if tag in SKIP_TAGS:
                continue
            text = ''.join(elem.itertext()).strip()
            if text and len(text) > 2:
                parts.append(text)
    
    if not parts:
        for elem in root.iter():
            tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            if tag in SKIP_TAGS:
                continue
            text = ''.join(elem.itertext()).strip()
            if text and len(text) > 2:
                parts.append(text)
    
    combined = '\n\n'.join(parts)
    combined = re.sub(r'\n{4,}', '\n\n\n', combined)
    return combined.strip(), count_words(combined)

# ─── Source 1: CLARINO ZIP Download ───────────────────────────────────────────

def download_clarino():
    """Download CLARINO CC-licensed XML subset from ZIP."""
    print("\n" + "="*60)
    print("SOURCE 1: CLARINO Repository (CC BY-NC 3.0)")
    print("="*60)
    
    zip_urls = [
        (
            "Set1a (character entities converted)",
            "https://repo.clarino.uib.no/xmlui/bitstream/handle/11509/143/"
            "WAB%20XML%20Clarino-CC%20Set1a%20character%20entitities%20"
            "converted.zip?sequence=3&isAllowed=y"
        ),
        (
            "Set1b (character entities not converted)",
            "https://repo.clarino.uib.no/xmlui/bitstream/handle/11509/143/"
            "WAB%20XML%20Clarino-CC%20Set1b%20character%20entitities%20"
            "not%20converted.zip?sequence=5&isAllowed=y"
        ),
    ]
    
    results = []
    total_words = 0
    
    for set_name, zip_url in zip_urls:
        print(f"\n  Downloading {set_name}...")
        data = fetch(zip_url, timeout=120, is_binary=True)
        if not data:
            print(f"  ❌ Failed to download {set_name}")
            continue
        
        print(f"  Downloaded: {len(data)/1024/1024:.1f} MB")
        
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for name in zf.namelist():
                    if not name.endswith('.xml'):
                        continue
                    
                    xml_content = zf.read(name).decode('utf-8', errors='replace')
                    text, words = extract_text_from_tei(xml_content)
                    
                    basename = Path(name).stem.replace('_Clarino-CC', '').replace('_converted', '')
                    safe_name = re.sub(r'[^a-zA-Z0-9_-]', '-', basename)
                    
                    # Skip if we already have a better version
                    existing_path = TEXT_DIR / f"wab_{safe_name}.txt"
                    if existing_path.exists():
                        existing_words = count_words(existing_path.read_text())
                        if existing_words >= words * 0.9:
                            print(f"    ⏭️  {safe_name}: already have {existing_words:,} words")
                            total_words += existing_words
                            results.append({'source': 'clarino', 'set': set_name, 'file': name, 
                                         'words': existing_words, 'status': 'skipped'})
                            continue
                    
                    out_path = TEXT_DIR / f"wab_{safe_name}.txt"
                    out_path.write_text(text, encoding='utf-8')
                    total_words += words
                    results.append({'source': 'clarino', 'set': set_name, 'file': name,
                                 'words': words, 'status': 'success'})
                    print(f"    ✅ {safe_name}: {words:,} words")
        except Exception as e:
            print(f"  ❌ Error extracting {set_name}: {e}")
    
    print(f"\n  CLARINO Total: {total_words:,} words")
    return results, total_words

# ─── Source 2: WAB Direct XML Download ──────────────────────────────────────

# 19 CC-licensed manuscripts available as direct XML
WAB_XML_MANUSCRIPTS = [
    "Ts-201a1", "Ts-201a2", "Ms-139a", "Ts-207",
    "Ms-114", "Ms-115", "Ms-153a", "Ms-153b",
    "Ms-154", "Ms-155", "Ms-156a", "Ms-148",
    "Ms-149", "Ms-150", "Ts-212", "Ts-213",
    "Ms-141", "Ms-152", "Ts-310",
]

def download_wab_xml():
    """Download WAB XML files directly."""
    print("\n" + "="*60)
    print("SOURCE 2: WAB Bergen Direct XML")
    print("="*60)
    
    BASE = "http://wab.uib.no/cost-a32_xml"
    results = []
    total_words = 0
    total_size = 0
    
    for ms in WAB_XML_MANUSCRIPTS:
        url = f"{BASE}/{ms}_OA.xml"
        out_path = XML_DIR / f"{ms}.xml"
        
        # Skip if exists
        if out_path.exists() and out_path.stat().st_size > 1000:
            content = out_path.read_bytes()
            text, words = extract_text_from_tei(content.decode('utf-8', errors='replace'))
            total_words += words
            total_size += len(content)
            results.append({'ms': ms, 'words': words, 'size': len(content), 'status': 'skipped'})
            print(f"  ⏭️  {ms}: already downloaded ({words:,} words)")
            continue
        
        print(f"  Downloading {ms}...", end='', flush=True)
        data = fetch(url, timeout=60, is_binary=True)
        if data and len(data) > 5000:
            out_path.write_bytes(data)
            text, words = extract_text_from_tei(data.decode('utf-8', errors='replace'))
            
            # Save text
            txt_path = TEXT_DIR / f"wab_{ms}.txt"
            txt_path.write_text(text, encoding='utf-8')
            
            total_words += words
            total_size += len(data)
            results.append({'ms': ms, 'words': words, 'size': len(data), 'status': 'success'})
            print(f" ✅ {words:,} words ({len(data)/1024:.0f} KB)")
        else:
            results.append({'ms': ms, 'words': 0, 'size': 0, 'status': 'failed'})
            print(f" ❌ failed")
    
    print(f"\n  WAB XML Total: {total_words:,} words, {total_size/1024/1024:.1f} MB")
    return results, total_words

# ─── Source 3: WittSrc Bergen Nachlass Edition ────────────────────────────────
# Requires Playwright browser automation (jQuery boxview system)

WITTSRC_MANUSCRIPTS = [
    # (doc_id, title)
    ("31","Ms-101"), ("32","Ms-102"), ("33","Ms-103"), ("167","Ms-104"),
    ("71","Ms-105"), ("72","Ms-106"), ("73","Ms-107"), ("34","Ms-108"),
    ("35","Ms-109"), ("36","Ms-110"), ("37","Ms-111"), ("168","Ms-112"),
    ("169","Ms-113"), ("12","Ms-114"), ("1","Ms-115"), ("140","Ms-116"),
    ("141","Ms-117"), ("38","Ms-118"), ("142","Ms-119"), ("39","Ms-120"),
    ("40","Ms-121"), ("41","Ms-122"), ("42","Ms-123"), ("143","Ms-124"),
    ("43","Ms-125"), ("144","Ms-126"), ("145","Ms-127"), ("146","Ms-128"),
    ("147","Ms-129"), ("170","Ms-130"), ("148","Ms-131"), ("149","Ms-132"),
    ("44","Ms-133"), ("171","Ms-134"), ("45","Ms-135"), ("150","Ms-136"),
    ("151","Ms-137"), ("152","Ms-138"), ("4","Ms-139a"), ("83","Ms-139b"),
    ("13","Ms-140"), ("14","Ms-141"), ("84","Ms-142"), ("46","Ms-143"),
    ("74","Ms-144"), ("85","Ms-145"), ("86","Ms-146"), ("47","Ms-147"),
    ("15","Ms-148"), ("16","Ms-149"), ("17","Ms-150"), ("48","Ms-151"),
    ("18","Ms-152"), ("8","Ms-153a"), ("9","Ms-153b"), ("10","Ms-154"),
    ("11","Ms-155"), ("19","Ms-156a"), ("87","Ms-156b"), ("153","Ms-157a"),
    ("49","Ms-157b"), ("50","Ms-158"), ("51","Ms-159"), ("154","Ms-160"),
    ("155","Ms-161"), ("52","Ms-162a"), ("53","Ms-162b"), ("54","Ms-163"),
    ("55","Ms-164"), ("56","Ms-165"), ("57","Ms-166"), ("58","Ms-167"),
    ("59","Ms-168"), ("60","Ms-169"), ("61","Ms-170"), ("88","Ms-171"),
    ("89","Ms-172"), ("62","Ms-173"), ("63","Ms-174"), ("64","Ms-175"),
    ("65","Ms-176"), ("66","Ms-177"), ("90","Ms-178a"), ("91","Ms-178b"),
    ("92","Ms-178c"), ("93","Ms-178d"), ("94","Ms-178e"), ("95","Ms-178f"),
    ("96","Ms-178g"), ("97","Ms-178h"), ("67","Ms-179"), ("98","Ms-180a"),
    ("68","Ms-180b"), ("69","Ms-181"), ("70","Ms-182"), ("75","Ms-183"),
    ("2","Ts-201a1"), ("3","Ts-201a2"), ("172","Ts-202"), ("76","Ts-203"),
    ("77","Ts-204"), ("182","Ts-205"), ("99","Ts-206"), ("20","Ts-207"),
    ("100","Ts-208"), ("101","Ts-209"), ("102","Ts-210"), ("183","Ts-211"),
    ("6","Ts-212"), ("5","Ts-213"), ("103","Ts-214a1"), ("105","Ts-214b1"),
    ("107","Ts-214c1"), ("109","Ts-215a"), ("110","Ts-215b"), ("184","Ts-215c"),
    ("111","Ts-216"), ("112","Ts-217"), ("113","Ts-218"), ("114","Ts-219"),
    ("115","Ts-220"), ("116","Ts-221a"), ("156","Ts-222"), ("118","Ts-223"),
    ("119","Ts-224"), ("120","Ts-225"), ("121","Ts-226"), ("122","Ts-227a"),
    ("185","Ts-227b"), ("123","Ts-228"), ("124","Ts-229"), ("125","Ts-230a"),
    ("186","Ts-230b"), ("187","Ts-230c"), ("126","Ts-231"), ("127","Ts-232"),
    ("173","Ts-233a"), ("174","Ts-233b"), ("128","Ts-235"), ("129","Ts-236"),
    ("130","Ts-237"), ("131","Ts-238"), ("132","Ts-239"), ("133","Ts-240"),
    ("134","Ts-241a"), ("135","Ts-241b"), ("188","Ts-242a"), ("196","Ts-242b"),
    ("136","Ts-243"), ("137","Ts-244"), ("138","Ts-245"), ("78","Ts-247"),
    ("197","Ts-248"), ("189","Ms-301"), ("190","Ts-302"), ("191","Ts-303"),
    ("192","Ts-304"), ("193","Ms-305"), ("194","Ts-306"), ("195","Ts-309"),
    ("7","Ts-310"), ("21","Legend"),
]

def download_wittsrg():
    """
    WittSrc Bergen Nachlass Edition.
    
    NOTE: This requires Playwright browser automation. The WittSrc uses a 
    jQuery 1.3.2 boxview system that dynamically loads transcription content.
    Without a real browser's JavaScript execution, we cannot extract text.
    
    To download WittSrc manuscripts:
    1. Use Playwright in a real browser
    2. Navigate to: http://www.wittgensteinsource.org/
    3. Click "Bergen Nachlass Edition (BNE)"
    4. Click each manuscript's transcription
    5. Extract text from the boxview popup
    
    Total manuscripts available: 162
    - Ms-101 to Ms-183 (manuscripts)
    - Ts-201a to Ts-310 (typescripts)
    """
    print("\n" + "="*60)
    print("SOURCE 3: WittSrc Bergen Nachlass Edition (NOT AUTOMATED)")
    print("="*60)
    print(f"""
    WittSrc Bergen Nachlass Edition (wittgensteinsource.org) contains
    the COMPLETE Nachlass but requires JavaScript browser automation.

    Architecture:
    - jQuery 1.3.2 boxview system for dynamic content loading
    - Transcription content loaded via AJAX into popup widgets
    - No static HTML/XML endpoints accessible via HTTP
    
    To download:
    1. Open wittgensteinsource.org in a real browser
    2. Navigate to Bergen Nachlass Edition
    3. For each manuscript: click "Normalized" or "Diplomatic" transcription
    4. Copy text from the popup widget
    
    Manuscripts available: {len(WITTSRC_MANUSCRIPTS)}
    Total Nachlass pages: ~20,000
    """)
    return [], 0

# ─── Progress & Manifest ───────────────────────────────────────────────────

def save_manifest(clarino_res, wab_res, wab_total, wittsrg_res):
    manifest = {
        'generatedAt': datetime.now().isoformat(),
        'sources': {
            'clarino': {
                'name': 'CLARINO Repository (CC BY-NC 3.0)',
                'description': '19 CC-licensed manuscripts from WAB XML',
                'totalWords': sum(r.get('words', 0) for r in clarino_res),
                'files': clarino_res,
            },
            'wab_xml': {
                'name': 'WAB Bergen Direct XML',
                'description': '19 CC-licensed manuscripts as raw XML',
                'totalWords': wab_total,
                'files': wab_res,
            },
            'wittsrg': {
                'name': 'WittSrc Bergen Nachlass Edition',
                'description': '162 manuscripts via JavaScript boxview (NOT AUTOMATED)',
                'totalWords': 0,
                'manuscripts': len(WITTSRC_MANUSCRIPTS),
            }
        },
        'witgsrcManuscripts': WITTSRC_MANUSCRIPTS,
    }
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"Manifest saved: {MANIFEST_FILE}")

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Download Wittgenstein Nachlass texts')
    parser.add_argument('--all', action='store_true', help='Download all sources')
    parser.add_argument('--clarino', action='store_true', help='Download CLARINO ZIP')
    parser.add_argument('--wab-xml', action='store_true', help='Download WAB XML')
    parser.add_argument('--wittsrg', action='store_true', help='Show WittSrc info')
    args = parser.parse_args()
    
    if not any([args.all, args.clarino, getattr(args, 'wab_xml', False), args.wittsrg]):
        args.all = True  # Default: download all available
    
    print(f"\nWittgenstein Nachlass Downloader")
    print(f"Output directory: {OUT_DIR}")
    print(f"Started: {datetime.now()}")
    
    clarino_results, clarino_words = [], 0
    wab_results, wab_words = [], 0
    
    if args.all or args.clarino:
        clarino_results, clarino_words = download_clarino()
    
    if args.all or getattr(args, 'wab_xml', False):
        wab_results, wab_words = download_wab_xml()
    
    if args.all or args.wittsrg:
        download_wittsrg()
    
    save_manifest(clarino_results, wab_results, wab_words, [])
    
    print(f"\n{'='*60}")
    print(f"COMPLETE")
    print(f"{'='*60}")
    print(f"CLARINO: {clarino_words:,} words")
    print(f"WAB XML:  {wab_words:,} words")
    print(f"Total:   {clarino_words + wab_words:,} words")

if __name__ == '__main__':
    main()
