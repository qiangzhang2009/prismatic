// GET/PATCH/DELETE /api/feedback/[id]
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    const feedback = await db.feedback.findUnique({ where: { id } });
    if (!feedback) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('[API/feedback/[id]/GET]', error);
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    const body = await request.json();
    const feedback = await db.feedback.update({
      where: { id },
      data: {
        status: body.status,
        sentiment: body.sentiment,
        tags: body.tags ? JSON.stringify(body.tags) : undefined,
        notes: body.notes,
        reviewedBy: body.reviewedBy,
        reviewedAt: body.status ? new Date() : undefined,
      },
    });
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('[API/feedback/[id]/PATCH]', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    await db.feedback.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/feedback/[id]/DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
