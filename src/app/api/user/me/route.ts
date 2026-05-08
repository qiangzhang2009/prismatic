export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
const DATABASE_URL = process.env.DATABASE_URL;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

function verifyToken(token: string): { userId: string; email?: string } | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as { userId: string; email?: string; iat?: number; exp?: number };
    return payload.userId ? { userId: payload.userId, email: payload.email } : null;
  } catch {
    return null;
  }
}

function isDemoUserId(userId: string): boolean {
  return userId.startsWith('demo_');
}

function canUseProFeatures(role: string, plan: string): boolean {
  return role === 'ADMIN' || plan !== 'FREE';
}

function parsePrefs(prefs: any) {
  try {
    const p = typeof prefs === 'string' ? JSON.parse(prefs) : (prefs || {});
    return { gender: p?.gender || null, province: p?.province || null };
  } catch { return { gender: null, province: null }; }
}

export async function GET(_req: NextRequest) {
  try {
    const token = _req.cookies.get('prismatic_token')?.value;
    if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

    if (isDemoUserId(payload.userId)) {
      return NextResponse.json({
        user: {
          id: payload.userId,
          email: payload.email || 'demo@prismatic.app',
          name: '演示账号',
          gender: null,
          province: null,
          emailVerified: true,
          role: 'PRO',
          plan: 'LIFETIME',
          credits: 0,
          avatar: null,
          canUseProFeatures: true,
          isAdmin: false,
          apiKeyStatus: null,
          apiKeyProvider: null,
        }
      }, { headers: NO_CACHE_HEADERS });
    }

    if (!DATABASE_URL) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

    try {
      const sql = neon(DATABASE_URL);
      const rows = await sql`SELECT id, email, name, avatar, role, plan, credits, "dailyCredits", "emailVerified", "createdAt", "updatedAt", preferences, "apiKeyStatus", "apiKeyProvider" FROM users WHERE id = ${payload.userId} LIMIT 1`;

      if (rows.length === 0) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

      const u: any = rows[0];
      const { gender, province } = parsePrefs(u.preferences);
      const role = u.role || 'FREE';
      const plan = u.plan || 'FREE';
      const paidCredits = u.credits || 0;
      const dailyCredits = u.dailyCredits || 0;

      return NextResponse.json({
        user: {
          id: u.id,
          email: u.email || '',
          name: u.name,
          gender,
          province,
          emailVerified: !!u.emailVerified,
          role,
          plan,
          credits: paidCredits,
          dailyCredits,
          paidCredits,
          avatar: u.avatar,
          canUseProFeatures: canUseProFeatures(role, plan),
          isAdmin: role === 'ADMIN',
          apiKeyStatus: u.apiKeyStatus || null,
          apiKeyProvider: u.apiKeyProvider || null,
        }
      }, { headers: NO_CACHE_HEADERS });
    } catch (dbError) {
      console.error('[GET /api/user/me] DB error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: NO_CACHE_HEADERS });
    }
  } catch (error) {
    console.error('[GET /api/user/me] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('prismatic_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });

    if (isDemoUserId(payload.userId)) {
      return NextResponse.json({ error: 'Demo accounts cannot update profile' }, { status: 403, headers: NO_CACHE_HEADERS });
    }

    if (!DATABASE_URL) return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS });

    const body = await req.json();
    const { name, gender, province } = body;

    try {
      const sql = neon(DATABASE_URL);

      if (name !== undefined) {
        await sql`UPDATE users SET name = ${name}, "updatedAt" = NOW() WHERE id = ${payload.userId}`;
      }
      if (gender !== undefined || province !== undefined) {
        const existing = await sql`SELECT preferences FROM users WHERE id = ${payload.userId} LIMIT 1`;
        if (existing.length > 0) {
          const prefs = parsePrefs((existing[0] as any).preferences);
          if (gender !== undefined) prefs.gender = gender;
          if (province !== undefined) prefs.province = province;
          await sql`UPDATE users SET preferences = ${JSON.stringify(prefs)}, "updatedAt" = NOW() WHERE id = ${payload.userId}`;
        }
      }

      const rows = await sql`SELECT id, email, name, avatar, role, plan, credits, "dailyCredits", "emailVerified", "createdAt", "updatedAt", preferences, "apiKeyStatus", "apiKeyProvider" FROM users WHERE id = ${payload.userId} LIMIT 1`;
      if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });

      const u: any = rows[0];
      const { gender: g, province: p } = parsePrefs(u.preferences);
      const role = u.role || 'FREE';
      const plan = u.plan || 'FREE';
      const paidCredits = u.credits || 0;
      const dailyCredits = u.dailyCredits || 0;

      return NextResponse.json({
        user: {
          id: u.id,
          email: u.email || '',
          name: u.name,
          gender: g,
          province: p,
          emailVerified: !!u.emailVerified,
          role,
          plan,
          credits: paidCredits,
          dailyCredits,
          paidCredits,
          avatar: u.avatar,
          canUseProFeatures: canUseProFeatures(role, plan),
          isAdmin: role === 'ADMIN',
          apiKeyStatus: u.apiKeyStatus || null,
          apiKeyProvider: u.apiKeyProvider || null,
        }
      }, { headers: NO_CACHE_HEADERS });
    } catch (dbError) {
      console.error('[PUT /api/user/me] DB error:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500, headers: NO_CACHE_HEADERS });
    }
  } catch (error) {
    console.error('[PUT /api/user/me] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
