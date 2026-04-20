/**
 * Prismatic — Distilled Persona Library API
 * GET /api/persona-library
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const published = searchParams.get('published');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'distillDate';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where: Record<string, unknown> = { isActive: true };
    if (domain) where.domain = domain;
    if (published === 'true') where.isPublished = true;
    if (search) {
      where.OR = [
        { nameZh: { contains: search, mode: 'insensitive' } },
        { nameEn: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Record<string, string> = {};
    if (sortBy === 'score') orderBy.finalScore = 'desc';
    else if (sortBy === 'name') orderBy.nameZh = 'asc';
    else orderBy.distillDate = 'desc';

    const personas = await prisma.distilledPersona.findMany({
      where,
      orderBy,
      take: limit,
      select: {
        id: true,
        slug: true,
        name: true,
        nameZh: true,
        nameEn: true,
        domain: true,
        tagline: true,
        taglineZh: true,
        avatar: true,
        accentColor: true,
        gradientFrom: true,
        gradientTo: true,
        brief: true,
        briefZh: true,
        finalScore: true,
        qualityGrade: true,
        thresholdPassed: true,
        qualityGateSkipped: true,
        corpusItemCount: true,
        corpusTotalWords: true,
        corpusSources: true,
        distillVersion: true,
        distillDate: true,
        isPublished: true,
        createdAt: true,
      },
    });

    const total = await prisma.distilledPersona.count({ where });

    return NextResponse.json({
      items: personas,
      total,
      domains: ['philosophy', 'science', 'business', 'technology', 'strategy', 'creativity', 'leadership', 'negotiation', 'economics', 'startup'],
    });
  } catch (err) {
    console.error('[PersonaLibrary GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
