#!/usr/bin/env node
/**
 * WittSrc BNE Batch Extractor
 * =============================
 * Uses bb-browser to control real Chrome and extract Wittgenstein Nachlass
 * manuscripts from wittgensteinsource.org
 * 
 * Usage:
 *   node wittsrg-extractor.js [--dry-run] [--start N] [--end N]
 * 
 * Prerequisites:
 *   npm install -g bb-browser
 *   bb-browser daemon start
 */
import { execSync, spawn } from 'child_process';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────────────────────────────

const OUT_DIR = join(__dirname, '..', 'corpus', 'wittgenstain', 'wittsrg');
const LOG_FILE = join(OUT_DIR, 'extraction-log.txt');

// Ensure output directory exists
if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
}

// ─── Manuscript Catalog ────────────────────────────────────────────────────────
// docId -> (msNumber, title, collection)
// collection: 1 = Normalized, 3 = Diplomatic
// We prioritize Normalized (collection=1) for clean text, Diplomatic (collection=3) for revision markup

const MANUSCRIPTS = [
    { docId: "31",  ms: "Ms-101",  title: "Ms-101",  collections: ["1", "3"] },
    { docId: "32",  ms: "Ms-102",  title: "Ms-102",  collections: ["1", "3"] },
    { docId: "33",  ms: "Ms-103",  title: "Ms-103",  collections: ["1", "3"] },
    { docId: "167", ms: "Ms-104",  title: "Ms-104",  collections: ["1", "3"] },
    { docId: "71",  ms: "Ms-105",  title: "Ms-105",  collections: ["1", "3"] },
    { docId: "72",  ms: "Ms-106",  title: "Ms-106",  collections: ["1", "3"] },
    { docId: "73",  ms: "Ms-107",  title: "Ms-107",  collections: ["1", "3"] },
    { docId: "34",  ms: "Ms-108",  title: "Ms-108",  collections: ["1", "3"] },
    { docId: "35",  ms: "Ms-109",  title: "Ms-109",  collections: ["1", "3"] },
    { docId: "36",  ms: "Ms-110",  title: "Ms-110",  collections: ["1", "3"] },
    { docId: "37",  ms: "Ms-111",  title: "Ms-111",  collections: ["1", "3"] },
    { docId: "168", ms: "Ms-112",  title: "Ms-112",  collections: ["1", "3"] },
    { docId: "169", ms: "Ms-113",  title: "Ms-113",  collections: ["1", "3"] },
    { docId: "12",  ms: "Ms-114",  title: "Ms-114",  collections: ["1", "3"] },
    { docId: "1",   ms: "Ms-115",  title: "Ms-115",  collections: ["1", "3"] },
    { docId: "140", ms: "Ms-116",  title: "Ms-116",  collections: ["1", "3"] },
    { docId: "141", ms: "Ms-117",  title: "Ms-117",  collections: ["1", "3"] },
    { docId: "38",  ms: "Ms-118",  title: "Ms-118",  collections: ["1", "3"] },
    { docId: "142", ms: "Ms-119",  title: "Ms-119",  collections: ["1", "3"] },
    { docId: "39",  ms: "Ms-120",  title: "Ms-120",  collections: ["1", "3"] },
    { docId: "40",  ms: "Ms-121",  title: "Ms-121",  collections: ["1", "3"] },
    { docId: "41",  ms: "Ms-122",  title: "Ms-122",  collections: ["1", "3"] },
    { docId: "42",  ms: "Ms-123",  title: "Ms-123",  collections: ["1", "3"] },
    { docId: "143", ms: "Ms-124",  title: "Ms-124",  collections: ["1", "3"] },
    { docId: "44",  ms: "Ms-125",  title: "Ms-125",  collections: ["1", "3"] },
    { docId: "144", ms: "Ms-126",  title: "Ms-126",  collections: ["1", "3"] },
    { docId: "145", ms: "Ms-127",  title: "Ms-127",  collections: ["1", "3"] },
    { docId: "146", ms: "Ms-128",  title: "Ms-128",  collections: ["1", "3"] },
    { docId: "147", ms: "Ms-129",  title: "Ms-129",  collections: ["1", "3"] },
    { docId: "170", ms: "Ms-130",  title: "Ms-130",  collections: ["1", "3"] },
    { docId: "148", ms: "Ms-131",  title: "Ms-131",  collections: ["1", "3"] },
    { docId: "149", ms: "Ms-132",  title: "Ms-132",  collections: ["1", "3"] },
    { docId: "45",  ms: "Ms-133",  title: "Ms-133",  collections: ["1", "3"] },
    { docId: "171", ms: "Ms-134",  title: "Ms-134",  collections: ["1", "3"] },
    { docId: "46",  ms: "Ms-135",  title: "Ms-135",  collections: ["1", "3"] },
    { docId: "151", ms: "Ms-136",  title: "Ms-136",  collections: ["1", "3"] },
    { docId: "152", ms: "Ms-137",  title: "Ms-137",  collections: ["1", "3"] },
    { docId: "153", ms: "Ms-138",  title: "Ms-138",  collections: ["1", "3"] },
    { docId: "4",   ms: "Ms-139a", title: "Ms-139a", collections: ["1", "3"] },
    { docId: "83",  ms: "Ms-139b", title: "Ms-139b", collections: ["1", "3"] },
    { docId: "13",  ms: "Ms-140",  title: "Ms-140",  collections: ["1", "3"] },
    { docId: "14",  ms: "Ms-141",  title: "Ms-141",  collections: ["1", "3"] },
    { docId: "84",  ms: "Ms-142",  title: "Ms-142",  collections: ["1", "3"] },
    { docId: "47",  ms: "Ms-143",  title: "Ms-143",  collections: ["1", "3"] },
    { docId: "74",  ms: "Ms-144",  title: "Ms-144",  collections: ["1", "3"] },
    { docId: "85",  ms: "Ms-145",  title: "Ms-145",  collections: ["1", "3"] },
    { docId: "86",  ms: "Ms-146",  title: "Ms-146",  collections: ["1", "3"] },
    { docId: "48",  ms: "Ms-147",  title: "Ms-147",  collections: ["1", "3"] },
    { docId: "15",  ms: "Ms-148",  title: "Ms-148",  collections: ["1", "3"] },
    { docId: "16",  ms: "Ms-149",  title: "Ms-149",  collections: ["1", "3"] },
    { docId: "17",  ms: "Ms-150",  title: "Ms-150",  collections: ["1", "3"] },
    { docId: "49",  ms: "Ms-151",  title: "Ms-151",  collections: ["1", "3"] },
    { docId: "18",  ms: "Ms-152",  title: "Ms-152",  collections: ["1", "3"] },
    { docId: "8",   ms: "Ms-153a", title: "Ms-153a", collections: ["1", "3"] },
    { docId: "9",   ms: "Ms-153b", title: "Ms-153b", collections: ["1", "3"] },
    { docId: "10",  ms: "Ms-154",  title: "Ms-154",  collections: ["1", "3"] },
    { docId: "11",  ms: "Ms-155",  title: "Ms-155",  collections: ["1", "3"] },
    { docId: "19",  ms: "Ms-156a", title: "Ms-156a", collections: ["1", "3"] },
    { docId: "87",  ms: "Ms-156b", title: "Ms-156b", collections: ["1", "3"] },
    { docId: "154", ms: "Ms-157a", title: "Ms-157a", collections: ["1", "3"] },
    { docId: "50",  ms: "Ms-157b", title: "Ms-157b", collections: ["1", "3"] },
    { docId: "51",  ms: "Ms-158",  title: "Ms-158",  collections: ["1", "3"] },
    { docId: "52",  ms: "Ms-159",  title: "Ms-159",  collections: ["1", "3"] },
    { docId: "155", ms: "Ms-160",  title: "Ms-160",  collections: ["1", "3"] },
    { docId: "156", ms: "Ms-161",  title: "Ms-161",  collections: ["1", "3"] },
    { docId: "53",  ms: "Ms-162a", title: "Ms-162a", collections: ["1", "3"] },
    { docId: "54",  ms: "Ms-162b", title: "Ms-162b", collections: ["1", "3"] },
    { docId: "55",  ms: "Ms-163",  title: "Ms-163",  collections: ["1", "3"] },
    { docId: "56",  ms: "Ms-164",  title: "Ms-164",  collections: ["1", "3"] },
    { docId: "57",  ms: "Ms-165",  title: "Ms-165",  collections: ["1", "3"] },
    { docId: "58",  ms: "Ms-166",  title: "Ms-166",  collections: ["1", "3"] },
    { docId: "59",  ms: "Ms-167",  title: "Ms-167",  collections: ["1", "3"] },
    { docId: "60",  ms: "Ms-168",  title: "Ms-168",  collections: ["1", "3"] },
    { docId: "61",  ms: "Ms-169",  title: "Ms-169",  collections: ["1", "3"] },
    { docId: "62",  ms: "Ms-170",  title: "Ms-170",  collections: ["1", "3"] },
    { docId: "88",  ms: "Ms-171",  title: "Ms-171",  collections: ["1", "3"] },
    { docId: "89",  ms: "Ms-172",  title: "Ms-172",  collections: ["1", "3"] },
    { docId: "63",  ms: "Ms-173",  title: "Ms-173",  collections: ["1", "3"] },
    { docId: "64",  ms: "Ms-174",  title: "Ms-174",  collections: ["1", "3"] },
    { docId: "65",  ms: "Ms-175",  title: "Ms-175",  collections: ["1", "3"] },
    { docId: "66",  ms: "Ms-176",  title: "Ms-176",  collections: ["1", "3"] },
    { docId: "67",  ms: "Ms-177",  title: "Ms-177",  collections: ["1", "3"] },
    { docId: "90",  ms: "Ms-178a", title: "Ms-178a", collections: ["1", "3"] },
    { docId: "91",  ms: "Ms-178b", title: "Ms-178b", collections: ["1", "3"] },
    { docId: "92",  ms: "Ms-178c", title: "Ms-178c", collections: ["1", "3"] },
    { docId: "93",  ms: "Ms-178d", title: "Ms-178d", collections: ["1", "3"] },
    { docId: "94",  ms: "Ms-178e", title: "Ms-178e", collections: ["1", "3"] },
    { docId: "95",  ms: "Ms-178f", title: "Ms-178f", collections: ["1", "3"] },
    { docId: "96",  ms: "Ms-178g", title: "Ms-178g", collections: ["1", "3"] },
    { docId: "97",  ms: "Ms-178h", title: "Ms-178h", collections: ["1", "3"] },
    { docId: "68",  ms: "Ms-179",  title: "Ms-179",  collections: ["1", "3"] },
    { docId: "98",  ms: "Ms-180a", title: "Ms-180a", collections: ["1", "3"] },
    { docId: "69",  ms: "Ms-180b", title: "Ms-180b", collections: ["1", "3"] },
    { docId: "70",  ms: "Ms-181",  title: "Ms-181",  collections: ["1", "3"] },
    { docId: "75",  ms: "Ms-182",  title: "Ms-182",  collections: ["1", "3"] },
    { docId: "76",  ms: "Ms-183",  title: "Ms-183",  collections: ["1", "3"] },
    { docId: "2",   ms: "Ts-201a1", title: "Ts-201a1", collections: ["1", "3"] },
    { docId: "3",   ms: "Ts-201a2", title: "Ts-201a2", collections: ["1", "3"] },
    { docId: "172", ms: "Ts-202",  title: "Ts-202",  collections: ["1", "3"] },
    { docId: "78",  ms: "Ts-203",  title: "Ts-203",  collections: ["1", "3"] },
    { docId: "79",  ms: "Ts-204",  title: "Ts-204",  collections: ["1", "3"] },
    { docId: "182", ms: "Ts-205",  title: "Ts-205",  collections: ["1", "3"] },
    { docId: "99",  ms: "Ts-206",  title: "Ts-206",  collections: ["1", "3"] },
    { docId: "20",  ms: "Ts-207",  title: "Ts-207",  collections: ["1", "3"] },
    { docId: "100", ms: "Ts-208",  title: "Ts-208",  collections: ["1", "3"] },
    { docId: "101", ms: "Ts-209",  title: "Ts-209",  collections: ["1", "3"] },
    { docId: "102", ms: "Ts-210",  title: "Ts-210",  collections: ["1", "3"] },
    { docId: "183", ms: "Ts-211",  title: "Ts-211",  collections: ["1", "3"] },
    { docId: "6",   ms: "Ts-212",  title: "Ts-212",  collections: ["1", "3"] },
    { docId: "5",   ms: "Ts-213",  title: "Ts-213",  collections: ["1", "3"] },
    { docId: "103", ms: "Ts-214a1", title: "Ts-214a1", collections: ["1", "3"] },
    { docId: "105", ms: "Ts-214b1", title: "Ts-214b1", collections: ["1", "3"] },
    { docId: "107", ms: "Ts-214c1", title: "Ts-214c1", collections: ["1", "3"] },
    { docId: "109", ms: "Ts-215a", title: "Ts-215a", collections: ["1", "3"] },
    { docId: "110", ms: "Ts-215b", title: "Ts-215b", collections: ["1", "3"] },
    { docId: "184", ms: "Ts-215c", title: "Ts-215c", collections: ["1", "3"] },
    { docId: "111", ms: "Ts-216",  title: "Ts-216",  collections: ["1", "3"] },
    { docId: "112", ms: "Ts-217",  title: "Ts-217",  collections: ["1", "3"] },
    { docId: "113", ms: "Ts-218",  title: "Ts-218",  collections: ["1", "3"] },
    { docId: "114", ms: "Ts-219",  title: "Ts-219",  collections: ["1", "3"] },
    { docId: "115", ms: "Ts-220",  title: "Ts-220",  collections: ["1", "3"] },
    { docId: "116", ms: "Ts-221a", title: "Ts-221a", collections: ["1", "3"] },
    { docId: "156", ms: "Ts-222",  title: "Ts-222",  collections: ["1", "3"] },
    { docId: "118", ms: "Ts-223",  title: "Ts-223",  collections: ["1", "3"] },
    { docId: "119", ms: "Ts-224",  title: "Ts-224",  collections: ["1", "3"] },
    { docId: "120", ms: "Ts-225",  title: "Ts-225",  collections: ["1", "3"] },
    { docId: "121", ms: "Ts-226",  title: "Ts-226",  collections: ["1", "3"] },
    { docId: "122", ms: "Ts-227a", title: "Ts-227a", collections: ["1", "3"] },
    { docId: "185", ms: "Ts-227b", title: "Ts-227b", collections: ["1", "3"] },
    { docId: "123", ms: "Ts-228",  title: "Ts-228",  collections: ["1", "3"] },
    { docId: "124", ms: "Ts-229",  title: "Ts-229",  collections: ["1", "3"] },
    { docId: "125", ms: "Ts-230a", title: "Ts-230a", collections: ["1", "3"] },
    { docId: "186", ms: "Ts-230b", title: "Ts-230b", collections: ["1", "3"] },
    { docId: "187", ms: "Ts-230c", title: "Ts-230c", collections: ["1", "3"] },
    { docId: "126", ms: "Ts-231",  title: "Ts-231",  collections: ["1", "3"] },
    { docId: "127", ms: "Ts-232",  title: "Ts-232",  collections: ["1", "3"] },
    { docId: "173", ms: "Ts-233a", title: "Ts-233a", collections: ["1", "3"] },
    { docId: "174", ms: "Ts-233b", title: "Ts-233b", collections: ["1", "3"] },
    { docId: "128", ms: "Ts-235",  title: "Ts-235",  collections: ["1", "3"] },
    { docId: "129", ms: "Ts-236",  title: "Ts-236",  collections: ["1", "3"] },
    { docId: "130", ms: "Ts-237",  title: "Ts-237",  collections: ["1", "3"] },
    { docId: "131", ms: "Ts-238",  title: "Ts-238",  collections: ["1", "3"] },
    { docId: "132", ms: "Ts-239",  title: "Ts-239",  collections: ["1", "3"] },
    { docId: "133", ms: "Ts-240",  title: "Ts-240",  collections: ["1", "3"] },
    { docId: "134", ms: "Ts-241a", title: "Ts-241a", collections: ["1", "3"] },
    { docId: "135", ms: "Ts-241b", title: "Ts-241b", collections: ["1", "3"] },
    { docId: "188", ms: "Ts-242a", title: "Ts-242a", collections: ["1", "3"] },
    { docId: "196", ms: "Ts-242b", title: "Ts-242b", collections: ["1", "3"] },
    { docId: "136", ms: "Ts-243",  title: "Ts-243",  collections: ["1", "3"] },
    { docId: "137", ms: "Ts-244",  title: "Ts-244",  collections: ["1", "3"] },
    { docId: "138", ms: "Ts-245",  title: "Ts-245",  collections: ["1", "3"] },
    { docId: "139", ms: "Ts-246",  title: "Ts-246",  collections: ["1", "3"] },
    { docId: "79",  ms: "Ts-247",  title: "Ts-247",  collections: ["1", "3"] }, // Note: docId 79 shared with Ts-204
    { docId: "197", ms: "Ts-248",  title: "Ts-248",  collections: ["1", "3"] },
    { docId: "189", ms: "Ms-301",  title: "Ms-301",  collections: ["1", "3"] },
    { docId: "190", ms: "Ts-302",  title: "Ts-302",  collections: ["1", "3"] },
    { docId: "191", ms: "Ts-303",  title: "Ts-303",  collections: ["1", "3"] },
    { docId: "192", ms: "Ts-304",  title: "Ts-304",  collections: ["1", "3"] },
    { docId: "193", ms: "Ms-305",  title: "Ms-305",  collections: ["1", "3"] },
    { docId: "194", ms: "Ts-306",  title: "Ts-306",  collections: ["1", "3"] },
    { docId: "195", ms: "Ts-309",  title: "Ts-309",  collections: ["1", "3"] },
    { docId: "7",   ms: "Ts-310",  title: "Ts-310",  collections: ["1", "3"] },
    { docId: "21",  ms: "Legend",  title: "Legend",  collections: ["1", "3"] },
];

// ─── bb-browser Helper Functions ──────────────────────────────────────────────

function bb(args, timeoutMs = 30000) {
    const cmd = ['bb-browser'].concat(args);
    try {
        const result = execSync(cmd.join(' '), {
            timeout: timeoutMs,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
            killSignal: 'SIGTERM',
        });
        return result.trim();
    } catch (e) {
        return e.stdout?.trim() || e.message?.trim() || String(e);
    }
}

function bbOpen(url, waitSec = 10) {
    bb(['open', url]);
    execSync(`sleep ${waitSec}`);
}

function bbEval(js) {
    const escaped = js.replace(/'/g, "'\\''");
    return bb(['eval', js]);
}

function bbClick(ref) {
    return bb(['click', `@${ref}`]);
}

function bbSnapshot() {
    return bb(['snapshot']);
}

// ─── Extraction Logic ─────────────────────────────────────────────────────────

function extractManuscript(docId, ms, collection) {
    const colName = collection === "1" ? "Normalized" : "Diplomatic";
    const safeName = `${ms}_WittSrc_${colName}`;
    const outPath = join(OUT_DIR, `${safeName}.txt`);
    
    console.log(`  Extracting ${ms} (${colName})...`);
    
    // Step 1: Open the book transcription page
    const url = `http://www.wittgensteinsource.org/agora_show_book_transcription/${docId}?collection=${collection}`;
    bbOpen(url, 10);
    
    // Step 2: Find the manuscript link and click it to expand the full text
    // The link is typically the first "transcription" link
    // Use JS to find and click the link
    const clickResult = bbEval(`
        (function() {
            // Find the transcription link - it typically has text content matching the ms number
            // or contains "transcription" in the href
            const links = Array.from(document.querySelectorAll('a'));
            // Find the first link that looks like a transcription entry
            // These links are inside list items with transcription content
            const transcriptionLinks = links.filter(a => {
                const href = a.href || '';
                const text = (a.textContent || '').trim().toLowerCase();
                return href.includes('transcription') || text.includes('transcription');
            });
            
            if (transcriptionLinks.length > 0) {
                transcriptionLinks[0].click();
                return 'clicked: ' + transcriptionLinks[0].textContent.trim();
            }
            return 'no transcription link found';
        })()
    `);
    console.log(`    Click result: ${clickResult.substring(0, 100)}`);
    
    // Step 3: Wait for content to load
    execSync('sleep 8');
    
    // Step 4: Extract the full text
    const textLength = bbEval('document.body.innerText.trim().length');
    console.log(`    Text length: ${textLength}`);
    
    if (parseInt(textLength) < 1000) {
        // Content didn't load, try waiting longer
        execSync('sleep 10');
        const textLength2 = bbEval('document.body.innerText.trim().length');
        console.log(`    After extended wait: ${textLength2}`);
    }
    
    // Step 5: Get the actual text
    const text = bbEval('document.body.innerText.trim()');
    
    // Step 6: Save to file
    if (text && text.length > 1000) {
        writeFileSync(outPath, text, 'utf-8');
        const words = text.split(/\s+/).filter(w => w.length > 0).length;
        console.log(`    Saved: ${text.length} chars, ~${words} words`);
        return { success: true, chars: text.length, words, path: outPath };
    } else {
        console.log(`    FAILED: text too short (${text?.length || 0} chars)`);
        return { success: false, chars: text?.length || 0, path: outPath };
    }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const startIdx = parseInt(args.find((a, i) => args[i - 1] === '--start') || '0');
    const endIdx = parseInt(args.find((a, i) => args[i - 1] === '--end') || String(MANUSCRIPTS.length));
    
    console.log('═══════════════════════════════════════════════════════');
    console.log(' WittSrc BNE Batch Extractor');
    console.log('═══════════════════════════════════════════════════════');
    console.log(` Output: ${OUT_DIR}`);
    console.log(` Manuscripts: ${startIdx + 1} - ${Math.min(endIdx + 1, MANUSCRIPTS.length)} of ${MANUSCRIPTS.length}`);
    console.log(` Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('═══════════════════════════════════════════════════════');
    
    // Check daemon status
    const status = bb(['daemon', 'status']);
    if (!status.includes('running: yes')) {
        console.error('ERROR: bb-browser daemon not running.');
        console.error('Run: bb-browser daemon start');
        process.exit(1);
    }
    console.log(` Daemon: ${status.split('\n')[0]}`);
    
    const log = (msg) => {
        console.log(msg);
        appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + msg + '\n');
    };
    
    // Clear log
    writeFileSync(LOG_FILE, '');
    
    let totalChars = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    
    for (let i = startIdx; i < Math.min(endIdx + 1, MANUSCRIPTS.length); i++) {
        const item = MANUSCRIPTS[i];
        console.log(`\n[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} (docId: ${item.docId})`);
        log(`[${i + 1}/${MANUSCRIPTS.length}] ${item.ms} (docId: ${item.docId})`);
        
        let bestResult = { success: false, chars: 0 };
        
        for (const col of item.collections) {
            if (dryRun) {
                console.log(`  [DRY] Would extract collection=${col}`);
                continue;
            }
            
            const result = extractManuscript(item.docId, item.ms, col);
            
            // Keep the best result
            if (result.success && result.chars > bestResult.chars) {
                bestResult = result;
            }
        }
        
        if (bestResult.success) {
            totalSuccess++;
            totalChars += bestResult.chars;
            log(`  SUCCESS: ${bestResult.chars} chars`);
        } else {
            totalFailed++;
            log(`  FAILED`);
        }
    }
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(' COMPLETE');
    console.log(` Successful: ${totalSuccess}/${endIdx - startIdx + 1}`);
    console.log(` Failed: ${totalFailed}`);
    console.log(` Total chars extracted: ${totalChars.toLocaleString()}`);
    console.log(` Output directory: ${OUT_DIR}`);
    console.log('═══════════════════════════════════════════════════════');
    log(`\nTotal: ${totalSuccess} success, ${totalFailed} failed, ${totalChars} chars`);
}

main();
