/**
 * Prismatic — Single Distilled Persona API
 * GET /api/persona-library/[slug]
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;

    // Try DB first
    let persona = await prisma.distilledPersona.findUnique({
      where: { slug },
      include: {
        session: {
          include: {
            corpus: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                collectorType: true,
                source: true,
                sourceName: true,
                author: true,
                url: true,
                publishedAt: true,
                wordCount: true,
                language: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (persona) {
      return NextResponse.json({
        source: 'distilled',
        persona,
        corpusItems: persona.session?.corpus ?? [],
      });
    }

    // Fall back to code personas
    const { getPersonaById } = await import('@/lib/personas');
    const codePersona = getPersonaById(slug);
    if (codePersona) {
      return NextResponse.json({
        source: 'code',
        persona: codePersona,
        corpusItems: [],
      });
    }

    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  } catch (err) {
    console.error('[PersonaLibrary GET slug]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const body = await req.json();

    const persona = await prisma.distilledPersona.update({
      where: { slug },
      data: {
        isPublished: body.isPublished ?? undefined,
        isActive: body.isActive ?? undefined,
        tagline: body.tagline,
        taglineZh: body.taglineZh,
        brief: body.brief,
        briefZh: body.briefZh,
        avatar: body.avatar,
        accentColor: body.accentColor,
        gradientFrom: body.gradientFrom,
        gradientTo: body.gradientTo,
        // Allow updating core distillation fields
        mentalModels: body.mentalModels,
        decisionHeuristics: body.decisionHeuristics,
        expressionDNA: body.expressionDNA,
        values: body.values,
        antiPatterns: body.antiPatterns,
        tensions: body.tensions,
        honestBoundaries: body.honestBoundaries,
        strengths: body.strengths,
        blindspots: body.blindspots,
        systemPromptTemplate: body.systemPromptTemplate,
        identityPrompt: body.identityPrompt,
      },
    });

    return NextResponse.json(persona);
  } catch (err) {
    console.error('[PersonaLibrary PUT]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    await prisma.distilledPersona.update({
      where: { slug },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true, slug });
  } catch (err) {
    console.error('[PersonaLibrary DELETE]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
