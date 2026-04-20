#!/usr/bin/env bun
/**
 * scripts/db-publish-personas.ts
 *
 * Publish distilled personas from /tmp/distill-*.json results into the database.
 * Creates DistilledPersona records and marks them as published.
 *
 * Usage:
 *   bun run scripts/db-publish-personas.ts --all           # publish all with results
 *   bun run scripts/db-publish-personas.ts --persona=elon-musk
 *   bun run scripts/db-publish-personas.ts --list
 */

import { parseArgs } from 'node:util';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

interface DistillResult {
  personaId?: string;
  persona?: Record<string, unknown>;
  finalScore: number;
  score?: { overall?: number; grade?: string; breakdown?: Record<string, number> };
  grade?: string;
  totalCost?: number;
  totalTokens?: number;
  thresholdPassed?: boolean;
  isNewPersona?: boolean;
  corpusStats?: { totalWords?: number; quality?: number };
  playtestReport?: { totalCases?: number; averageScore?: number };
  iterations?: number;
  completedAt?: string;
}

const PERSONA_MAP: Record<string, { name: string; nameZh: string; domain: string; id: string }> = {
  'wittgenstein':        { id: 'wittgenstein',        name: 'Wittgenstein',        nameZh: '维特根斯坦',    domain: 'philosophy' },
  'nassim-taleb':        { id: 'nassim-taleb',        name: 'Nassim Taleb',         nameZh: '纳西姆·塔勒布',  domain: 'philosophy' },
  'andrej-karpathy':     { id: 'andrej-karpathy',     name: 'Andrej Karpathy',      nameZh: 'Andrej Karpathy', domain: 'technology' },
  'ilya-sutskever':      { id: 'ilya-sutskever',      name: 'Ilya Sutskever',       nameZh: 'Ilya Sutskever',  domain: 'technology' },
  'zhang-xuefeng':       { id: 'zhang-xuefeng',       name: 'Zhang Xuefeng',        nameZh: '张学峰',         domain: 'philosophy' },
  'elon-musk':           { id: 'elon-musk',           name: 'Elon Musk',            nameZh: '埃隆·马斯克',    domain: 'technology' },
  'paul-graham':         { id: 'paul-graham',         name: 'Paul Graham',          nameZh: 'Paul Graham',     domain: 'technology' },
  'charlie-munger':      { id: 'charlie-munger',      name: 'Charlie Munger',        nameZh: '查理·芒格',      domain: 'investment' },
  'warren-buffett':      { id: 'warren-buffett',      name: 'Warren Buffett',       nameZh: '沃伦·巴菲特',    domain: 'investment' },
  'richard-feynman':      { id: 'richard-feynman',      name: 'Richard Feynman',      nameZh: '理查德·费曼',    domain: 'science' },
  'steve-jobs':          { id: 'steve-jobs',           name: 'Steve Jobs',           nameZh: '史蒂夫·乔布斯',  domain: 'product' },
  'zhang-yiming':        { id: 'zhang-yiming',        name: 'Zhang Yiming',         nameZh: '张一鸣',         domain: 'technology' },
  'jensen-huang':        { id: 'jensen-huang',        name: 'Jensen Huang',          nameZh: '黄仁勋',         domain: 'technology' },
};

async function loadDistillResult(personaId: string): Promise<DistillResult | null> {
  const path = `/tmp/distill-${personaId}.json`;
  try {
    const raw = await readFile(path, 'utf-8');
    // Skip curl progress output
    const start = raw.indexOf('{');
    if (start < 0) return null;
    const json = raw.slice(start);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(json) as any;
  } catch {
    return null;
  }
}

async function publishToDb(personaId: string, result: DistillResult): Promise<boolean> {
  const map = PERSONA_MAP[personaId];
  const persona = result.persona;

  const data = {
    slug: personaId,
    name: (persona?.name as string) ?? map?.name ?? personaId,
    nameZh: (persona?.nameZh as string) ?? map?.nameZh ?? personaId,
    nameEn: (persona?.nameEn as string) ?? map?.name ?? personaId,
    domain: (persona?.domain as string) ?? map?.domain ?? 'philosophy',
    tagline: (persona?.tagline as string) ?? '',
    taglineZh: (persona?.taglineZh as string) ?? '',
    avatar: (persona?.avatar as string) ?? '',
    accentColor: (persona?.accentColor as string) ?? '#6366f1',
    gradientFrom: (persona?.gradientFrom as string) ?? '#6366f1',
    gradientTo: (persona?.gradientTo as string) ?? '#8b5cf6',
    brief: (persona?.brief as string) ?? '',
    briefZh: (persona?.briefZh as string) ?? '',
    mentalModels: (persona?.mentalModels as string) ?? '[]',
    decisionHeuristics: (persona?.decisionHeuristics as string) ?? '[]',
    expressionDNA: (persona?.expressionDNA as string) ?? '{}',
    values: (persona?.values as string) ?? '[]',
    antiPatterns: (persona?.antiPatterns as string) ?? '[]',
    tensions: (persona?.tensions as string) ?? '[]',
    honestBoundaries: (persona?.honestBoundaries as string) ?? '[]',
    strengths: (persona?.strengths as string) ?? '[]',
    blindspots: (persona?.blindspots as string) ?? '[]',
    systemPromptTemplate: (persona?.systemPromptTemplate as string) ?? '',
    identityPrompt: (persona?.identityPrompt as string) ?? '',
    finalScore: result.finalScore,
    qualityGrade: result.score?.grade ?? result.grade ?? 'C',
    thresholdPassed: result.thresholdPassed ?? false,
    corpusItemCount: result.corpusStats?.totalWords ?? 0,
    corpusTotalWords: result.corpusStats?.totalWords ?? 0,
    distillVersion: (persona?.version as string) ?? '1.0.0',
    isPublished: true,
    isActive: true,
  };

  const sessionId = `batch-${personaId}`;

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    // Upsert DistillSession
    await prisma.distillSession.upsert({
      where: { id: sessionId },
      create: {
        id: sessionId,
        personaName: map?.nameZh ?? data.name,
        personaId: personaId,
        personaDomain: data.domain,
        status: 'completed',
        totalCost: result.totalCost ?? 0,
        totalTokens: result.totalTokens ?? 0,
      },
      update: {
        status: 'completed',
        totalCost: result.totalCost ?? 0,
        totalTokens: result.totalTokens ?? 0,
      },
    });

    // Upsert DistilledPersona
    await prisma.distilledPersona.upsert({
      where: { slug: personaId },
      create: {
        sessionId,
        slug: personaId,
        name: data.name,
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        domain: data.domain,
        tagline: data.tagline,
        taglineZh: data.taglineZh,
        avatar: data.avatar,
        accentColor: data.accentColor,
        gradientFrom: data.gradientFrom,
        gradientTo: data.gradientTo,
        brief: data.brief,
        briefZh: data.briefZh,
        mentalModels: data.mentalModels,
        decisionHeuristics: data.decisionHeuristics,
        expressionDNA: data.expressionDNA,
        values: data.values,
        antiPatterns: data.antiPatterns,
        tensions: data.tensions,
        honestBoundaries: data.honestBoundaries,
        strengths: data.strengths,
        blindspots: data.blindspots,
        systemPromptTemplate: data.systemPromptTemplate,
        identityPrompt: data.identityPrompt,
        finalScore: data.finalScore,
        qualityGrade: data.qualityGrade,
        thresholdPassed: data.thresholdPassed,
        corpusItemCount: data.corpusItemCount,
        corpusTotalWords: data.corpusTotalWords,
        distillVersion: data.distillVersion,
        isPublished: data.isPublished,
        isActive: data.isActive,
      },
      update: {
        name: data.name,
        nameZh: data.nameZh,
        nameEn: data.nameEn,
        domain: data.domain,
        tagline: data.tagline,
        taglineZh: data.taglineZh,
        brief: data.brief,
        briefZh: data.briefZh,
        mentalModels: data.mentalModels,
        decisionHeuristics: data.decisionHeuristics,
        expressionDNA: data.expressionDNA,
        values: data.values,
        tensions: data.tensions,
        honestBoundaries: data.honestBoundaries,
        strengths: data.strengths,
        blindspots: data.blindspots,
        systemPromptTemplate: data.systemPromptTemplate,
        identityPrompt: data.identityPrompt,
        finalScore: data.finalScore,
        qualityGrade: data.qualityGrade,
        thresholdPassed: data.thresholdPassed,
        isPublished: data.isPublished,
        isActive: data.isActive,
      },
    });

    await prisma.$disconnect();
    return true;
  } catch (err) {
    console.error(`  DB error for ${personaId}:`, err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    options: {
      all: { type: 'boolean' },
      list: { type: 'boolean' },
      persona: { type: 'string' },
    },
    allowPositionals: false,
  });

  if (values.list) {
    console.log('\nAvailable personas with results:\n');
    for (const [id, meta] of Object.entries(PERSONA_MAP)) {
      const result = await loadDistillResult(id);
      if (result) {
        const score = result.finalScore;
        const passed = result.thresholdPassed;
        const grade = result.score?.grade ?? result.grade ?? '?';
        console.log(`  ${id.padEnd(22)} score=${score} grade=${grade} passed=${passed} "${meta.nameZh}"`);
      }
    }
    return;
  }

  const toPublish = values.all
    ? Object.keys(PERSONA_MAP)
    : positionals.filter(Boolean);

  if (toPublish.length === 0) {
    console.log('Usage:');
    console.log('  bun run scripts/db-publish-personas.ts --all           # publish all');
    console.log('  bun run scripts/db-publish-personas.ts --list        # list available');
    console.log('  bun run scripts/db-publish-personas.ts <persona-id>  # publish one');
    return;
  }

  console.log(`\n=== Publishing ${toPublish.length} personas to database ===\n`);

  let success = 0;
  let failed = 0;

  for (const personaId of toPublish) {
    const result = await loadDistillResult(personaId);

    if (!result) {
      console.log(`  [SKIP] ${personaId} — no result file`);
      continue;
    }

    if (!result.thresholdPassed && personaId !== 'wittgenstein') {
      console.log(`  [SKIP] ${personaId} — below threshold (${result.finalScore}/100)`);
      continue;
    }

    console.log(`  [${result.finalScore}/${result.score?.grade ?? '?'}] ${personaId}...`);
    const ok = await publishToDb(personaId, result);
    if (ok) {
      console.log(`    ✓ Published to DB (isPublished=true)`);
      success++;
    } else {
      console.log(`    ✗ Failed to publish`);
      failed++;
    }
  }

  console.log(`\n=== Done: ${success} published, ${failed} failed ===\n`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
