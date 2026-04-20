#!/usr/bin/env python3
"""Extract plain text from WAB TEI XML files"""
import re
from pathlib import Path

TEI_NS = "http://www.tei-c.org/ns/1.0"

def extract_text_from_tei(xml_content):
    """Extract text from TEI XML, handling various element types."""
    import xml.etree.ElementTree as ET
    
    try:
        root = ET.fromstring(xml_content)
    except Exception as e:
        # Try to fix common XML issues
        # Remove oxygen processing instructions that can cause issues
        cleaned = re.sub(r'<\?oxygen[^?]*\?>', '', xml_content)
        try:
            root = ET.fromstring(cleaned)
        except Exception as e2:
            # Fallback: strip all tags manually
            text = re.sub(r'<[^>]+>', '', xml_content)
            text = re.sub(r'\s+', ' ', text).strip()
            return text, 0
    
    total_words = 0
    parts = []
    
    # Find all text-bearing elements
    # TEI structure: TEI > teiHeader (skip) > text > body > p/ab/div...
    # Also handles: text > group > text > body > ...
    
    # Get the body content
    body_content = []
    
    # Handle namespace
    ns = {'tei': TEI_NS}
    
    # Try to find body
    body = root.find(f'.//{{{TEI_NS}}}body')
    if body is None:
        body = root.find('.//body')  # Try without namespace
    
    if body is not None:
        # Extract text from body, preserving some structure
        for elem in body.iter():
            tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            
            # Skip header/metadata elements
            if tag in ('teiHeader', 'fileDesc', 'encodingDesc', 'profileDesc', 
                       'revisionDesc', 'titleStmt', 'publicationStmt', 'sourceDesc',
                       'biblFull', 'bibl', 'note', 'figDesc', 'head', 'docAuthor'):
                continue
            
            # Get text content of this element
            text = ''.join(elem.itertext())
            text = text.strip()
            
            if text and len(text) > 2:
                # Add paragraph breaks for block elements
                if tag in ('p', 'ab', 'sp', 'stage', 'seg'):
                    if parts and not parts[-1].endswith('\n'):
                        parts.append('')
                    parts.append(text)
                elif tag in ('div', 'lg', 'l'):
                    parts.append('')
                    parts.append(text)
                    parts.append('')
                elif tag in ('item', 'label'):
                    parts.append('• ' + text)
                else:
                    parts.append(text)
    
    # Also try text element directly
    if not parts:
        text_elem = root.find(f'.//{{{TEI_NS}}}text')
        if text_elem is None:
            text_elem = root.find('.//text')
        if text_elem is not None:
            for elem in text_elem.iter():
                tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                if tag in ('teiHeader', 'fileDesc', 'encodingDesc', 'profileDesc',
                           'revisionDesc', 'titleStmt', 'publicationStmt', 'sourceDesc',
                           'biblFull', 'bibl', 'note', 'figDesc', 'head'):
                    continue
                text = ''.join(elem.itertext()).strip()
                if text and len(text) > 2:
                    parts.append(text)
    
    combined = '\n\n'.join(parts)
    combined = re.sub(r'\n{4,}', '\n\n\n', combined)
    
    words = len(re.findall(r'[a-zA-Z]+', combined))
    return combined, words

def process_directory(xml_dir, txt_dir):
    """Process all XML files in a directory."""
    xml_dir = Path(xml_dir)
    txt_dir = Path(txt_dir)
    txt_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    total_words = 0
    
    xml_files = sorted(xml_dir.glob("*.xml"))
    print(f"Processing {len(xml_files)} XML files...")
    
    for xml_path in xml_files:
        print(f"  Processing {xml_path.name}...", end='', flush=True)
        
        try:
            content = xml_path.read_text(encoding='utf-8')
            text, words = extract_text_from_tei(content)
            
            if words < 100:
                # Try fallback regex approach
                text_fb = re.sub(r'<[^>]+>', ' ', content)
                text_fb = re.sub(r'\s+', ' ', text_fb).strip()
                # Remove TEI header
                header_end = text_fb.find('<text>')
                if header_end > 0:
                    text_fb = text_fb[header_end:]
                text_fb = re.sub(r'<[^>]+>', ' ', text_fb)
                text_fb = re.sub(r'\s+', ' ', text_fb).strip()
                text_fb = re.sub(r'\b\w+\b(?:\s+\1\b){3,}', '', text_fb)  # Remove repeating words
                words_fb = len(re.findall(r'[a-zA-Z]+', text_fb))
                if words_fb > words:
                    text = text_fb
                    words = words_fb
            
            txt_name = xml_path.stem + '.txt'
            txt_path = txt_dir / txt_name
            txt_path.write_text(text, encoding='utf-8')
            
            total_words += words
            results.append((xml_path.name, txt_name, words))
            print(f" ✅ {words:,} words -> {txt_name}")
            
        except Exception as e:
            print(f" ❌ Error: {e}")
            results.append((xml_path.name, None, 0))
    
    print(f"\nTotal: {total_words:,} words from {len(xml_files)} files")
    return results, total_words

if __name__ == '__main__':
    import sys
    xml_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/Users/john/蒸馏2/corpus/wittgenstain/wab_xml")
    txt_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("/Users/john/蒸馏2/corpus/wittgenstain/texts")
    results, total = process_directory(xml_dir, txt_dir)
    print(f"\nExtracted {total:,} words")
