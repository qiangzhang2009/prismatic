/**
 * Admin: Library Seeding Endpoint
 *
 * POST /api/admin/library/seed
 *   Seeds DistilledPersona table from hardcoded personas.ts
 *   Body: { dryRun?: boolean, slugs?: string[] }
 *
 * Auth: Requires ADMIN role
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PERSONAS } from '@/lib/personas';
import { readdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'url';

export const runtime = 'nodejs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getCorpusStats(slug: string) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const base = join(__dirname, '../../../corpus', slug, 'texts');
  try {
    const entries = await readdir(base);
    const txtFiles = entries.filter((f: string) => f.endsWith('.txt'));
    let totalBytes = 0;
    for (const f of txtFiles) {
      try { totalBytes += (await stat(join(base, f))).size; } catch { /* skip */ }
    }
    return { textSizeMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)), fileCount: txtFiles.length };
  } catch { return { textSizeMB: 0, fileCount: 0 }; }
}

function assignTier(grade: string, score: number) {
  if (grade === 'A' || score >= 85) return 'LIFETIME';
  if (grade === 'B' || (score >= 70 && score < 85)) return 'MONTHLY';
  return 'FREE';
}

function makeSystemPrompt(p: any): string {
  const mms = (p.mentalModels || []).map((m: any) => `· ${m.nameZh || m.name}`).join('\n');
  const vals = (p.values || []).map((v: any) => `· ${v.nameZh || v.name}`).join('\n');
  return `【身份】\n你是 ${p.nameZh || p.name}。\n\n【简介】\n${p.briefZh || p.brief}\n\n【核心思维模型】\n${mms || '（未定义）'}\n\n【价值观】\n${vals || '（未定义）'}\n\n请基于以上人物设定，用中文回答用户的问题。`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const userResult = await pool.query(
      `SELECT role FROM users WHERE id = $1 AND status = 'ACTIVE'`,
      [userId]
    );
    if (!userResult.rows.length || userResult.rows[0].role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden — Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true;
    const targetSlugs = Array.isArray(body.slugs) ? body.slugs : null;

    const allSlugs = targetSlugs || Object.keys(PERSONAS);
    console.log(`[Admin/Seed] Starting seed for ${allSlugs.length} personas (dryRun=${dryRun})`);

    const results: Array<{ slug: string; status: string; tier: string; error?: string }> = [];

    for (const slug of allSlugs) {
      const p = PERSONAS[slug as keyof typeof PERSONAS];
      if (!p) { results.push({ slug, status: 'skip', tier: '', error: 'Not in PERSONAS registry' }); continue; }

      const stats = await getCorpusStats(slug);
      const score = (p as any).distillation?.score ?? 75;
      const grade = (p as any).distillation?.grade ?? 'C';
      const tier = assignTier(grade, score);
      const sessionId = `seed-${slug}-${Date.now()}`;

      const data = {
        slug,
        name: p.name || slug,
        nameZh: p.nameZh || p.name || slug,
        nameEn: p.nameEn || p.name || slug,
        domain: Array.isArray(p.domain) ? p.domain[0] : (p.domain || 'philosophy'),
        tagline: p.tagline || '',
        taglineZh: p.taglineZh || p.tagline || '',
        avatar: p.avatar || '',
        accentColor: p.accentColor || '#6366f1',
        gradientFrom: p.gradientFrom || '#6366f1',
        gradientTo: p.gradientTo || '#8b5cf6',
        brief: (p.brief || '').slice(0, 300),
        briefZh: (p.briefZh || p.brief || '').slice(0, 500),
        mentalModels: JSON.stringify(p.mentalModels || []),
        decisionHeuristics: JSON.stringify(p.decisionHeuristics || []),
        expressionDNA: JSON.stringify(p.expressionDNA || {}),
        values: JSON.stringify(p.values || []),
        antiPatterns: JSON.stringify(p.antiPatterns || []),
        tensions: JSON.stringify(p.tensions || []),
        honestBoundaries: JSON.stringify(p.honestBoundaries || []),
        strengths: JSON.stringify(p.strengths || []),
        blindspots: JSON.stringify(p.blindspots || []),
        systemPromptTemplate: makeSystemPrompt(p),
        identityPrompt: `你是 ${p.nameZh || p.name}，${(p.briefZh || p.brief || '').slice(0, 100)}`,
        finalScore: score,
        qualityGrade: grade,
        thresholdPassed: grade !== 'F' && grade !== 'D',
        qualityGateSkipped: false,
        scoreBreakdown: JSON.stringify((p as any).distillation?.breakdown || {}),
        scoreFindings: JSON.stringify((p as any).distillation?.findings || []),
        corpusItemCount: stats.fileCount,
        corpusTotalWords: Math.round(stats.textSizeMB * 250000),
        corpusSources: JSON.stringify([`corpus/${slug}`]),
        distillVersion: (p as any).distillation?.version || '1.0.0',
        isPublished: true,
        isActive: true,
        _tier: tier,
      };

      if (dryRun) {
        results.push({ slug, status: 'ok', tier, error: `would seed (score=${score}, grade=${grade}, corpus=${stats.textSizeMB}MB)` });
        continue;
      }

      try {
        await pool.query(`
          INSERT INTO distill_sessions (id, "personaName", "personaId", "personaDomain", status, "totalCost", "totalTokens", "distillDate")
          VALUES ($1, $2, $3, $4, 'completed', 0, 0, NOW())
          ON CONFLICT (id) DO UPDATE SET status = 'completed'
        `, [sessionId, data.nameZh, slug, data.domain]);

        const cols = Object.keys(data).filter(k => !k.startsWith('_'));
        const vals = [...cols.map(c => data[c as keyof typeof data]), sessionId];

        await pool.query(`
          INSERT INTO distilled_personas (${['sessionId', ...cols].map(c => `"${c}"`).join(', ')})
          VALUES ($${cols.length + 1}, ${cols.map((_, i) => `$${i + 1}`).join(', ')})
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            "nameZh" = EXCLUDED."nameZh",
            brief = EXCLUDED.brief,
            "briefZh" = EXCLUDED."briefZh",
            mentalModels = EXCLUDED."mentalModels",
            values = EXCLUDED.values,
            strengths = EXCLUDED.strengths,
            blindspots = EXCLUDED.blindspots,
            "systemPromptTemplate" = EXCLUDED."systemPromptTemplate",
            "identityPrompt" = EXCLUDED."identityPrompt",
            "finalScore" = EXCLUDED."finalScore",
            "qualityGrade" = EXCLUDED."qualityGrade",
            "thresholdPassed" = EXCLUDED."thresholdPassed",
            "corpusItemCount" = EXCLUDED."corpusItemCount",
            "corpusTotalWords" = EXCLUDED."corpusTotalWords",
            "distillVersion" = EXCLUDED."distillVersion",
            "isPublished" = EXCLUDED."isPublished",
            "isActive" = EXCLUDED."isActive"
        `, vals);

        // Upsert Persona table for analytics
        await pool.query(`
          INSERT INTO personas (slug, name, "nameZh", description, domain, icon)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (slug) DO UPDATE SET
            name = EXCLUDED.name,
            "nameZh" = EXCLUDED."nameZh",
            description = EXCLUDED.description,
            domain = EXCLUDED.domain
        `, [slug, data.name, data.nameZh, data.briefZh.slice(0, 200), data.domain, data.avatar || null]);

        results.push({ slug, status: 'ok', tier, error: `score=${score} grade=${grade} corpus=${stats.textSizeMB}MB` });
        console.log(`  [OK] ${slug} -> tier=${tier} (score=${score})`);
      } catch (err: any) {
        results.push({ slug, status: 'error', tier, error: err.message.slice(0, 80) });
        console.error(`  [ERROR] ${slug}: ${err.message.slice(0, 80)}`);
      }
    }

    const ok = results.filter(r => r.status === 'ok').length;
    const skip = results.filter(r => r.status === 'skip').length;
    const errors = results.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: !dryRun && errors === 0,
      dryRun,
      summary: { total: results.length, ok, skip, errors },
      results,
      message: dryRun
        ? `Dry run complete. Would seed ${ok} personas.`
        : `Seeding complete: ${ok} seeded, ${errors} errors, ${skip} skipped.`,
    });
  } catch (err) {
    console.error('[Admin/Seed] Fatal:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
