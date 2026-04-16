/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  verifyJWTToken, getUserById, updateUserName,
  canUseProFeatures, isDemoUserId, ensureDemoUserInDB,
} from '@/lib/user-management';

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

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  const payload = verifyJWTToken(token);
  if (!payload) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  // ── Demo user: ensure DB entry exists, then always read from DB ──────────────
  // Previously this shortcut returned hardcoded data and ignored admin DB updates.
  // Fix: seed demo user into DB on first access, then read from DB every time.
  if (isDemoUserId(payload.userId)) {
    const email = parseDemoEmail(payload.userId);
    const num = parseDemoNumber(email);
    const name = `演示账号 ${num}`;

    // Async seed — don't block the response
    ensureDemoUserInDB(payload.userId, email, name);

    const user = await getUserById(payload.userId);
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
  const user = await getUserById(payload.userId);
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
