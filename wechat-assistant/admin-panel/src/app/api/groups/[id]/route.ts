// GET/PATCH/DELETE /api/groups/[id]
import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    const group = await db.group.findUnique({
      where: { id },
      include: { persona: true },
    });
    if (!group) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ group });
  } catch (error) {
    console.error('[API/groups/[id]/GET]', error);
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    const body = await request.json();
    const group = await db.group.update({
      where: { id },
      data: {
        name: body.name,
        personaId: body.personaId,
        policy: body.policy,
        keywords: body.keywords ? JSON.stringify(body.keywords) : undefined,
        isActive: body.isActive,
      },
    });
    return NextResponse.json({ group });
  } catch (error) {
    console.error('[API/groups/[id]/PATCH]', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { db } = await import('@/lib/db');
    const { id } = await params;
    await db.group.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/groups/[id]/DELETE]', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
