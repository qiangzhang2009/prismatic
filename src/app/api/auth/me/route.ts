/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById, updateUserName, canUseProFeatures } from '@/lib/user-management';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ user: null });
  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({
    user: {
      ...user,
      canUseProFeatures: canUseProFeatures(user.role, user.plan),
    }
  });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { name } = body;
    if (name !== undefined) await updateUserName(session.userId, name);
    const user = await getUserById(session.userId);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
