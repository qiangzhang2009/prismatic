/**
 * Comments Replies API - GET (list replies for a comment)
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getAvatarUrl } from '@/lib/geo';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');

  if (!parentId) {
    return NextResponse.json({ error: 'parentId is required' }, { status: 400 });
  }

  try {
    const replies = await prisma.comment.findMany({
      where: {
        parentId,
        status: 'published',
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      replies: replies.map(r => {
        const avatarUrl = r.avatarSeed
          ? getAvatarUrl(r.avatarSeed, r.gender || undefined)
          : null;
        const location = [r.geoCountry, r.geoRegion, r.geoCity]
          .filter(Boolean)
          .join(' · ') || null;
        return {
          id: r.id,
          content: r.content,
          author_name: r.nickname,
          author_avatar: null,
          display_name: r.nickname,
          avatar_url: avatarUrl,
          gender: r.gender || null,
          location,
          created_at: r.createdAt.toISOString(),
          updated_at: r.updatedAt.toISOString(),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch replies:', error);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
}
