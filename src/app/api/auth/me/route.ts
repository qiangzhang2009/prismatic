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

function parseDemoEmail(userId: string): string {
  const base64 = userId.replace('demo_', '');
  try {
    const decoded = Buffer.from(base64, 'base64').toString();
    return decoded.includes('@') ? decoded : 'demo1@prismatic.app';
  } catch {
    return 'demo1@prismatic.app';
  }
}

function parseDemoNumber(email: string): string {
  return email.match(/demo(\d+)/)?.[1] || '1';
}

/**
 * Demo users have `demo_{base64}` in the JWT, but the DB id must be a valid UUID.
 * Derive a stable UUID v5 from the email — same email always → same UUID.
 */
function demoEmailToUUID(email: string): string {
  // Derive a stable, valid UUID v5 from email — same email → same UUID
  const hash = createHash('sha1').update(email.toLowerCase()).digest('hex');
  // UUID = 8+4+4+4+12 = 32 hex chars (hash has 40, we use first 32)
  // version 5 variant: replace char[12] with '5', char[16] with N variant
  const hex = hash.slice(0, 32);
  return (
    hex.slice(0, 8) + '-' +
    hex.slice(8, 12) + '-' +
    '5' + hex.slice(13, 16) + '-' +
    ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20) + '-' +
    hex.slice(20, 32)
  );
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  let payload: { userId: string; email?: string };
  try {
    payload = verifyJWTToken(token) as { userId: string; email?: string };
    if (!payload?.userId) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  }

  const userId = payload.userId;

  // ── Demo user: map demo_{base64} JWT id → valid UUID for DB, then seed ───────
  if (isDemoUserId(userId)) {
    const email = parseDemoEmail(userId);
    const num = parseDemoNumber(email);
    const name = `演示账号 ${num}`;
    // Derive the UUID that this demo user's DB record uses
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

  let payload: { userId: string };
  try {
    payload = verifyJWTToken(token) as { userId: string };
    if (!payload?.userId) throw new Error('Invalid payload');
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });
  }

  const userId = payload.userId;

  try {
    const body = await req.json();
    const { name, gender, province } = body;

    // For demo users, map JWT id → DB UUID
    const dbId = isDemoUserId(userId) ? demoEmailToUUID(parseDemoEmail(userId)) : userId;

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
