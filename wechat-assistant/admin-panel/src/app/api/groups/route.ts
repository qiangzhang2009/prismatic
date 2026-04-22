// ============================================
// Groups API — 群组 CRUD
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/groups — 获取所有群组
export async function GET() {
  try {
    const groups = await db.group.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ groups, period: 'all' });
  } catch (error) {
    console.error('[API/groups/GET]', error);
    return NextResponse.json({ groups: [], period: 'all' });
  }
}

// POST /api/groups — 创建新群组
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, wechatId, platform, personaId, policy, keywords } = body;

    if (!name || !wechatId) {
      return NextResponse.json(
        { error: 'name and wechatId are required' },
        { status: 400 },
      );
    }

    const group = await db.group.create({
      data: {
        name,
        wechatId,
        platform: platform ?? 'weixin',
        personaId: personaId ?? 'smart-assistant',
        policy: policy ?? 'allowlist',
        keywords: keywords ?? JSON.stringify({ ad: true, spam: true }),
      },
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('[API/groups/POST]', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}
