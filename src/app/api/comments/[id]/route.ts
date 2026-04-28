/**
 * Comments API - GET, PATCH (admin actions) and DELETE
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateRequest, authenticateAdminRequest } from '@/lib/user-management';
import { PERSONAS } from '@/lib/personas';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

/**
 * GET /api/comments/[id] — Fetch a single comment (used for guardian reply polling)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const cookieStore = await cookies();
    const visitorId = cookieStore.get('prismatic-visitor')?.value || 'anonymous';

    // Build reactions map and userReaction
    const counts: Record<string, number> = {};
    let userReaction: string | null = null;
    const rawReactions = comment.reactions as any[];
    if (Array.isArray(rawReactions)) {
      for (const r of rawReactions) {
        if (r && typeof r === 'object' && typeof r.emoji === 'string') {
          counts[r.emoji] = (counts[r.emoji] || 0) + 1;
          if (r.visitorId === visitorId) {
            userReaction = r.emoji;
          }
        }
      }
    }

    const replyCount = await prisma.comment.count({
      where: { parentId: id, status: 'published' },
    });

    return NextResponse.json({
      comment: {
        id: comment.id,
        content: comment.content,
        author_name: comment.nickname,
        author_avatar: null,
        display_name: comment.nickname,
        gender: comment.gender || null,
        location: null,
        created_at: comment.createdAt?.toISOString() || new Date().toISOString(),
        updated_at: comment.updatedAt?.toISOString() || new Date().toISOString(),
        is_pinned: false,
        is_edited: comment.updatedAt.getTime() > comment.createdAt.getTime(),
        likes: 0,
        reactions: counts,
        reactionCount: Object.values(counts).reduce((a: number, b: number) => a + b, 0),
        userReaction,
        view_count: 0,
        report_count: 0,
        replyCount,
        personaSlug: comment.personaSlug,
        mentionedGuardianId: comment.mentionedGuardianId ?? null,
        mentionedGuardianReply: comment.mentionedGuardianReply ?? null,
        mentionedGuardianRepliedAt: comment.mentionedGuardianRepliedAt
          ? comment.mentionedGuardianRepliedAt.toISOString()
          : null,
        mentionedGuardianName: comment.mentionedGuardianId
          ? PERSONAS[comment.mentionedGuardianId]?.nameZh ?? null
          : null,
        mentionHint: null,
        ipHash: comment.ipHash,
        userId: comment.userId,
      },
    });
  } catch (error) {
    console.error('Failed to fetch comment:', error);
    return NextResponse.json({ error: 'Failed to fetch comment' }, { status: 500 });
  }
}

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
        data: { content },
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
