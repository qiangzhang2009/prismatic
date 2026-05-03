/**
 * Library Single Persona API
 *
 * GET /api/library/[slug]
 *   Returns full persona data if user has access (subscription tier).
 *   If no auth: returns public data only (name, brief, tier, score).
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

const TIER_RANK: Record<string, number> = { FREE: 0, MONTHLY: 1, LIFETIME: 2 };

function tierFromGrade(grade: string, score: number): string {
  if (grade === 'A' || score >= 85) return 'LIFETIME';
  if (grade === 'B' || (score >= 70 && score < 85)) return 'MONTHLY';
  return 'FREE';
}

const TIER_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: string; price: string }> = {
  FREE: { label: '免费体验', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.12)', borderColor: 'rgba(34, 197, 94, 0.25)', icon: '🌿', price: '¥0' },
  MONTHLY: { label: '月度订阅', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.12)', borderColor: 'rgba(168, 85, 247, 0.3)', icon: '📜', price: '¥39/月' },
  LIFETIME: { label: '终身珍藏', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)', icon: '🏛️', price: '¥299 终身' },
};

const DOMAIN_LABELS: Record<string, { zh: string; en: string }> = {
  philosophy: { zh: '哲学思想', en: 'Philosophy' },
  technology: { zh: '科技商业', en: 'Technology' },
  investment: { zh: '投资智慧', en: 'Investment' },
  science: { zh: '科学研究', en: 'Science' },
  product: { zh: '产品设计', en: 'Product' },
  medicine: { zh: '传统医学', en: 'Medicine' },
  history: { zh: '历史人物', en: 'History' },
  literature: { zh: '文学艺术', en: 'Literature' },
  politics: { zh: '政治思想', en: 'Politics' },
};

async function getUserTier(pool: Pool, userId: string | null): Promise<string> {
  if (!userId) return 'FREE';
  try {
    const r = await pool.query(`SELECT plan FROM users WHERE id = $1 AND status = 'ACTIVE'`, [userId]);
    if (!r.rows.length) return 'FREE';
    const p = r.rows[0].plan;
    if (p === 'LIFETIME') return 'LIFETIME';
    if (p === 'YEARLY' || p === 'MONTHLY') return 'MONTHLY';
    return 'FREE';
  } catch { return 'FREE'; }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ error: 'No DB connection' }, { status: 500 });
  }

  const pool = new Pool({ connectionString });

  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;
    const userTier = await getUserTier(pool, userId);
    const userTierRank = TIER_RANK[userTier] ?? 0;

    const result = await pool.query(`
      SELECT
        dp.slug,
        dp.name,
        dp."nameZh",
        dp."nameEn",
        dp.domain,
        dp.tagline,
        dp."taglineZh",
        dp."accentColor",
        dp."gradientFrom",
        dp."gradientTo",
        dp.avatar,
        dp.brief,
        dp."briefZh",
        dp."mentalModels",
        dp."decisionHeuristics",
        dp."expressionDNA",
        dp."values",
        dp."antiPatterns",
        dp."tensions",
        dp."honestBoundaries",
        dp."strengths",
        dp."blindspots",
        dp."systemPromptTemplate",
        dp."identityPrompt",
        dp."finalScore",
        dp."qualityGrade",
        dp."thresholdPassed",
        dp."scoreBreakdown",
        dp."scoreFindings",
        dp."corpusItemCount",
        dp."corpusTotalWords",
        dp."corpusSources",
        dp."distillVersion",
        dp."distillDate",
        dp."isPublished",
        dp."createdAt",
        dp."updatedAt",
        p.icon as "personaIcon"
      FROM distilled_personas dp
      LEFT JOIN personas p ON p.slug = dp.slug
      WHERE dp.slug = $1 AND dp."isActive" = true
    `, [slug]);

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const row = result.rows[0];
    const grade = row.qualityGrade ?? 'C';
    const score = typeof row.finalScore === 'number' ? row.finalScore : parseFloat(row.finalScore ?? '75');
    const assignedTier = tierFromGrade(grade, score);
    const requiredRank = TIER_RANK[assignedTier] ?? 0;
    const canAccess = userTierRank >= requiredRank;

    return NextResponse.json({
      slug: row.slug,
      name: row.name,
      nameZh: row.nameZh ?? row.name,
      nameEn: row.nameEn,
      domain: row.domain,
      domainLabel: DOMAIN_LABELS[row.domain] ?? { zh: row.domain, en: row.domain },
      tagline: row.tagline,
      taglineZh: row.taglineZh,
      accentColor: row.accentColor ?? '#6366f1',
      gradientFrom: row.gradientFrom ?? '#6366f1',
      gradientTo: row.gradientTo ?? '#8b5cf6',
      avatar: row.avatar,
      brief: row.brief,
      briefZh: row.briefZh ?? row.brief,
      mentalModels: canAccess ? row.mentalModels : null,
      decisionHeuristics: canAccess ? row.decisionHeuristics : null,
      expressionDNA: canAccess ? row.expressionDNA : null,
      values: canAccess ? row.values : null,
      antiPatterns: canAccess ? row.antiPatterns : null,
      tensions: canAccess ? row.tensions : null,
      honestBoundaries: canAccess ? row.honestBoundaries : null,
      strengths: canAccess ? row.strengths : null,
      blindspots: canAccess ? row.blindspots : null,
      systemPromptTemplate: canAccess ? row.systemPromptTemplate : null,
      identityPrompt: canAccess ? row.identityPrompt : null,
      finalScore: score,
      qualityGrade: grade,
      thresholdPassed: row.thresholdPassed,
      scoreBreakdown: row.scoreBreakdown,
      distillVersion: row.distillVersion,
      distillDate: row.distillDate,
      corpusItemCount: row.corpusItemCount ?? 0,
      corpusTotalWords: row.corpusTotalWords ?? 0,
      corpusSources: row.corpusSources,
      tier: assignedTier,
      tierConfig: TIER_CONFIG[assignedTier],
      canAccess,
      isPublished: row.isPublished,
      icon: row.personaIcon,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      requiresTier: assignedTier,
    });
  } catch (err) {
    console.error('[Library/[slug]] Error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}
