/**
 * GET /api/admin/users — List all users (admin only)
 * PUT /api/admin/users — Update user role/plan
 * DELETE /api/admin/users — Deactivate user
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAllUsers, getUserById, updateUserRole, updateUserPlan, updateUserName, updateUserProfile, updateUserEmail, deleteUser, isAdmin } from '@/lib/user-management';

async function checkAdmin(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const session = await getSession(token);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || !isAdmin(user.role)) return null;
  return session.userId;
}

export async function GET(req: NextRequest) {
  const adminId = await checkAdmin(req.cookies.get('prismatic_token')?.value);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const users = await getAllUsers();
  return NextResponse.json({ users });
}

export async function PUT(req: NextRequest) {
  const adminId = await checkAdmin(req.cookies.get('prismatic_token')?.value);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  try {
    const body = await req.json();
    const { userId, role, plan, name, gender, province, email } = body;
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (role) await updateUserRole(userId, role);
    if (plan) await updateUserPlan(userId, plan);
    if (name !== undefined) await updateUserName(userId, name);
    if (gender !== undefined || province !== undefined) {
      await updateUserProfile(userId, { gender, province });
    }
    if (email !== undefined) await updateUserEmail(userId, email);
    const user = await getUserById(userId);
    return NextResponse.json({ user, message: 'User updated successfully' });
  } catch (error) {
    console.error('Admin update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const adminId = await checkAdmin(req.cookies.get('prismatic_token')?.value);
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
