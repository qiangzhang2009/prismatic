/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWTToken, getUserById, updateUserName, canUseProFeatures, isDemoUserId, createDemoUserFromId } from '@/lib/user-management';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  const payload = verifyJWTToken(token);
  if (!payload) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  if (isDemoUserId(payload.userId)) {
    const demoUser = createDemoUserFromId(payload.userId);
    return NextResponse.json({
      user: {
        ...demoUser,
        canUseProFeatures: canUseProFeatures(demoUser.role, demoUser.plan),
      }
    }, { headers: NO_CACHE_HEADERS });
  }

  const user = await getUserById(payload.userId);
  if (!user) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  return NextResponse.json({
    user: {
      ...user,
      canUseProFeatures: canUseProFeatures(user.role, user.plan),
    }
  }, { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  const payload = verifyJWTToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  try {
    const body = await req.json();
    const { name, gender, province } = body;
    await updateUserName(payload.userId, name);
    if (gender !== undefined || province !== undefined) {
      await import('@/lib/user-management').then(m => m.updateUserProfile(payload.userId, { name, gender, province }));
    }
    const user = await getUserById(payload.userId);
    return NextResponse.json({ user }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
