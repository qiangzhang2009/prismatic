/**
 * Comments Reactions API - POST (add/remove reaction)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

const VALID_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '💯', '✨', '🎉'];

async function getVisitorId(): Promise<string> {
  const cookieStore = await cookies();
  let visitorId = cookieStore.get('prismatic-visitor')?.value;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
  }
  return visitorId;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { emoji } = body;

    if (!VALID_REACTIONS.includes(emoji)) {
      return NextResponse.json({ error: 'Invalid reaction' }, { status: 400 });
    }

    const visitorId = await getVisitorId();

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    }

    const reactions: any[] = typeof comment.reactions === 'string'
      ? JSON.parse(comment.reactions as string)
      : (comment.reactions || []);

    const existingIndex = reactions.findIndex(
      (r: any) => r.emoji === emoji && r.visitorId === visitorId
    );

    if (existingIndex >= 0) {
      reactions.splice(existingIndex, 1);
    } else {
      reactions.push({ emoji, visitorId, addedAt: new Date().toISOString() });
    }

    await prisma.comment.update({
      where: { id },
      data: { reactions: JSON.stringify(reactions) },
    });

    const counts: Record<string, number> = {};
    for (const r of reactions) {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    }

    const userReacted = reactions.some((r: any) => r.visitorId === visitorId);

    return NextResponse.json({
      success: true,
      counts,
      userReacted,
      total: reactions.length
    });
  } catch (error) {
    console.error('Failed to add reaction:', error);
    return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 });
  }
}
