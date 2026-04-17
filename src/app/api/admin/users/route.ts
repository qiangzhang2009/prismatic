/**
 * GET /api/admin/users — List all users (admin only)
 * PUT /api/admin/users — Update user role/plan/credits
 * DELETE /api/admin/users — Deactivate user
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest, getAllUsers, getUserById, updateUserAdmin, deleteUser, canUseProFeatures } from '@/lib/user-management';

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const users = await getAllUsers();
  return NextResponse.json({ users });
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
