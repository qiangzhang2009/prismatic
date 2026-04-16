/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyJWTToken, getUserById, updateUserName,
  canUseProFeatures, isDemoUserId, ensureDemoUserInDB,
} from '@/lib/user-management';
import { createHash } from 'crypto';

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
 * Demo users have `demo_{base64}` in the JWT, but the DB id must be a valid UUID.
 * Derive a stable UUID v5 from the email — same email always → same UUID.
 */
function demoEmailToUUID(email: string): string {
  const hash = createHash('sha1').update(email.toLowerCase()).digest('hex').slice(0, 32);
  return (
    hash.slice(0, 8) + '-' +
    hash.slice(8, 12) + '-' +
    '5' + hash.slice(13, 16) + '-' +
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20) + '-' +
    hash.slice(20, 32)
  );
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

  // ── Demo user: JWT payload has { userId, email } — use email for UUID derivation ─
  if (isDemoUserId(userId)) {
    // Email comes from the JWT payload, NOT derived from userId
    const email = payload.email || 'demo1@prismatic.app';
    const num = parseDemoNumber(email);
    const name = `演示账号 ${num}`;
    const dbId = demoEmailToUUID(email);

    // Fire-and-forget seed — errors are swallowed
    ensureDemoUserInDB(dbId, email, name).catch(() => {});

    const user = await getUserById(dbId);
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

    // For demo users, derive DB UUID from JWT email (not from userId)
    const dbId = isDemoUserId(userId)
      ? demoEmailToUUID(payload.email || 'demo1@prismatic.app')
      : userId;

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
