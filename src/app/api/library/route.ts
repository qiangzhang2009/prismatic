/**
 * Library API — Wisdom Mentor Persona Library
 *
 * GET /api/library
 *   ?domain=philosophy,technology
 *   ?tier=FREE,MONTHLY,LIFETIME
 *   ?search=关键词
 *   ?sortBy=score|name|tier|grade|created
 *   ?page=1&limit=20
 *   ?published=true
 *
 * Returns personas with tier info, corpus stats, and whether the current
 * user (auth via session) can access them based on subscription.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

// ─── Tier Config ─────────────────────────────────────────────────────────────────

export const TIER_CONFIG = {
  FREE: {
    label: '免费体验', labelEn: 'Free',
    color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.25)',
    icon: '🌿', description: '可体验基础对话', price: '¥0',
  },
  MONTHLY: {
    label: '月度订阅', labelEn: 'Monthly',
    color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
    icon: '📜', description: '解锁全部思维模型', price: '¥39/月',
  },
  LIFETIME: {
    label: '终身珍藏', labelEn: 'Lifetime',
    color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    icon: '🏛️', description: '古籍原文深度对话', price: '¥299 终身',
  },
} as const;

export type TierKey = keyof typeof TIER_CONFIG;

function tierFromGrade(grade: string, score: number): TierKey {
  if (grade === 'A' || score >= 85) return 'LIFETIME';
  if (grade === 'B' || (score >= 70 && score < 85)) return 'MONTHLY';
  return 'FREE';
}

const TIER_RANK: Record<TierKey, number> = { FREE: 0, MONTHLY: 1, LIFETIME: 2 };

// ─── GET Handler ────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json({ personas: [], total: 0, page: 1, limit: 24, totalPages: 0, userTier: 'FREE', error: 'No DB' }, { status: 500 });
  }

  const pool = new Pool({ connectionString });

  try {
    const { searchParams } = req.nextUrl;
    const domains = (searchParams.get('domain') ?? '').split(',').filter(Boolean);
    const tiers = (searchParams.get('tier') ?? '').split(',').filter(Boolean) as TierKey[];
    const search = (searchParams.get('search') ?? '').trim();
    const sortBy = searchParams.get('sortBy') ?? 'score';
    const sortDir = (searchParams.get('sortDir') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '24')));
    const publishedOnly = searchParams.get('published') === 'true';

    // Auth
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id ?? null;

    // Get user subscription tier
    let userTier: TierKey = 'FREE';
    if (userId) {
      try {
        const userResult = await pool.query(
          `SELECT plan FROM users WHERE id = $1 AND status = 'ACTIVE'`,
          [userId]
        );
        if (userResult.rows.length > 0) {
          const plan = userResult.rows[0].plan;
          if (plan === 'LIFETIME') userTier = 'LIFETIME';
          else if (plan === 'YEARLY' || plan === 'MONTHLY') userTier = 'MONTHLY';
        }
      } catch { /* ignore */ }
    }

    // Build conditions
    const conditions: string[] = ['dp."isActive" = true'];
    const params: any[] = [];
    let pIdx = 1;

    if (publishedOnly) {
      conditions.push('dp."isPublished" = true');
    }

    if (domains.length > 0) {
      conditions.push(`dp."domain" = ANY($${pIdx}::text[])`);
      params.push(domains);
      pIdx++;
    }

    if (search) {
      conditions.push(`(
        dp."nameZh" ILIKE $${pIdx} OR
        dp.name ILIKE $${pIdx} OR
        dp."briefZh" ILIKE $${pIdx} OR
        dp.tagline ILIKE $${pIdx} OR
        dp."taglineZh" ILIKE $${pIdx}
      )`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sort
    const sortMap: Record<string, string> = {
      score: 'dp."finalScore"',
      name: 'dp."nameZh"',
      grade: 'dp."qualityGrade"',
      created: 'dp."createdAt"',
    };
    const sortCol = sortMap[sortBy] ?? 'dp."finalScore"';

    // Count query
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM distilled_personas dp
      ${where}
    `, params);
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    // Main query
    const offset = (page - 1) * limit;
    const rowsResult = await pool.query(`
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
        dp."finalScore",
        dp."qualityGrade",
        dp."mentalModels",
        dp."expressionDNA",
        dp."values",
        dp."systemPromptTemplate",
        dp."identityPrompt",
        dp."distillVersion",
        dp."distillDate",
        dp."corpusItemCount",
        dp."corpusTotalWords",
        dp."isPublished",
        dp."createdAt",
        p.icon as "personaIcon"
      FROM distilled_personas dp
      LEFT JOIN personas p ON p.slug = dp.slug
      ${where}
      ORDER BY ${sortCol} ${sortDir} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    // Map rows to response
    const personas = rowsResult.rows.map(row => {
      const grade = row.qualityGrade ?? 'C';
      const score = typeof row.finalScore === 'number' ? row.finalScore : parseFloat(row.finalScore ?? '75');
      const assignedTier = tierFromGrade(grade, score);
      const userTierRank = TIER_RANK[userTier];
      const requiredTierRank = TIER_RANK[assignedTier];
      const canAccess = userTierRank >= requiredTierRank;

      return {
        slug: row.slug,
        name: row.name,
        nameZh: row.nameZh ?? row.name,
        nameEn: row.nameEn,
        domain: row.domain,
        tagline: row.tagline,
        taglineZh: row.taglineZh,
        accentColor: row.accentColor ?? '#6366f1',
        gradientFrom: row.gradientFrom ?? '#6366f1',
        gradientTo: row.gradientTo ?? '#8b5cf6',
        avatar: row.avatar,
        brief: row.brief,
        briefZh: row.briefZh ?? row.brief,
        mentalModels: canAccess ? row.mentalModels : null,
        expressionDNA: canAccess ? row.expressionDNA : null,
        values: canAccess ? row.values : null,
        systemPromptTemplate: canAccess ? row.systemPromptTemplate : null,
        identityPrompt: canAccess ? row.identityPrompt : null,
        finalScore: score,
        qualityGrade: grade,
        distillVersion: row.distillVersion,
        distillDate: row.distillDate,
        corpusItemCount: row.corpusItemCount ?? 0,
        corpusTotalWords: row.corpusTotalWords ?? 0,
        tier: assignedTier,
        tierConfig: TIER_CONFIG[assignedTier],
        canAccess,
        isPublished: row.isPublished,
        createdAt: row.createdAt,
        icon: row.personaIcon,
      };
    });

    // Tier filter
    const filtered = tiers.length > 0
      ? personas.filter(p => tiers.includes(p.tier))
      : personas;

    return NextResponse.json({
      personas: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      userTier,
      userTierConfig: TIER_CONFIG[userTier],
    });
  } catch (err) {
    console.error('[Library API] Error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  } finally {
    await pool.end();
  }
}
