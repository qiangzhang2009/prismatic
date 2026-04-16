/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyJWTToken, getUserById, updateUserName,
  canUseProFeatures, isDemoUserId, ensureDemoUserInDB,
  demoEmailToUUID,
} from '@/lib/user-management';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

function parseDemoNumber(email: string): string {
  return email.match(/demo(\d+)/)?.[1] || '1';
}

/**
 * Demo users: JWT payload.email → UUID for DB lookup (same as login).
 * parseDemoNumber extracts the demo account number from email.
 */


export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  let payload: JWTPayload;
  try {
    payload = verifyJWTToken(token) as JWTPayload;
    if (!payload?.userId) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  }

  const userId: string = payload.userId;

  // ── Demo user: JWT has demo_{UUID} — strip prefix, use UUID for DB lookup ──
  if (isDemoUserId(userId)) {
    const uuid = userId.replace('demo_', '');
    const email = payload.email || 'demo1@prismatic.app';
    const num = parseDemoNumber(email);
    const name = `演示账号 ${num}`;

    // Ensure the demo user exists in DB before querying (await, not fire-and-forget)
    await ensureDemoUserInDB(uuid, email, name);

    const user = await getUserById(uuid);
    if (!user) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
    return NextResponse.json({
      user: {
        ...user,
        canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
        isAdmin: false,
      }
    }, { headers: NO_CACHE_HEADERS });
  }

  // ── Regular user: always query DB ────────────────────────────────────────────
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  return NextResponse.json({
    user: {
      ...user,
      canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
      isAdmin: user.role === 'ADMIN',
    }
  }, { headers: NO_CACHE_HEADERS });
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });

  let payload: JWTPayload;
  try {
    payload = verifyJWTToken(token) as JWTPayload;
    if (!payload?.userId) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const userId: string = payload.userId;

  try {
    const body = await req.json();
    const { name, gender, province } = body;

    // For demo users, JWT userId is "demo_{UUID}" — strip prefix to get DB UUID
    const dbId = isDemoUserId(userId) ? userId.replace('demo_', '') : userId;

    await updateUserName(dbId, name);
    if (gender !== undefined || province !== undefined) {
      const { updateUserProfile } = await import('@/lib/user-management');
      await updateUserProfile(dbId, { name, gender, province });
    }
    const user = await getUserById(dbId);
    return NextResponse.json({ user }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
