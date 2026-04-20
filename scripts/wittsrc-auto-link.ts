#!/usr/bin/env bun
/**
 * wittsrc-auto-link.ts
 *
 * Zero-LLM entity link extraction from Wittgenstein Brain Pages.
 * Extracts typed references to manuscripts, philosophers, and concepts
 * using regex patterns, then infers link types from context.
 *
 * Usage:
 *   bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstein/brain/works/
 *   bun run scripts/wittsrc-auto-link.ts --dry-run --since 2026-04-19
 *   bun run scripts/wittsrc-auto-link.ts --test-regex
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, basename } from 'path';
import type { LinkType } from './types/wittsrc-types';

// ============================================================================
// REGEX PATTERNS (from conventions/wittgenstein-links.md)
// ============================================================================

const MANUSCRIPT_PATTERN = /\b(Ms|Ts)-(\d+[a-z]?)\b/gi;
const PI_PATTERN = /\bPI\s*§\s*(\d+)\b/gi;
const PR_PATTERN = /\bPR\s+([IVX]+(?:\.\d+)?)\b/gi;
const ZETTEL_PATTERN = /\bZettel\s*§\s*(\d+)\b/gi;
const OC_PATTERN = /\bOC\s*§\s*(\d+)\b/gi;

const PHILOSOPHER_PATTERN = /\bWittgenstein\b|\bRussell\b|\bMoore\b|\bFrege\b|\bRamsey\b|\bAnscombe\b|\bvon\s*Wright\b|\bPitcher\b|\bDrury\b|\bEngelmann\b|\bOgden\b|\bRhees\b|\bKreisel\b|\bWaismann\b|\bCollingwood\b|\bStebbing\b|\bWittgensteinian\b|\bWittgensteinean\b|\bTuring\b|\bShakespeare\b|\bAugustine\b|\bKierkegaard\b|\bHertz\b|\bPopper\b|\bHempel\b|\bCarnap\b|\bReichenbach\b|\bCohen\b|\bNovalis\b|\bBurgess\b|\bStravinsky\b|\bSchopenhauer\b|\bKraus\b|\bKuttenberg\b|\bKuettenberg\b|\bHaehnschen\b|\bCora\b|\bBruno\b|\bAmbrose\b|\bRawidowicz\b|\bMandelbrote\b|\bvon\s*Aster\b|\bHaverty\b|\bCantor\b|\bHilbert\b|\bGodel\b|\bChurch\b|\bPeano\b|\bDedekind\b|\bFraenkel\b|\bZermelo\b|\bHume\b|\bSpinoza\b|\bLeibniz\b|\bMill\b|\bAustin\b|\bSearle\b|\bGrice\b|\bStrawson\b|\bT Tolstoy\b|\bPascal\b|\bDostoevsky\b|\bUnamuno\b|\bTurgenev\b|\bChekhov\b|\bStrindberg\b|\bIbsen\b|\bDante\b|\bMaimonides\b|\bNestroy\b|\bBuridano\b|\bDonatello\b/gi;

const CONCEPT_PATTERN = /\b(language-game|language games|private language|family resemblance|rule-following|form of life|life form|picture theory|logical atomism|nonsense|atomic proposition|elementary proposition|tautology|contradiction|logical space|world|thought|meaning|fact|thing|object|state of affairs|Sachverhalt|complex|verificationism|essentialism|platonism|aspect perception|aspect dawning|seeing as|philosophy of mathematics|foundations of mathematics|ethics|aesthetics|philosophy of religion|mysticism|certainty|doubt|criteria|criterion|behaviourism|behaviorism|instrument|ceremony|ritual|custom|institution|normative|normativity|agreement|nominalism|realism|idealism|conceptual analysis|solipsism|phenomenology|descriptivism|show|say|speak|the self|the subject|will|volition|death|religious belief|faith|praxis|practice|rule-governed|calculus|formal system|logic of language|depth psychology|philosophy of mind|physicalism|materialism|dualism|privacy|privileged access|incorrigibility|intention|intentionality|concept of language|foundations of arithmetic|set theory|Godel|incompleteness|computability|Entscheidungsproblem|philosophy of logic|metamathematics|logicism|intuitionism|formalism|truth table|truth function|truth conditions|satisfaction|predication|proper name|description|definite description|rigidity|rigid designator|infinity|continuum|cardinal|ordinal|axiom of choice|ordinal number|cardinal number|causation|induction|problem of induction|natural law|regularity theory|counterfactual|dispositional|thing in itself|synthetic a priori|synthetic a posteriori|analytic a priori|analytic a posteriori|a priori|a posteriori|transcendental|Prolegomena|Tractatus|Philosophical Investigations|Notebooks|Philosophical Remarks|On Certainty|Big Typescript|Sprachspiel|Familienahnlichkeit|PrivatSprache|Traktat)\b/gi;

// ============================================================================
// LINK TYPE INFERENCE// LINK TYPE INFERENCE
// ============================================================================

interface PatternRule {
  pattern: RegExp;
  type: LinkType;
}

const CITES_RULES: PatternRule[] = [
  { pattern: /cf\.?\s+(Ms|Ts|PI|PR|Zettel|OC)/i, type: 'cites' },
  { pattern: /see\s+(also\s+)?(Ms|Ts|PI|PR|Zettel|OC)/i, type: 'cites' },
  { pattern: /as\s+in\s+(Ms|Ts|PI|PR)/i, type: 'cites' },
  { pattern: /in\s+(Ms|Ts|PI|PR)\s+§/i, type: 'cites' },
  { pattern: /\b(Ms|Ts|PI|PR)\s+§\s*\d+\b.*\bdefines?\b/i, type: 'defines' },
  { pattern: /\bthe\s+(definition|term|concept)\s+of\b/i, type: 'defines' },
];

const EVOLVES_RULES: PatternRule[] = [
  { pattern: /worked\s+out\s+(?:in|below|here)/i, type: 'evolves_to' },
  { pattern: /developed\s+(?:in|below|into)/i, type: 'evolves_to' },
  { pattern: /(?:revised|rewritten|expanded|elaborated)\s+(?:in|into)/i, type: 'evolves_to' },
  { pattern: /this\s+(?:will|can)\s+be\s+(?:found|seen|worked)/i, type: 'evolves_to' },
  { pattern: /(?:the\s+)?(?:later|earlier)\s+(?:version|form)\s+of/i, type: 'evolves_to' },
  { pattern: /supplanted\s+(?:in|by)/i, type: 'evolves_to' },
  { pattern: /replaced\s+(?:in|by)/i, type: 'evolves_to' },
  { pattern: /below\s+we\s+(?:find|see)/i, type: 'evolves_to' },
  { pattern: /(?:the\s+)?earlier\s+(?:manuscript|work|pages?|notes?|passage)/i, type: 'evolves_to' },
  { pattern: /(?:the\s+)?later\s+(?:manuscript|work|pages?|notes?|passage)/i, type: 'evolves_to' },
];

const CONTRADICTS_RULES: PatternRule[] = [
  { pattern: /contrar(y|ily)\s+(to|in)/i, type: 'contradicts' },
  { pattern: /\bopposed\s+(to|with|in)/i, type: 'contradicts' },
  { pattern: /\bopposition\s+to\b/i, type: 'contradicts' },
  { pattern: /\bunlike\b.*\b(Ms|Ts|PI|PR|Tractatus)/i, type: 'contradicts' },
  { pattern: /\bdiffers?\s+from\b/i, type: 'contradicts' },
  { pattern: /cannot\s+be\s+reconciled\s+with/i, type: 'contradicts' },
  { pattern: /\bincompatible\s+with\b/i, type: 'contradicts' },
  { pattern: /\bwrong\s+because\b/i, type: 'contradicts' },
  { pattern: /\bfails?\s+(to|in|under)/i, type: 'contradicts' },
  { pattern: /\bthe\s+mistake\s+is\b/i, type: 'contradicts' },
  { pattern: /\bthe\s+error\s+(?:is|in)\b/i, type: 'contradicts' },
];

const INFLUENCED_RULES: PatternRule[] = [
  { pattern: /influenced\s+by/i, type: 'influenced_by' },
  { pattern: /shaped\s+by/i, type: 'influenced_by' },
  { pattern: /derived\s+from/i, type: 'influenced_by' },
  { pattern: /inspired\s+by/i, type: 'influenced_by' },
  { pattern: /goes\s+back\s+to/i, type: 'influenced_by' },
  { pattern: /under\s+the\s+influence\s+of/i, type: 'influenced_by' },
  { pattern: /receives?\s+from/i, type: 'influenced_by' },
];

const REVISITS_RULES: PatternRule[] = [
  { pattern: /revisit(s|ing)?/i, type: 'revisits' },
  { pattern: /return(s|ing)?\s+to/i, type: 'revisits' },
  { pattern: /go(es|ing)?\s+back\s+to/i, type: 'revisits' },
  { pattern: /reconsider(s|ing)?/i, type: 'revisits' },
  { pattern: /re-examin(e|es|ing)/i, type: 'revisits' },
  { pattern: /reopen(s|ing)?/i, type: 'revisits' },
  { pattern: /on\s+the\s+question\s+of/i, type: 'revisits' },
  { pattern: /I\s+used\s+to\s+think/i, type: 'revisits' },
  { pattern: /earlier\s+I\s+said/i, type: 'revisits' },
  { pattern: /my\s+(?:earlier|former)\s+(?:view|thought|belief|account)/i, type: 'revisits' },
];

const ALL_RULES: Array<PatternRule> = [
  ...EVOLVES_RULES,
  ...CONTRADICTS_RULES,
  ...INFLUENCED_RULES,
  ...REVISITS_RULES,
  ...CITES_RULES,
];

// ============================================================================
// PERIOD MAP (for direction inference)
// ============================================================================

const PERIOD_MAP: Record<string, [number, number]> = {
  'ms-101': [1908, 1911], 'ms-102': [1908, 1911], 'ms-103': [1908, 1911],
  'ms-104': [1908, 1911], 'ms-105': [1912, 1913], 'ms-106': [1912, 1913],
  'ms-107': [1912, 1913], 'ms-108': [1912, 1913], 'ms-109': [1912, 1913],
  'ms-110': [1912, 1913], 'ms-111': [1912, 1913], 'ms-112': [1913, 1914],
  'ms-113': [1913, 1914], 'ms-114': [1914, 1916], 'ms-115': [1912, 1914],
  'ms-139a': [1913, 1914], 'ms-139b': [1929, 1930],
  'ms-142': [1929, 1930], 'ms-143': [1929, 1930], 'ms-144': [1929, 1930],
  'ms-145': [1929, 1930], 'ms-146': [1929, 1930], 'ms-147': [1929, 1930],
  'ms-148': [1930, 1931], 'ms-149': [1930, 1931], 'ms-150': [1930, 1931],
  'ms-151': [1930, 1931], 'ms-152': [1930, 1934], 'ms-153a': [1930, 1932],
  'ms-153b': [1932, 1934], 'ms-154': [1931, 1933], 'ms-155': [1931, 1933],
  'ms-156a': [1931, 1933], 'ms-156b': [1931, 1933],
  'ms-157a': [1937, 1938], 'ms-157b': [1938, 1939], 'ms-158': [1938, 1939],
  'ms-159': [1938, 1939], 'ms-160': [1938, 1939], 'ms-161': [1938, 1939],
  'ms-162a': [1938, 1939], 'ms-162b': [1938, 1939],
  'ms-163': [1939, 1940], 'ms-164': [1939, 1940], 'ms-165': [1939, 1940],
  'ms-166': [1939, 1940], 'ms-167': [1940, 1941], 'ms-168': [1940, 1941],
  'ms-169': [1941, 1942], 'ms-170': [1942, 1943], 'ms-171': [1943, 1944],
  'ms-172': [1944, 1945], 'ms-173': [1944, 1945], 'ms-174': [1945, 1946],
  'ms-175': [1945, 1946], 'ms-176': [1946, 1947], 'ms-177': [1946, 1947],
  'ms-178a': [1947, 1948], 'ms-178b': [1947, 1948], 'ms-178c': [1948, 1949],
  'ms-178d': [1948, 1949], 'ms-178e': [1948, 1949], 'ms-178f': [1948, 1949],
  'ms-178g': [1948, 1949], 'ms-178h': [1948, 1949],
  'ms-179': [1949, 1950], 'ms-180a': [1949, 1950], 'ms-180b': [1949, 1950],
  'ms-181': [1950, 1951], 'ms-182': [1950, 1951], 'ms-183': [1950, 1951],
  'ms-301': [1908, 1911], 'ms-305': [1908, 1911],
  'ts-202': [1929, 1931], 'ts-203': [1929, 1931], 'ts-204': [1929, 1931],
  'ts-205': [1929, 1931], 'ts-206': [1929, 1931], 'ts-207': [1929, 1931],
  'ts-208': [1931, 1932], 'ts-209': [1931, 1932], 'ts-210': [1931, 1932],
  'ts-211': [1931, 1932], 'ts-212': [1937, 1938], 'ts-213': [1937, 1938],
  'ts-214a1': [1937, 1938], 'ts-214b1': [1937, 1938], 'ts-214c1': [1937, 1938],
  'ts-215a': [1938, 1939], 'ts-215b': [1938, 1939], 'ts-215c': [1938, 1939],
  'ts-216': [1938, 1939], 'ts-217': [1938, 1939], 'ts-218': [1938, 1939],
  'ts-219': [1938, 1939], 'ts-220': [1938, 1939], 'ts-221a': [1938, 1939],
  'ts-222': [1938, 1939], 'ts-223': [1938, 1939], 'ts-224': [1938, 1939],
  'ts-225': [1938, 1939], 'ts-226': [1938, 1939], 'ts-227a': [1938, 1939],
  'ts-227b': [1938, 1939], 'ts-228': [1938, 1939], 'ts-229': [1938, 1939],
  'ts-230a': [1938, 1939], 'ts-230b': [1938, 1939], 'ts-230c': [1938, 1939],
  'ts-231': [1938, 1939], 'ts-232': [1938, 1939], 'ts-233a': [1938, 1939],
  'ts-233b': [1938, 1939], 'ts-235': [1938, 1939], 'ts-236': [1938, 1939],
  'ts-237': [1938, 1939], 'ts-238': [1938, 1939], 'ts-239': [1938, 1939],
  'ts-240': [1938, 1939], 'ts-241a': [1938, 1939], 'ts-241b': [1938, 1939],
  'ts-242a': [1938, 1939], 'ts-242b': [1938, 1939], 'ts-243': [1938, 1939],
  'ts-244': [1938, 1939], 'ts-245': [1938, 1939], 'ts-248': [1938, 1939],
  'ts-302': [1938, 1939], 'ts-303': [1938, 1939], 'ts-304': [1938, 1939],
  'ts-306': [1938, 1939], 'ts-309': [1938, 1939], 'ts-310': [1930, 1947],
  'pi': [1938, 1951], 'pi-1': [1938, 1951],
  'pi-1a': [1938, 1951], 'pi-1b': [1938, 1951],
  'pr': [1929, 1930], 'pr-1': [1929, 1930],
  'zettel': [1933, 1945], 'oc': [1950, 1951],
  'oc-1': [1950, 1951], 'tractatus': [1914, 1918],
  'bluebook': [1933, 1934], 'brownbook': [1934, 1935],
  'culture-value': [1930, 1947],
};

// ============================================================================
// SLUG UTILITIES
// ============================================================================

function slugify(text: string): string {
  return text.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function manuscriptToSlug(prefix: string, num: string): string {
  const clean = num.replace(/[a-z]$/, (c) => c.toUpperCase());
  return `work-${prefix.toLowerCase()}-${slugify(clean)}`;
}

function piToSlug(section: string): string {
  return `work-pi-${slugify(section)}`;
}

function prToSlug(ref: string): string {
  return `work-pr-${slugify(ref.replace(/\./g, '-'))}`;
}

function conceptToSlug(text: string): string {
  return `concept-${slugify(text.replace(/\s+/g, '-'))}`;
}

function personToSlug(name: string): string {
  return `person-${slugify(name.replace(/\s+/g, '-'))}`;
}

function classifyPeriod(slug: string): 'early' | 'middle' | 'late' {
  const key = slug.replace(/^work-/, '').toLowerCase();
  const range = PERIOD_MAP[key];
  if (!range) return 'late';
  const mid = (range[0] + range[1]) / 2;
  if (mid <= 1918) return 'early';
  if (mid <= 1936) return 'middle';
  return 'late';
}

function inferDirection(sourceSlug: string, targetSlug: string): 'forward' | 'backward' {
  const srcPeriod = PERIOD_MAP[sourceSlug.replace(/^work-/, '').toLowerCase()];
  const tgtPeriod = PERIOD_MAP[targetSlug.replace(/^work-/, '').toLowerCase()];
  if (!srcPeriod || !tgtPeriod) return 'forward';
  if (srcPeriod[1] < tgtPeriod[0]) return 'forward';
  if (srcPeriod[0] > tgtPeriod[1]) return 'backward';
  return 'forward';
}

function inferLinkType(context: string, sourceSlug: string, targetSlug: string): { type: LinkType; confidence: number } {
  // Check rules in priority order
  for (const rule of ALL_RULES) {
    const match = context.match(rule.pattern);
    if (match) {
      const direction = inferDirection(sourceSlug, targetSlug);
      // For evolves_to, prefer forward direction
      if (rule.type === 'evolves_to' && direction === 'backward') {
        return { type: 'evolves_to', confidence: 0.6 };
      }
      return { type: rule.type, confidence: 0.8 };
    }
  }

  // Default: cites for manuscript-to-manuscript, defines for work-to-concept
  if (sourceSlug.startsWith('work-') && targetSlug.startsWith('work-')) {
    return { type: 'cites', confidence: 0.5 };
  }
  if (sourceSlug.startsWith('work-') && targetSlug.startsWith('concept-')) {
    return { type: 'defines', confidence: 0.5 };
  }
  if (targetSlug.startsWith('person-')) {
    return { type: 'cites', confidence: 0.5 };
  }
  return { type: 'cites', confidence: 0.3 };
}

// ============================================================================
// CODE BLOCK STRIPPING
// ============================================================================

function stripCodeBlocks(text: string): string {
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`[^`\n]+`/g, '');
  text = text.replace(/^#.*$/gm, ''); // strip markdown headings in examples
  text = text.replace(/^\s{4,}\S.*$/gm, ''); // strip indented lines (code-like)
  return text;
}

// ============================================================================
// MAIN EXTRACTION
// ============================================================================

export interface ExtractedLink {
  sourceSlug: string;
  targetSlug: string;
  type: LinkType;
  anchorText: string;
  context: string;
  confidence: number;
  deterministic: boolean;
  line: number;
}

export interface ExtractedEntity {
  type: 'manuscript' | 'pi' | 'pr' | 'zettel' | 'oc' | 'person' | 'concept';
  value: string;
  slug: string;
  anchorText: string;
  context: string;
  line: number;
  confidence: number;
}

function extractFromFile(content: string, sourceSlug: string): { links: ExtractedLink[]; entities: ExtractedEntity[] } {
  const lines = content.split('\n');
  const links: ExtractedLink[] = [];
  const entities: ExtractedEntity[] = [];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (line.trim().startsWith('#') || line.trim().startsWith('---')) continue;
    const cleanLine = stripCodeBlocks(line);
    const context = cleanLine.trim();
    if (context.length < 5) continue;

    let match;

    // Manuscripts: Ms-114, Ts-207, etc.
    const msRe = /\b(Ms|Ts)-(\d+[a-z]?)\b/g;
    while ((match = msRe.exec(cleanLine)) !== null) {
      const targetSlug = manuscriptToSlug(match[1], match[2]);
      if (targetSlug === sourceSlug) continue;
      const { type, confidence } = inferLinkType(context, sourceSlug, targetSlug);
      links.push({
        sourceSlug, targetSlug, type, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30),
        confidence, deterministic: true, line: lineNum,
      });
      entities.push({
        type: 'manuscript', value: match[0], slug: targetSlug, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        line: lineNum, confidence: 0.95,
      });
    }

    // PI references: PI §1
    const piRe = /\bPI\s*§\s*(\d+)\b/g;
    while ((match = piRe.exec(cleanLine)) !== null) {
      const targetSlug = piToSlug(match[1]);
      const { type, confidence } = inferLinkType(context, sourceSlug, targetSlug);
      links.push({
        sourceSlug, targetSlug, type, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30),
        confidence, deterministic: true, line: lineNum,
      });
    }

    // PR references: PR IV.1
    const prRe = /\bPR\s+([IVX]+(?:\.\d+)?)\b/g;
    while ((match = prRe.exec(cleanLine)) !== null) {
      const targetSlug = prToSlug(match[1]);
      const { type, confidence } = inferLinkType(context, sourceSlug, targetSlug);
      links.push({
        sourceSlug, targetSlug, type, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 30), match.index + match[0].length + 30),
        confidence, deterministic: true, line: lineNum,
      });
    }

    // Philosophers
    const philoRe = /\bWittgenstein\b|\bRussell\b|\bMoore\b|\bFrege\b|\bRamsey\b|\bAnscombe\b|\bvon\s*Wright\b|\bDrury\b|\bEngelmann\b|\bOgden\b|\bRhees\b|\bKreisel\b|\bWaismann\b|\bCollingwood\b|\bStebbing\b|\bTuring\b|\bShakespeare\b|\bAugustine\b|\bKierkegaard\b|\bPopper\b|\bHempel\b|\bCarnap\b|\bSchopenhauer\b/gi;
    while ((match = philoRe.exec(cleanLine)) !== null) {
      const name = match[0];
      if (name.length < 2) continue;
      const targetSlug = personToSlug(name);
      if (targetSlug === sourceSlug) continue;
      const { type, confidence } = inferLinkType(context, sourceSlug, targetSlug);
      links.push({
        sourceSlug, targetSlug, type, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        confidence, deterministic: true, line: lineNum,
      });
      entities.push({
        type: 'person', value: name, slug: targetSlug, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 15), match.index + match[0].length + 15),
        line: lineNum, confidence: 0.9,
      });
    }

    // Philosophical concepts
    const cRe = /\b(language-game|language games|private language|family resemblance|rule-following|form of life|life form|picture theory|logical atomism|nonsense|atomic proposition|elementary proposition|tautology|contradiction|logical space|world|thought|meaning|fact|thing|object|state of affairs|Sachverhalt|verificationism|essentialism|platonism|aspect perception|aspect dawning|seeing as|philosophy of mathematics|foundations of mathematics|ethics|aesthetics|philosophy of religion|mysticism|certainty|doubt|criteria|criterion|behaviourism|behaviorism|instrument|ceremony|ritual|custom|institution|normative|normativity|agreement|nominalism|realism|idealism|conceptual analysis|solipsism|phenomenology|show|say|speak|the self|the subject|will|volition|death|religious belief|faith|praxis|practice|rule-governed|calculus|formal system|logic of language|depth psychology|philosophy of mind|physicalism|materialism|dualism|privacy|privileged access|incorrigibility|intention|intentionality|concept of language|foundations of arithmetic|set theory|Godel|incompleteness|computability|Entscheidungsproblem|philosophy of logic|metamathematics|logicism|intuitionism|formalism|truth table|truth function|truth conditions|satisfaction|predication|proper name|description|definite description|rigidity|rigid designator|infinity|continuum|cardinal|ordinal|axiom of choice|ordinal number|cardinal number|causation|induction|problem of induction|natural law|regularity theory|counterfactual|dispositional|thing in itself|synthetic a priori|synthetic a posteriori|analytic a priori|analytic a posteriori|a priori|a posteriori|transcendental|Prolegomena|Tractatus|Philosophical Investigations|Notebooks|Philosophical Remarks|On Certainty|Big Typescript|Sprachspiel|Familienahnlichkeit|PrivatSprache|Traktat)\b/gi;
    while ((match = cRe.exec(cleanLine)) !== null) {
      const val = match[1];
      if (val.length < 3) continue;
      const targetSlug = conceptToSlug(val);
      const { type, confidence } = inferLinkType(context, sourceSlug, targetSlug);
      links.push({
        sourceSlug, targetSlug, type, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20),
        confidence, deterministic: true, line: lineNum,
      });
      entities.push({
        type: 'concept', value: val, slug: targetSlug, anchorText: match[0],
        context: context.slice(Math.max(0, match.index - 15), match.index + match[0].length + 15),
        line: lineNum, confidence: 0.85,
      });
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const uniqueLinks = links.filter((l) => {
    const key = l.sourceSlug + '|' + l.targetSlug + '|' + l.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { links: uniqueLinks, entities };
}


async function getAllSlugs(brainDir: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  async function walk(dir: string) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await walk(join(dir, entry.name));
        } else if (entry.name.endsWith('.md')) {
          const slug = entry.name.replace(/\.md$/, '');
          slugs.add(slug);
        }
      }
    } catch {
      // ignore
    }
  }
  await walk(brainDir);
  return slugs;
}

async function loadGraphLinks(linksDir: string): Promise<ExtractedLink[]> {
  try {
    const files = await readdir(linksDir);
    const allLinks: ExtractedLink[] = [];
    for (const file of files) {
      if (file.endsWith('.json') && !file.includes('graph')) {
        const content = await readFile(join(linksDir, file), 'utf-8');
        const parsed = JSON.parse(content);
        allLinks.push(...(parsed.links || []));
      }
    }
    return allLinks;
  } catch {
    return [];
  }
}

function buildGraph(links: ExtractedLink[], existingSlugs: Set<string>): {
  nodes: Array<{ slug: string; type: string; period: [number, number] | null; label: string }>;
  edges: Array<{ from: string; to: string; type: LinkType; confidence: number }>;
} {
  const nodesMap = new Map<string, { slug: string; type: string; period: [number, number] | null; label: string }>();
  const edges: Array<{ from: string; to: string; type: LinkType; confidence: number }> = [];

  for (const link of links) {
    // Add source node
    if (!nodesMap.has(link.sourceSlug)) {
      const period = PERIOD_MAP[link.sourceSlug.replace(/^work-/, '').toLowerCase()] || null;
      const label = link.sourceSlug.replace(/^work-|^concept-|^person-/, '').replace(/-/g, ' ');
      let type = 'work';
      if (link.sourceSlug.startsWith('concept-')) type = 'concept';
      if (link.sourceSlug.startsWith('person-')) type = 'person';
      nodesMap.set(link.sourceSlug, { slug: link.sourceSlug, type, period, label });
    }
    // Add target node (even if not in brain yet — it's a reference)
    if (!nodesMap.has(link.targetSlug)) {
      const period = PERIOD_MAP[link.targetSlug.replace(/^work-/, '').toLowerCase()] || null;
      const label = link.targetSlug.replace(/^work-|^concept-|^person-/, '').replace(/-/g, ' ');
      let type = 'work';
      if (link.targetSlug.startsWith('concept-')) type = 'concept';
      if (link.targetSlug.startsWith('person-')) type = 'person';
      if (existingSlugs.has(link.targetSlug)) {
        nodesMap.set(link.targetSlug, { slug: link.targetSlug, type, period, label });
      } else {
        nodesMap.set(link.targetSlug, { slug: link.targetSlug, type: 'reference', period, label });
      }
    }
    edges.push({ from: link.sourceSlug, to: link.targetSlug, type: link.type, confidence: link.confidence });
  }

  return {
    nodes: [...nodesMap.values()],
    edges,
  };
}

// ============================================================================
// CLI
// ============================================================================

interface CLIArgs {
  source: string;
  output: string;
  dryRun: boolean;
  testRegex: boolean;
  since?: string;
  quiet: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  return {
    source: args[args.indexOf('--source') + 1] || 'corpus/wittgenstein/brain/',
    output: args[args.indexOf('--output') + 1] || 'corpus/wittgenstein/brain/.links/',
    dryRun: args.includes('--dry-run'),
    testRegex: args.includes('--test-regex'),
    since: args[args.indexOf('--since') + 1] || undefined,
    quiet: args.includes('--quiet'),
  };
}

async function main() {
  const cli = parseArgs();

  if (cli.testRegex) {
    console.log('=== Regex Pattern Test ===');
    const testText = `Ms-114 and Ms-115 are the early notebooks. See PI §1 for the definition.
Cf. Ts-207, where Wittgenstein develops the rule-following problem.
Unlike Tractatus, PI introduces the language-game concept.
Wittgenstein was influenced by Russell and Frege.
This is worked out in Ms-152. See also PR IV.1.
Private language is defined in PI §243. contrary to the earlier view.`;
    const strip = stripCodeBlocks(testText);

    let m;
    const msRe = /\b(Ms|Ts)-(\d+[a-z]?)\b/gi;
    let count = 0;
    while ((m = msRe.exec(strip)) !== null) count++;
    console.log(`Manuscript refs: ${count}`);

    const piRe = /\bPI\s*§\s*(\d+)\b/gi;
    count = 0;
    while ((m = piRe.exec(strip)) !== null) count++;
    console.log(`PI refs: ${count}`);

    console.log('\nLink type inference:');
    for (const rule of EVOLVES_RULES) {
      if (rule.pattern.test(strip)) console.log(`  evolves_to: matched "${rule.pattern}"`);
    }
    for (const rule of CONTRADICTS_RULES) {
      if (rule.pattern.test(strip)) console.log(`  contradicts: matched "${rule.pattern}"`);
    }
    for (const rule of INFLUENCED_RULES) {
      if (rule.pattern.test(strip)) console.log(`  influenced_by: matched "${rule.pattern}"`);
    }
    return;
  }

  const brainDir = cli.source;
  const linksDir = cli.output;

  if (!existsSync(brainDir)) {
    console.error(`Source directory does not exist: ${brainDir}`);
    process.exit(1);
  }

  const existingSlugs = await getAllSlugs(brainDir);
  const existingLinks = await loadGraphLinks(linksDir);

  const allNewLinks: ExtractedLink[] = [];
  const allNewEntities: ExtractedEntity[] = [];
  const filesProcessed: string[] = [];

  async function processDir(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await processDir(fullPath);
      } else if (entry.name.endsWith('.md')) {
        const content = await readFile(fullPath, 'utf-8');
        const relPath = relative(brainDir, fullPath);
        const sourceSlug = relPath.replace(/\.md$/, '').replace(/[/\\]/g, '-');
        const { links, entities } = extractFromFile(content, sourceSlug);
        allNewLinks.push(...links);
        allNewEntities.push(...entities);
        filesProcessed.push(relPath);
      }
    }
  }

  await processDir(brainDir);

  if (!cli.quiet) {
    console.log(`\n=== WittSrc Auto-Link Report ===`);
    console.log(`Files processed: ${filesProcessed.length}`);
    console.log(`Links extracted: ${allNewLinks.length}`);
    console.log(`Entities extracted: ${allNewEntities.length}`);

    // Link type breakdown
    const typeBreakdown: Record<string, number> = {};
    for (const l of allNewLinks) {
      typeBreakdown[l.type] = (typeBreakdown[l.type] || 0) + 1;
    }
    console.log(`\nLink type breakdown:`);
    for (const [t, c] of Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t}: ${c}`);
    }

    // Entity breakdown
    const entityBreakdown: Record<string, number> = {};
    for (const e of allNewEntities) {
      entityBreakdown[e.type] = (entityBreakdown[e.type] || 0) + 1;
    }
    console.log(`\nEntity breakdown:`);
    for (const [t, c] of Object.entries(entityBreakdown).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${t}: ${c}`);
    }

    // Top linked targets
    const targetCount: Record<string, number> = {};
    for (const l of allNewLinks) {
      targetCount[l.targetSlug] = (targetCount[l.targetSlug] || 0) + 1;
    }
    const topTargets = Object.entries(targetCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    console.log(`\nTop 10 most-linked targets:`);
    for (const [slug, count] of topTargets) {
      console.log(`  ${slug}: ${count} links`);
    }
  }

  if (cli.dryRun) {
    console.log('\n(Dry run — no files written)');
    return;
  }

  // Write links JSON
  await mkdir(linksDir, { recursive: true });
  const dateStr = new Date().toISOString().split('T')[0];
  const linksFile = join(linksDir, `links-${dateStr}.json`);
  await writeFile(linksFile, JSON.stringify({
    extractedAt: new Date().toISOString(),
    filesProcessed,
    links: allNewLinks,
    entities: allNewEntities,
    stats: {
      totalLinks: allNewLinks.length,
      totalEntities: allNewEntities.length,
      filesProcessed: filesProcessed.length,
    },
  }, null, 2), 'utf-8');

  // Merge into graph
  const mergedLinks = [...existingLinks, ...allNewLinks];
  const graph = buildGraph(mergedLinks, existingSlugs);
  const graphFile = join(linksDir, 'graph.json');
  await writeFile(graphFile, JSON.stringify({
    ...graph,
    meta: {
      extractedAt: new Date().toISOString(),
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      avgConfidence: graph.edges.length > 0
        ? graph.edges.reduce((a, b) => a + b.confidence, 0) / graph.edges.length
        : 0,
    },
  }, null, 2), 'utf-8');

  if (!cli.quiet) {
    console.log(`\nWritten:`);
    console.log(`  ${linksFile}`);
    console.log(`  ${graphFile}`);
  }
}

main().catch(console.error);
