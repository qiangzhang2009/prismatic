/**
 * Prismatic — Admin Distillation Session API
 * GET /api/admin/distill/[sessionId]
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ sessionId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const session = await prisma.distillSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      personaName: session.personaName,
      personaId: session.personaId,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      options: session.options ?? {},
      error: session.error,
      result: session.result ?? null,
      totalCost: session.totalCost,
      totalTokens: session.totalTokens,
    });
  } catch (err) {
    console.error('[Admin Distill Session GET]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
    const session = await prisma.distillSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.status === 'running') {
      await prisma.distillSession.update({
        where: { id: sessionId },
        data: {
          status: 'cancelled',
          completedAt: new Date(),
          error: 'Cancelled by admin',
        },
      });
    }

    return NextResponse.json({
      sessionId,
      status: session.status === 'running' ? 'cancelled' : session.status,
      message:
        session.status === 'running'
          ? 'Running distillation has been cancelled'
          : 'Session status updated',
    });
  } catch (err) {
    console.error('[Admin Distill Session DELETE]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
