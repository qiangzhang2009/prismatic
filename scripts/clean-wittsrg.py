#!/usr/bin/env python3
"""
Clean WittSrc extracted text files.
Removes HTML artifacts, page metadata, and normalizes whitespace.
"""
import os
import re

OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg'

def clean_text(text):
    """Clean HTML artifacts from WittSrc extracted text."""
    if not text:
        return text
    
    # Remove HTML tags if any slipped through
    text = re.sub(r'<[^>]+>', ' ', text)
    
    # Remove HTML entities
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&#[0-9]+;', ' ', text)
    text = re.sub(r'&#x[0-9a-fA-F]+;', ' ', text)
    
    # Remove Unicode control/formatting characters
    text = re.sub(r'[\u200b-\u200f\u2028-\u202f\ufeff]', '', text)
    text = re.sub(r'[\ufffc-\uffff]', '', text)
    
    # Remove "Collapse" and "Drag" labels
    text = re.sub(r'\bCollapse\b', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\bDrag\b', '', text, flags=re.IGNORECASE)
    
    # Remove page numbers / folio numbers (e.g., "1r[1]", "IV[1]")
    text = re.sub(r'[0-9]+[rv]\[[0-9]+\]', '', text)
    
    # Remove URL fragments
    text = re.sub(r'http[s]?://\S+', '', text)
    
    # Remove boxview / citation metadata lines
    text = re.sub(r'Wittgenstein Source Bergen Nachlass Edition.*', '', text)
    text = re.sub(r'Bergen.*WAB.*', '', text)
    text = re.sub(r'BOXVIEW:.*', '', text)
    text = re.sub(r'RDF:.*', '', text)
    text = re.sub(r'JSON:.*', '', text)
    text = re.sub(r'To cite.*', '', text)
    text = re.sub(r'\(2015–\).*Pichler.*', '', text)
    text = re.sub(r'In: Wittgenstein Source, curated by.*', '', text)
    
    # Remove line numbers and page references
    text = re.sub(r'^\s*[0-9]+\s*$', '', text, flags=re.MULTILINE)
    
    # Clean whitespace
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    
    return text

def process_file(filepath):
    """Clean a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_len = len(content)
    cleaned = clean_text(content)
    cleaned_len = len(cleaned)
    
    if cleaned_len < original_len * 0.9:
        # Significant cleaning happened
        print(f"  Cleaned {os.path.basename(filepath)}: {original_len} -> {cleaned_len} chars")
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    
    return cleaned_len

def main():
    files = [f for f in os.listdir(OUT_DIR) if f.endswith('.txt')]
    print(f"Cleaning {len(files)} files in {OUT_DIR}")
    
    total_original = 0
    total_cleaned = 0
    
    for i, f in enumerate(sorted(files)):
        filepath = os.path.join(OUT_DIR, f)
        try:
            with open(filepath, 'r', encoding='utf-8') as fh:
                content = fh.read()
            
            original_len = len(content)
            cleaned = clean_text(content)
            cleaned_len = len(cleaned)
            
            total_original += original_len
            total_cleaned += cleaned_len
            
            # Only save if content changed
            if cleaned != content:
                with open(filepath, 'w', encoding='utf-8') as fh:
                    fh.write(cleaned)
                print(f"[{i+1}/{len(files)}] {f}: {original_len} -> {cleaned_len} chars")
        except Exception as e:
            print(f"Error processing {f}: {e}")
    
    print(f"\nTotal: {total_original} -> {total_cleaned} chars (saved {total_original - total_cleaned})")

if __name__ == '__main__':
    main()
