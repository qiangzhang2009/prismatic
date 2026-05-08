/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';

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

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  const { userId } = payload;

  if (isDemoUserId(userId)) {
    return NextResponse.json({ user: { id: userId, email: payload.email || 'demo@prismatic.app', name: '演示账号', gender: null, province: null, emailVerified: true, role: 'PRO', plan: 'LIFETIME', credits: 999, dailyCredits: 20, paidCredits: 979, avatar: null, createdAt: new Date(), lastLoginAt: new Date(), canUseProFeatures: true, isAdmin: false } }, { headers: NO_CACHE_HEADERS });
  }

  if (!DATABASE_URL) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  const sql = neon(DATABASE_URL);
  try {
    const rows = await sql`SELECT id, email, name, avatar, role, plan, credits, "dailyCredits", "lastDailyResetAt", "emailVerified", "createdAt", "updatedAt", preferences FROM users WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

    const u: any = rows[0];
    const { gender, province } = parsePrefs(u.preferences);
    const role = u.role || 'FREE';
    const plan = u.plan || 'FREE';

    // 每日积分和充值积分分开返回，不合并
    const dailyCredits = u.dailyCredits || 0;
    const paidCredits = u.credits || 0;

    console.log(`[/api/auth/me] userId=${userId}, dailyCredits=${dailyCredits}, paidCredits=${paidCredits}, plan=${plan}`);
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
        credits: paidCredits,        // 只返回充值积分
        dailyCredits,               // 每日积分
        paidCredits,                // 充值积分
        avatar: u.avatar, 
        createdAt: u.createdAt, 
        lastLoginAt: u.updatedAt, 
        canUseProFeatures: canUseProFeatures(role, plan), 
        isAdmin: role === 'ADMIN' 
      } 
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('[GET /api/auth/me] error:', error);
    return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  }
}

export async function PUT(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_CACHE_HEADERS });

  const { userId } = payload;

  if (isDemoUserId(userId)) {
    return NextResponse.json({ user: { id: userId, email: payload.email || 'demo@prismatic.app', name: '演示账号', role: 'PRO', plan: 'LIFETIME', credits: 999, dailyCredits: 20, paidCredits: 979, canUseProFeatures: true, isAdmin: false } }, { headers: NO_CACHE_HEADERS });
  }

  if (!DATABASE_URL) return NextResponse.json({ error: 'Server error' }, { status: 500, headers: NO_CACHE_HEADERS });

  try {
    const body = await req.json();
    const { name, gender, province } = body;
    const sql = neon(DATABASE_URL);

    if (name !== undefined) {
      await sql`UPDATE users SET name = ${name}, "updatedAt" = NOW() WHERE id = ${userId}`;
    }
    if (gender !== undefined || province !== undefined) {
      const existing = await sql`SELECT preferences FROM users WHERE id = ${userId} LIMIT 1`;
      if (existing.length > 0) {
        const prefs = parsePrefs((existing[0] as any).preferences);
        if (gender !== undefined) prefs.gender = gender;
        if (province !== undefined) prefs.province = province;
        await sql`UPDATE users SET preferences = ${JSON.stringify(prefs)}, "updatedAt" = NOW() WHERE id = ${userId}`;
      }
    }

    const rows = await sql`SELECT id, email, name, avatar, role, plan, credits, "dailyCredits", "lastDailyResetAt", "emailVerified", "createdAt", "updatedAt", preferences FROM users WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });

    const u: any = rows[0];
    const { gender: g, province: p } = parsePrefs(u.preferences);
    const role = u.role || 'FREE';
    const plan = u.plan || 'FREE';

    // 每日积分和充值积分分开返回，不合并
    const dailyCredits = u.dailyCredits || 0;
    const paidCredits = u.credits || 0;

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
        credits: paidCredits,       // 只返回充值积分
        dailyCredits,              // 每日积分
        paidCredits,               // 充值积分
        avatar: u.avatar, 
        createdAt: u.createdAt, 
        lastLoginAt: u.updatedAt, 
      } 
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('[PUT /api/auth/me] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
