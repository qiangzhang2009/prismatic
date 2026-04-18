/**
 * Comments API - PATCH (admin actions) and DELETE
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, authenticateAdminRequest } from '@/lib/user-management';

const prisma = new PrismaClient();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const body = await req.json();
    const { action, content } = body;

    if (action === 'hide') {
      await prisma.comment.update({
        where: { id },
        data: { status: 'deleted' },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'show') {
      await prisma.comment.update({
        where: { id },
        data: { status: 'published' },
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'edit' && content !== undefined) {
      await prisma.comment.update({
        where: { id },
        data: { content, updatedAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Comment admin action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await authenticateRequest(req);
  const adminId = await authenticateAdminRequest(req);

  if (!userId && !adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const isAdminUser = !!adminId;
    if (comment.userId !== userId && !isAdminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.comment.update({
      where: { id },
      data: { status: 'deleted' },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
