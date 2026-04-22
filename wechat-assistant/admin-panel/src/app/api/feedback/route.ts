// GET /api/feedback — 获取反馈列表
// POST /api/feedback — 创建反馈
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/feedback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const groupId = searchParams.get('groupId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (groupId) where.groupId = groupId;

    const feedbacks = await db.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { group: { select: { name: true } } },
    });

    const total = await db.feedback.count({ where });

    return NextResponse.json({ feedbacks, total });
  } catch (error) {
    console.error('[API/feedback/GET]', error);
    // Graceful degradation: return empty list if DB is unavailable (e.g. on Vercel)
    return NextResponse.json({ feedbacks: [], total: 0 });
  }
}

// POST /api/feedback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groupId, userId, userName, content, sentiment } = body;

    if (!groupId || !userId || !userName || !content) {
      return NextResponse.json(
        { error: 'groupId, userId, userName, content are required' },
        { status: 400 },
      );
    }

    const feedback = await db.feedback.create({
      data: {
        groupId,
        userId,
        userName,
        content,
        sentiment: sentiment || 'neutral',
        tags: JSON.stringify([]),
      },
    });

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (error) {
    console.error('[API/feedback/POST]', error);
    return NextResponse.json(
      { error: 'Failed to create feedback', details: String(error) },
      { status: 500 },
    );
  }
}
