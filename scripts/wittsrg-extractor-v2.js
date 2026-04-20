#!/usr/bin/env node
/**
 * WittSrc BNE Batch Extractor v2
 * ================================
 * Uses bb-browser (real Chrome) to extract Wittgenstein Nachlass manuscripts.
 * 
 * IMPORTANT: Run with Node.js 18+ for proper ESM support.
 * 
 * Usage:
 *   node wittsrg-extractor-v2.js [--dry-run] [--start N] [--end N] [--parallel]
 * 
 * Prerequisites:
 *   npm install -g bb-browser
 *   bb-browser daemon start   # Must already be running
 */
import { spawn } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

// ─── Configuration ─────────────────────────────────────────────────────────────

const OUT_DIR = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg';
const LOG_FILE = '/Users/john/蒸馏2/corpus/wittgenstain/wittsrg/extraction-log.txt';

// Ensure output directory
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ─── Catalog ──────────────────────────────────────────────────────────────────

const MANUSCRIPTS = [
    { docId: "31",  ms: "Ms-101"    },
    { docId: "32",  ms: "Ms-102"    },
    { docId: "33",  ms: "Ms-103"    },
    { docId: "167", ms: "Ms-104"    },
    { docId: "71",  ms: "Ms-105"    },
    { docId: "72",  ms: "Ms-106"    },
    { docId: "73",  ms: "Ms-107"    },
    { docId: "34",  ms: "Ms-108"    },
    { docId: "35",  ms: "Ms-109"    },
    { docId: "36",  ms: "Ms-110"    },
    { docId: "37",  ms: "Ms-111"    },
    { docId: "168", ms: "Ms-112"    },
    { docId: "169", ms: "Ms-113"    },
    { docId: "12",  ms: "Ms-114"    },  // CC licensed, already have
    { docId: "1",   ms: "Ms-115"    },  // CC licensed, already have
    { docId: "140", ms: "Ms-116"    },
    { docId: "141", ms: "Ms-117"    },
    { docId: "38",  ms: "Ms-118"    },
    { docId: "142", ms: "Ms-119"    },
    { docId: "39",  ms: "Ms-120"    },
    { docId: "40",  ms: "Ms-121"    },
    { docId: "41",  ms: "Ms-122"    },
    { docId: "42",  ms: "Ms-123"    },
    { docId: "143", ms: "Ms-124"    },
    { docId: "44",  ms: "Ms-125"    },
    { docId: "144", ms: "Ms-126"    },
    { docId: "145", ms: "Ms-127"    },
    { docId: "146", ms: "Ms-128"    },
    { docId: "147", ms: "Ms-129"    },
    { docId: "170", ms: "Ms-130"    },
    { docId: "148", ms: "Ms-131"    },
    { docId: "149", ms: "Ms-132"    },
    { docId: "45",  ms: "Ms-133"    },
    { docId: "171", ms: "Ms-134"    },
    { docId: "46",  ms: "Ms-135"    },
    { docId: "151", ms: "Ms-136"    },
    { docId: "152", ms: "Ms-137"    },
    { docId: "153", ms: "Ms-138"    },
    { docId: "4",   ms: "Ms-139a"  },  // CC licensed
    { docId: "83",  ms: "Ms-139b"  },
    { docId: "13",  ms: "Ms-140"    },  // CC licensed
    { docId: "14",  ms: "Ms-141"   },  // CC licensed
    { docId: "84",  ms: "Ms-142"    },
    { docId: "47",  ms: "Ms-143"    },
    { docId: "74",  ms: "Ms-144"    },
    { docId: "85",  ms: "Ms-145"    },
    { docId: "86",  ms: "Ms-146"    },
    { docId: "48",  ms: "Ms-147"    },
    { docId: "15",  ms: "Ms-148"    },  // CC licensed
    { docId: "16",  ms: "Ms-149"    },  // CC licensed
    { docId: "17",  ms: "Ms-150"    },  // CC licensed
    { docId: "49",  ms: "Ms-151"    },
    { docId: "18",  ms: "Ms-152"    },  // CC licensed
    { docId: "8",   ms: "Ms-153a"  },  // CC licensed
    { docId: "9",   ms: "Ms-153b"  },  // CC licensed
    { docId: "10",  ms: "Ms-154"    },  // CC licensed
    { docId: "11",  ms: "Ms-155"    },  // CC licensed
    { docId: "19",  ms: "Ms-156a"  },  // CC licensed
    { docId: "87",  ms: "Ms-156b"  },
    { docId: "154", ms: "Ms-157a"  },
    { docId: "50",  ms: "Ms-157b"  },
    { docId: "51",  ms: "Ms-158"    },
    { docId: "52",  ms: "Ms-159"    },
    { docId: "155", ms: "Ms-160"    },
    { docId: "156", ms: "Ms-161"    },
    { docId: "53",  ms: "Ms-162a"  },
    { docId: "54",  ms: "Ms-162b"  },
    { docId: "55",  ms: "Ms-163"    },
    { docId: "56",  ms: "Ms-164"    },
    { docId: "57",  ms: "Ms-165"    },
    { docId: "58",  ms: "Ms-166"    },
    { docId: "59",  ms: "Ms-167"    },
    { docId: "60",  ms: "Ms-168"    },
    { docId: "61",  ms: "Ms-169"    },
    { docId: "62",  ms: "Ms-170"    },
    { docId: "88",  ms: "Ms-171"    },
    { docId: "89",  ms: "Ms-172"    },
    { docId: "63",  ms: "Ms-173"    },
    { docId: "64",  ms: "Ms-174"    },
    { docId: "65",  ms: "Ms-175"    },
    { docId: "66",  ms: "Ms-176"    },
    { docId: "67",  ms: "Ms-177"    },
    { docId: "90",  ms: "Ms-178a"  },
    { docId: "91",  ms: "Ms-178b"  },
    { docId: "92",  ms: "Ms-178c"  },
    { docId: "93",  ms: "Ms-178d"  },
    { docId: "94",  ms: "Ms-178e"  },
    { docId: "95",  ms: "Ms-178f"  },
    { docId: "96",  ms: "Ms-178g"  },
    { docId: "97",  ms: "Ms-178h"  },
    { docId: "68",  ms: "Ms-179"    },
    { docId: "98",  ms: "Ms-180a"  },
    { docId: "69",  ms: "Ms-180b"  },
    { docId: "70",  ms: "Ms-181"    },
    { docId: "75",  ms: "Ms-182"    },
    { docId: "76",  ms: "Ms-183"    },
    { docId: "2",   ms: "Ts-201a1" },  // CC licensed
    { docId: "3",   ms: "Ts-201a2" },  // CC licensed
    { docId: "172", ms: "Ts-202"    },
    { docId: "78",  ms: "Ts-203"    },
    { docId: "79",  ms: "Ts-204"    },
    { docId: "182", ms: "Ts-205"    },
    { docId: "99",  ms: "Ts-206"    },
    { docId: "20",  ms: "Ts-207"    },  // CC licensed
    { docId: "100", ms: "Ts-208"    },
    { docId: "101", ms: "Ts-209"    },
    { docId: "102", ms: "Ts-210"    },
    { docId: "183", ms: "Ts-211"    },
    { docId: "6",   ms: "Ts-212"   },  // CC licensed - THE KEY ONE
    { docId: "5",   ms: "Ts-213"   },  // CC licensed - THE KEY ONE
    { docId: "103", ms: "Ts-214a1" },
    { docId: "105", ms: "Ts-214b1" },
    { docId: "107", ms: "Ts-214c1" },
    { docId: "109", ms: "Ts-215a"  },
    { docId: "110", ms: "Ts-215b"  },
    { docId: "184", ms: "Ts-215c"  },
    { docId: "111", ms: "Ts-216"    },
    { docId: "112", ms: "Ts-217"    },
    { docId: "113", ms: "Ts-218"    },
    { docId: "114", ms: "Ts-219"    },
    { docId: "115", ms: "Ts-220"    },
    { docId: "116", ms: "Ts-221a"  },
    { docId: "156", ms: "Ts-222"    },
    { docId: "118", ms: "Ts-223"    },
    { docId: "119", ms: "Ts-224"    },
    { docId: "120", ms: "Ts-225"    },
    { docId: "121", ms: "Ts-226"    },
    { docId: "122", ms: "Ts-227a"  },
    { docId: "185", ms: "Ts-227b"  },
    { docId: "123", ms: "Ts-228"    },
    { docId: "124", ms: "Ts-229"    },
    { docId: "125", ms: "Ts-230a"  },
    { docId: "186", ms: "Ts-230b"  },
    { docId: "187", ms: "Ts-230c"  },
    { docId: "126", ms: "Ts-231"    },
    { docId: "127", ms: "Ts-232"    },
    { docId: "173", ms: "Ts-233a"  },
    { docId: "174", ms: "Ts-233b"  },
    { docId: "128", ms: "Ts-235"    },
    { docId: "129", ms: "Ts-236"    },
    { docId: "130", ms: "Ts-237"    },
    { docId: "131", ms: "Ts-238"    },
    { docId: "132", ms: "Ts-239"    },
    { docId: "133", ms: "Ts-240"    },
    { docId: "134", ms: "Ts-241a"  },
    { docId: "135", ms: "Ts-241b"  },
    { docId: "188", ms: "Ts-242a"  },
    { docId: "196", ms: "Ts-242b"  },
    { docId: "136", ms: "Ts-243"    },
    { docId: "137", ms: "Ts-244"    },
    { docId: "138", ms: "Ts-245"    },
    { docId: "139", ms: "Ts-246"    },
    { docId: "197", ms: "Ts-248"    },
    { docId: "189", ms: "Ms-301"   },
    { docId: "190", ms: "Ts-302"    },
    { docId: "191", ms: "Ts-303"    },
    { docId: "192", ms: "Ts-304"    },
    { docId: "193", ms: "Ms-305"   },
    { docId: "194", ms: "Ts-306"    },
    { docId: "195", ms: "Ts-309"    },
    { docId: "7",   ms: "Ts-310"   },  // CC licensed
    { docId: "21",  ms: "Legend"    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Run bb-browser command using spawn, capturing output. */
function bb(...args) {
    return new Promise((resolve) => {
        const proc = spawn('bb-browser', args, {
            timeout: 60000,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '', stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code });
        });
        proc.on('error', (e) => {
            resolve({ stdout: '', stderr: String(e), code: -1 });
        });
    });
}

/** Run bb-browser eval with proper JS code */
async function bbEval(jsCode, timeoutMs = 30000) {
    const result = await bb('eval', jsCode);
    return result.stdout;
}

/** Sleep helper */
const sleep = (sec) => new Promise(r => setTimeout(r, sec * 1000));

/** Open URL and wait */
async function bbOpen(url, waitSec = 10) {
    const result = await bb('open', url);
    if (!result.stdout.includes('已打开') && !result.stdout.includes('Opened')) {
        console.log(`  bb open warning: ${result.stdout.substring(0, 80)}`);
    }
    await sleep(waitSec);
}

/** Get text length */
async function getTextLen() {
    const r = await bbEval('document.body.innerText.trim().length');
    return parseInt(r) || 0;
}

/** Get full text */
async function getText() {
    return await bbEval('document.body.innerText.trim()');
}

/** Check if page has philosophical content */
async function hasPhilosophy() {
    const text = await getText();
    const keywords = ['philosophische', 'Sprache', 'Tractatus', 'logisch', 'Bemerkung', 'Satz', 'Welt', 'Wissen'];
    return keywords.some(kw => text.includes(kw));
}

/** Extract one manuscript using the correct workflow:
 *  1. Navigate to agora_show_book_transcription/{docId}?collection={1|3}
 *  2. Use JS to find and click the link that navigates to full_book_transcription
 *  3. Wait for the page to load
 *  4. Extract text via document.body.innerText.trim()
 */
async function extractManuscript(docId, ms) {
    const baseName = `${ms}_WittSrc`;
    const outPath = join(OUT_DIR, `${baseName}.txt`);

    // Skip if already extracted with substantial content
    if (existsSync(outPath)) {
        const existing = readFileSync(outPath, 'utf-8');
        if (existing.length > 10000) {
            const words = existing.split(/\s+/).filter(w => w.length > 0).length;
            console.log(`  ⏭️  Already exists: ${existing.length} chars, ~${words} words`);
            return { success: true, chars: existing.length, skipped: true };
        }
    }

    let text = '';
    let textLen = 0;
    let saved = false;
    let source = '';

    // ── Try Normalized (collection=1) ──────────────────────────────────────
    console.log(`  Trying Normalized (collection=1)...`);
    await bbOpen(`http://www.wittgensteinsource.org/agora_show_book_transcription/${docId}?collection=1`, 12);

    // The key: click the link whose href contains "full_book_transcription"
    // The link text is typically "Ms-XXX" or "Ts-XXX" (not "transcription")
    // We filter by href pattern, not text content
    const clickResult = await bbEval(
        `(function() { ` +
        `const links = Array.from(document.querySelectorAll('a')); ` +
        `const tlink = links.find(a => (a.href||'').includes('full_book_transcription')); ` +
        `if(tlink) { window._targetHref = tlink.href; tlink.click(); return 'clicked: ' + tlink.href.substring(0,80); } ` +
        `return 'no full_book_transcription link'; ` +
        `})()`,
        30000  // 30s timeout for eval
    );
    console.log(`  Click: ${clickResult.substring(0, 120)}`);

    await sleep(15);
    text = await getText();
    textLen = text.length;
    console.log(`  Normalized: ${textLen} chars`);
    if (textLen >= 5000) {
        source = 'Normalized';
        saved = true;
    }

    // ── If Normalized failed, try Diplomatic (collection=3) ──────────────
    if (!saved) {
        console.log(`  Trying Diplomatic (collection=3)...`);
        await bbOpen(`http://www.wittgensteinsource.org/agora_show_book_transcription/${docId}?collection=3`, 12);

        const clickResult2 = await bbEval(
            `(function() { ` +
            `const links = Array.from(document.querySelectorAll('a')); ` +
            `const tlink = links.find(a => (a.href||'').includes('full_book_transcription')); ` +
            `if(tlink) { tlink.click(); return 'clicked: ' + tlink.href.substring(0,80); } ` +
            `return 'no link'; ` +
            `})()`,
            30000
        );
        console.log(`  Click: ${clickResult2.substring(0, 120)}`);

        await sleep(15);
        text = await getText();
        textLen = text.length;
        console.log(`  Diplomatic: ${textLen} chars`);
        if (textLen >= 5000) {
            source = 'Diplomatic';
            saved = true;
        }
    }

    // Save result
    if (saved) {
        writeFileSync(outPath, text, 'utf-8');
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        const hasPhil = text.includes('philosophische') || text.includes('Bemerkungen') || text.includes('Sprache');
        console.log(`  ✅ Saved (${source}): ${textLen} chars, ~${words} words -> ${baseName}.txt (hasPhil=${hasPhil})`);
        return { success: true, chars: textLen, words, source };
    } else {
        console.log(`  ❌ Failed: only ${textLen} chars (min 5000 needed)`);
        writeFileSync(outPath + '.debug.txt', text, 'utf-8');
        return { success: false, chars: textLen };
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const startArg = args.indexOf('--start');
    const endArg = args.indexOf('--end');
    const startIdx = startArg >= 0 ? parseInt(args[startArg + 1]) : 0;
    const endIdx = endArg >= 0 ? parseInt(args[endArg + 1]) : MANUSCRIPTS.length - 1;
    
    // CC licensed manuscripts to skip (already have from CLARINO)
    const SKIP_CC = new Set([
        "Ms-114", "Ms-115", "Ms-139a", "Ms-140", "Ms-141",
        "Ms-148", "Ms-149", "Ms-150", "Ms-152",
        "Ms-153a", "Ms-153b", "Ms-154", "Ms-155", "Ms-156a",
        "Ts-201a1", "Ts-201a2", "Ts-207", "Ts-212", "Ts-213", "Ts-310"
    ]);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(' WittSrc BNE Batch Extractor v2');
    console.log('═══════════════════════════════════════════════════════');
    console.log(` Output: ${OUT_DIR}`);
    console.log(` Range: items ${startIdx + 1} - ${endIdx + 1} of ${MANUSCRIPTS.length}`);
    console.log(` Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(` Skip CC: ${SKIP_CC.size} already licensed items`);
    console.log('═══════════════════════════════════════════════════════');
    
    // Check daemon
    const status = await bb('daemon', 'status');
    if (!status.stdout.includes('running: yes')) {
        console.error('ERROR: bb-browser daemon not running.');
        console.error('Run: bb-browser daemon start');
        process.exit(1);
    }
    
    const log = (msg) => {
        console.log(msg);
        appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`);
    };
    
    writeFileSync(LOG_FILE, `Started: ${new Date().toISOString()}\n`);
    
    let totalSuccess = 0, totalSkipped = 0, totalFailed = 0, totalChars = 0;
    
    for (let i = startIdx; i <= Math.min(endIdx, MANUSCRIPTS.length - 1); i++) {
        const item = MANUSCRIPTS[i];
        
        if (SKIP_CC.has(item.ms)) {
            console.log(`[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} - CC licensed, skipping`);
            totalSkipped++;
            continue;
        }
        
        if (dryRun) {
            console.log(`[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} (docId: ${item.docId}) - DRY RUN`);
            continue;
        }
        
        console.log(`\n[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} (docId: ${item.docId})`);
        log(`[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} (docId: ${item.docId})`);
        
        const result = await extractManuscript(item.docId, item.ms);
        
        if (result.success) {
            if (result.skipped) totalSkipped++;
            else { totalSuccess++; totalChars += result.chars; }
        } else {
            totalFailed++;
        }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' COMPLETE');
    console.log(` Extracted: ${totalSuccess}  Skipped: ${totalSkipped}  Failed: ${totalFailed}`);
    console.log(` Total chars: ${totalChars.toLocaleString()}`);
    console.log(` Output: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════');
    log(`Done. Success: ${totalSuccess}, Skipped: ${totalSkipped}, Failed: ${totalFailed}, Chars: ${totalChars}`);
}

main().catch(e => { console.error(e); process.exit(1); });
