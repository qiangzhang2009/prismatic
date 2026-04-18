/**
 * GET /api/admin/users — List all users (admin only)
 * PUT /api/admin/users — Update user role/plan/credits
 * DELETE /api/admin/users — Deactivate user
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateAdminRequest, updateUserAdmin, deleteUser, canUseProFeatures } from '@/lib/user-management';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy: any = {};
  if (sortBy === 'createdAt') orderBy.createdAt = sortOrder;
  else if (sortBy === 'lastActive') orderBy.updatedAt = sortOrder;
  else orderBy.createdAt = 'desc';

  const [users, total, lastMsgRows] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        _count: {
          select: {
            conversations: true,
            messages: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
    prisma.$queryRaw<Array<{ user_id: string; last_created_at: Date | null }>>`
      SELECT user_id, MAX(created_at) as last_created_at
      FROM messages
      WHERE content != '[message-counted]'
      GROUP BY user_id
    `,
  ]);

  const lastMsgMap = new Map<string, string | null>();
  for (const r of lastMsgRows) {
    lastMsgMap.set(r.user_id, r.last_created_at?.toISOString() ?? null);
  }

  const items = users.map(user => {
    const gender = (() => { try { const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences; return p?.gender || null; } catch { return null; } })() as 'male' | 'female' | null;
    const province = (() => { try { const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences; return p?.province || null; } catch { return null; } })() as string | null;
    return {
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
      conversationCount: (user as any)._count?.conversations || 0,
      messageCount: (user as any)._count?.messages || 0,
      lastActiveAt: lastMsgMap.get(user.id) || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function PUT(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { userId, role, plan, credits, name, gender, province, email } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Collect all non-undefined updates
    const updates: Parameters<typeof updateUserAdmin>[1] = {};
    if (role !== undefined) updates.role = role;
    if (plan !== undefined) updates.plan = plan;
    if (credits !== undefined) {
      if (typeof credits !== 'number' || credits < 0) {
        return NextResponse.json({ error: 'credits must be a non-negative number' }, { status: 400 });
      }
      updates.credits = credits;
    }
    if (name !== undefined) updates.name = name || null;
    if (gender !== undefined) updates.gender = gender || null;
    if (province !== undefined) updates.province = province || null;
    if (email !== undefined) updates.email = email;

    console.log(`[admin PUT /users] admin=${adminId} updating userId=${userId}`, JSON.stringify(updates));

    // Single UPDATE with RETURNING — avoids read-after-write inconsistency
    const user = await updateUserAdmin(userId, updates);

    if (!user) {
      return NextResponse.json({ error: 'User not found or no changes applied' }, { status: 404 });
    }

    console.log(`[admin PUT /users] after update → role=${user.role} plan=${user.plan} credits=${user.credits} name=${user.name}`);
    return NextResponse.json({
      user: {
        ...user,
        canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
        isAdmin: user.role === 'ADMIN',
      },
    });
  } catch (error: any) {
    console.error('Admin update error:', error);
    const message = error?.message || String(error);
    if (message === '邮箱已被其他账号使用') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — same as PUT, supports both for flexibility
export async function PATCH(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { id, data } = body;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Parameters<typeof updateUserAdmin>[1] = {};
    if (data?.role !== undefined) updates.role = data.role;
    if (data?.plan !== undefined) updates.plan = data.plan;
    if (data?.credits !== undefined) updates.credits = data.credits;
    if (data?.name !== undefined) updates.name = data.name || null;
    if (data?.gender !== undefined) updates.gender = data.gender || null;
    if (data?.province !== undefined) updates.province = data.province || null;
    if (data?.email !== undefined) updates.email = data.email;
    if (data?.status !== undefined) updates.status = data.status;

    const user = await updateUserAdmin(id, updates);
    if (!user) {
      return NextResponse.json({ error: 'User not found or no changes applied' }, { status: 404 });
    }

    return NextResponse.json({
      ...user,
      canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
      isAdmin: user.role === 'ADMIN',
    });
  } catch (error: any) {
    console.error('Admin PATCH error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { userId } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (userId === adminId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }
    await deleteUser(userId);
    return NextResponse.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Admin delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
