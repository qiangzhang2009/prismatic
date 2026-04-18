/**
 * GET /api/admin/users/[id] — Get single user detail (admin only)
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateAdminRequest } from '@/lib/user-management';

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get conversation count and message count
    const [conversationCount, messageCount] = await Promise.all([
      prisma.conversation.count({ where: { userId: id } }),
      prisma.message.count({ where: { userId: id } }),
    ]);

    const gender = (() => {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences;
        return p?.gender || null;
      } catch { return null; }
    })() as 'male' | 'female' | null;

    const province = (() => {
      try {
        const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences;
        return p?.province || null;
      } catch { return null; }
    })() as string | null;

    return NextResponse.json({
      id: user.id,
      email: user.email || '',
      name: user.name,
      gender,
      province,
      emailVerified: !!user.emailVerified,
      status: user.status,
      role: user.role || 'FREE',
      plan: user.plan || 'FREE',
      credits: user.credits || 0,
      avatar: user.avatar,
      conversationCount,
      messageCount,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[Admin GET /users/[id]] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
