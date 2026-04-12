/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById, updateUserName, canUseProFeatures, UserRole, SubscriptionPlan } from '@/lib/user-management';

function isDemoUserId(userId: string) {
  return userId.startsWith('demo_');
}

function createDemoUserFromId(userId: string) {
  const base64 = userId.replace('demo_', '');
  // Try to decode, fallback to '1'
  let email = 'demo1@prismatic.app';
  try {
    const decoded = Buffer.from(base64, 'base64').toString();
    if (decoded.includes('@')) email = decoded;
  } catch {}
  const num = email.match(/demo(\d+)/)?.[1] || '1';
  const demoUser = {
    id: userId,
    email,
    name: `演示账号 ${num}`,
    nameZh: `演示账号 ${num}`,
    gender: null,
    province: null,
    emailVerified: true,
    role: 'PRO' as UserRole,
    plan: 'LIFETIME' as SubscriptionPlan,
    avatar: null,
    canUseProFeatures: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
  return demoUser;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ user: null });

  // Handle demo users (not in database)
  if (isDemoUserId(session.userId)) {
    const demoUser = createDemoUserFromId(session.userId);
    return NextResponse.json({
      user: {
        ...demoUser,
        canUseProFeatures: canUseProFeatures(demoUser.role, demoUser.plan),
      }
    });
  }

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
    const { name, gender, province } = body;
    await updateUserName(session.userId, name);
    if (gender !== undefined || province !== undefined) {
      await import('@/lib/user-management').then(m => m.updateUserProfile(session.userId, { name, gender, province }));
    }
    const user = await getUserById(session.userId);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
