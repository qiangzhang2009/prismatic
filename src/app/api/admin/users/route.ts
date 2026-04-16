/**
 * GET /api/admin/users — List all users (admin only)
 * PUT /api/admin/users — Update user role/plan/credits
 * DELETE /api/admin/users — Deactivate user
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest, getAllUsers, getUserById, updateUserRole, updateUserPlan, updateUserCredits, updateUserName, updateUserProfile, updateUserEmail, deleteUser, canUseProFeatures } from '@/lib/user-management';

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
    if (credits !== undefined) {
      if (typeof credits !== 'number' || credits < 0) {
        return NextResponse.json({ error: 'credits must be a non-negative number' }, { status: 400 });
      }
      await updateUserCredits(userId, credits);
    }
    if (role) await updateUserRole(userId, role);
    if (plan) await updateUserPlan(userId, plan);
    if (name !== undefined) await updateUserName(userId, name);
    if (gender !== undefined || province !== undefined) {
      await updateUserProfile(userId, { gender, province });
    }
    if (email !== undefined) {
      try {
        await updateUserEmail(userId, email);
      } catch (e: any) {
        if (e.message === '邮箱已被其他账号使用') {
          return NextResponse.json({ error: e.message }, { status: 409 });
        }
        throw e;
      }
    }
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found after update' }, { status: 500 });
    }
    return NextResponse.json({
      user: {
        ...user,
        canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
        isAdmin: user.role === 'ADMIN',
      },
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
