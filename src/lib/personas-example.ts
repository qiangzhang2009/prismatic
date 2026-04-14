/**
 * Prismatic — Personas Registry Template
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  IMPORTANT: This is a TEMPLATE file for demonstration purposes.   ║
 * ║  For full functionality, set the PERSONAS_DATA environment variable   ║
 * ║  to your production persona dataset (JSON format).                   ║
 * ║                                                                       ║
 * ║  To contribute or self-host with real personas, see:                ║
 * ║  https://prismatic.zxqconsulting.com/methodology                     ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 *
 * This file shows the Persona data structure and a minimal example.
 * The actual production persona dataset is loaded from:
 *   1. Environment variable: PERSONAS_DATA (JSON string)
 *   2. Or request access: https://prismatic.zxqconsulting.com
 *
 * Data Structure Overview:
 * ─────────────────────────────────────────────────────────────────────────
 * A Persona consists of:
 *
 *   1. Identity          — name, domain, tagline
 *   2. Mental Models     — 3-7 core thinking frameworks (see MentalModel interface)
 *   3. Decision Heuristics — 5-10 fast decision rules (see DecisionHeuristic)
 *   4. Expression DNA    — voice, vocabulary, sentence patterns (see ExpressionDNA)
 *   5. Values & Tensions — what they optimize for and where they conflict
 *   6. Honest Boundaries — what this persona explicitly CANNOT do
 *   7. Sources           — cited works, interviews, biographies
 */

import type { Persona } from './types';

export const PERSONAS_EXAMPLE: Record<string, Persona> = {};

// ─── Example: Minimal Persona Template ──────────────────────────────────────────

/**
 * This is a minimal example persona to demonstrate the data structure.
 * Real production personas contain 5-15 mental models, 8-20 decision heuristics,
 * full expression DNA with 20+ vocabulary fingerprints, and 10+ source citations.
 *
 * To see a fully populated example, obtain the FULL_DATASET environment variable
 * from the Prismatic team or contribute your own distillation.
 */
PERSONAS_EXAMPLE['example-persona'] = {
  id: 'example-persona',
  slug: 'example-persona',
  name: 'Example Persona',
  nameZh: '示例人物',
  nameEn: 'Example',
  domain: ['thinking', 'strategy'],
  tagline: 'A minimal example showing the Persona structure',
  taglineZh: '展示人物数据结构的最小示例',
  avatar: 'https://ui-avatars.com/api/?name=EP&background=4d96ff&color=fff&bold=true&format=svg',
  accentColor: '#4d96ff',
  gradientFrom: '#4d96ff',
  gradientTo: '#c77dff',
  brief: 'This is a template persona demonstrating the data structure for contributors.',
  briefZh: '这是展示给贡献者的模板人物数据结构示例。',

  mentalModels: [
    {
      id: 'example-model',
      name: 'Example Thinking Framework',
      nameZh: '示例思维框架',
      oneLiner: 'A concise description of this mental model in one line.',
      evidence: [
        {
          quote: 'An example quote from the source material.',
          source: 'Book or Article Title',
          year: 2024,
          url: 'https://example.com',
        },
      ],
      crossDomain: ['business', 'science'],
      application: 'Describe when and how to apply this model.',
      limitation: 'Describe the conditions under which this model fails.',
      generationPower: 'high | medium | low',
      exclusivity: 'unique to this persona | shared across many thinkers',
    },
  ],

  decisionHeuristics: [
    {
      id: 'example-heuristic',
      name: 'Example Decision Rule',
      nameZh: '示例决策规则',
      description: 'A short description of the decision heuristic.',
      application: 'When to apply this heuristic.',
    },
  ],

  expressionDNA: {
    sentenceStyle: ['Declarative', 'Analytical', 'Example: shows not tells'],
    vocabulary: ['keyword1', 'keyword2', 'keyword3'],
    forbiddenWords: ['never_say_this', 'avoid_this_phrase'],
    certaintyLevel: 'high',
    toneShifts: 0,
    humorStyle: 'dry',
    rhetoricalHabit: 'Uses questions to guide thinking',
    chineseAdaptation: 'Adaptation rules for Chinese language responses',
  },

  values: [
    { id: 'val1', name: 'Value Name', nameZh: '价值观名称', description: 'Why this value matters.' },
  ],

  antiPatterns: [
    'Explicitly reject this behavior',
    'Never do this',
  ],

  tensions: [
    {
      tension: 'Tension Name',
      tensionZh: '内在张力名称',
      description: 'The internal conflict this persona navigates.',
      descriptionZh: '这个人物需要解决的内在矛盾。',
    },
  ],

  honestBoundaries: [
    { text: 'What this persona explicitly cannot do.' },
  ],

  strengths: ['Area 1', 'Area 2'],
  blindspots: ['Known blindspot 1', 'Known blindspot 2'],

  sources: [
    {
      type: 'primary',
      title: 'Primary Source Title',
      url: 'https://example.com',
    },
  ],

  researchDate: '2026-01-01',
  version: '0.1.0',

  researchDimensions: [
    {
      dimension: 'Dimension Name',
      dimensionZh: '维度名称',
      focus: ['Focus Area 1', 'Focus Area 2'],
    },
  ],

  systemPromptTemplate:
    'You are {nameZh}, {taglineZh}. Respond in character using your mental models: {mentalModelNames}.',
  identityPrompt:
    'You are {nameZh} ({name}). {briefZh}',
};

// ─── Load Production Personas ────────────────────────────────────────────────────

/**
 * Loads the full persona dataset from environment variable PERSONAS_DATA.
 * In production, set PERSONAS_DATA=<base64-encoded JSON> in .env.local
 *
 * Fallback: If PERSONAS_DATA is not set, only PERSONAS_EXAMPLE is available.
 */
export function loadPersonas(): Record<string, Persona> {
  const envData = process.env.PERSONAS_DATA;
  if (!envData) {
    // No data provided — return example only
    return PERSONAS_EXAMPLE;
  }

  try {
    const decoded = Buffer.from(envData, 'base64').toString('utf-8');
    const data = JSON.parse(decoded);
    return { ...PERSONAS_EXAMPLE, ...data } as Record<string, Persona>;
  } catch (err) {
    console.error('[Personas] Failed to parse PERSONAS_DATA, using example only:', err);
    return PERSONAS_EXAMPLE;
  }
}

// Default export is the example set (safe for public consumption)
export default PERSONAS_EXAMPLE;
