/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */

// Force dynamic rendering — this route must NEVER be cached.
// It reads from the database on every request to reflect admin changes immediately.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import {
  verifyJWTToken, updateUserName, updateUserProfile,
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
      dbId = suffix;
      email = payload.email || 'demo1@prismatic.app';
    } else {
      try {
        const decoded = Buffer.from(suffix, 'base64').toString();
        email = decoded.includes('@') ? decoded : `demo${suffix}@prismatic.app`;
      } catch {
        email = 'demo1@prismatic.app';
      }
      dbId = demoEmailToUUID(email.toLowerCase());
    }

    // Direct neon query for demo users too
    const connStr = process.env.DATABASE_URL;
    if (!connStr) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
    const demoSql = neon(connStr);
    const demoRows = await demoSql`
      SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
      FROM prismatic_users WHERE id = ${dbId} AND is_active = TRUE
    `;
    if (demoRows.length === 0) {
      await ensureDemoUserInDB(dbId, email, `演示账号 ${payload.email?.match(/demo(\d+)/)?.[1] || '1'}`);
      const retryRows = await demoSql`
        SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
        FROM prismatic_users WHERE id = ${dbId} AND is_active = TRUE
      `;
      if (retryRows.length === 0) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
      const r = retryRows[0];
      const u = { id: r.id, email: r.email, name: r.name, gender: r.gender, province: r.province, emailVerified: r.email_verified, role: r.role as any, plan: r.plan as any, credits: Number(r.credits ?? 0), avatar: r.avatar, createdAt: r.created_at, lastLoginAt: r.last_login_at };
      return NextResponse.json({ user: { ...u, canUseProFeatures: canUseProFeatures(u.role, u.plan, u.credits), isAdmin: false } }, { headers: NO_CACHE_HEADERS });
    }
    const d = demoRows[0];
    const demoUser = { id: d.id, email: d.email, name: d.name, gender: d.gender, province: d.province, emailVerified: d.email_verified, role: d.role as any, plan: d.plan as any, credits: Number(d.credits ?? 0), avatar: d.avatar, createdAt: d.created_at, lastLoginAt: d.last_login_at };
    return NextResponse.json({ user: { ...demoUser, canUseProFeatures: canUseProFeatures(demoUser.role, demoUser.plan, demoUser.credits), isAdmin: false } }, { headers: NO_CACHE_HEADERS });
  }

  // ── Regular user: query DB by userId ────────────────────────────────────────
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  const sql = neon(connectionString);
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users WHERE id = ${userId} AND is_active = TRUE
  `;
  if (rows.length === 0) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });
  const row = rows[0];
  const user = {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role,
    plan: row.plan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
  console.log(`[GET /api/auth/me] userId=${userId} → found=true role=${user.role} plan=${user.plan} credits=${user.credits}`);
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
    // Direct neon read-back instead of getUserById
    const connStr2 = process.env.DATABASE_URL;
    if (!connStr2) return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
    const putSql = neon(connStr2);
    const putRows = await putSql`
      SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
      FROM prismatic_users WHERE id = ${dbId} AND is_active = TRUE
    `;
    if (putRows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    const pu = putRows[0];
    const putUser = { id: pu.id, email: pu.email, name: pu.name, gender: pu.gender, province: pu.province, emailVerified: pu.email_verified, role: pu.role as any, plan: pu.plan as any, credits: Number(pu.credits ?? 0), avatar: pu.avatar, createdAt: pu.created_at, lastLoginAt: pu.last_login_at };
    return NextResponse.json({ user: putUser }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
