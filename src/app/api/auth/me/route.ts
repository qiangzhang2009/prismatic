/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyJWTToken, getUserById, updateUserName, updateUserProfile,
  canUseProFeatures, isDemoUserId, demoEmailToUUID, ensureDemoUserInDB,
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

  // ── Demo user: JWT has "demo_{...}" ──────────────────────────────────────────
  if (isDemoUserId(userId)) {
    const suffix = userId.replace('demo_', '');
    let dbId: string;
    let email: string;

    if (suffix.includes('-')) {
      // New format: demo_{UUID} → strip prefix to get DB UUID
      dbId = suffix;
      email = payload.email || 'demo1@prismatic.app';
    } else {
      // Old format: demo_{base64} → decode → derive UUID
      try {
        const decoded = Buffer.from(suffix, 'base64').toString();
        email = decoded.includes('@') ? decoded : `demo${suffix}@prismatic.app`;
      } catch {
        email = 'demo1@prismatic.app';
      }
      dbId = demoEmailToUUID(email.toLowerCase());
    }

    const user = await getUserById(dbId);
    if (!user) {
      // User not found — ensure they exist in DB (handles soft-deleted users)
      await ensureDemoUserInDB(dbId, email, `演示账号 ${payload.email?.match(/demo(\d+)/)?.[1] || '1'}`);
      const retryUser = await getUserById(dbId);
      if (!retryUser) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
      return NextResponse.json({
        user: {
          ...retryUser,
          canUseProFeatures: canUseProFeatures(retryUser.role, retryUser.plan, retryUser.credits),
          isAdmin: false,
        }
      }, { headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json({
      user: {
        ...user,
        canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
        isAdmin: false,
      }
    }, { headers: NO_CACHE_HEADERS });
  }

  // ── Regular user: query DB by userId ────────────────────────────────────────
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

    // Demo user: strip demo_ prefix to get DB UUID
    let dbId: string = userId;
    if (isDemoUserId(userId)) {
      const suffix = userId.replace('demo_', '');
      if (suffix.includes('-')) {
        dbId = suffix;
      } else {
        try {
          const decoded = Buffer.from(suffix, 'base64').toString();
          dbId = demoEmailToUUID(decoded.includes('@') ? decoded : `demo${suffix}@prismatic.app`);
        } catch {
          dbId = userId;
        }
      }
    }

    if (name !== undefined) await updateUserName(dbId, name);
    if (gender !== undefined || province !== undefined) {
      await updateUserProfile(dbId, { gender, province });
    }
    const user = await getUserById(dbId);
    return NextResponse.json({ user }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
