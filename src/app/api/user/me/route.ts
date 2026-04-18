export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
const DATABASE_URL = process.env.DATABASE_URL;

function verifyToken(token: string): { userId: string; email?: string } | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as { userId: string; email?: string; iat?: number; exp?: number };
    return payload.userId ? { userId: payload.userId, email: payload.email } : null;
  } catch (e) {
    console.error('[verifyToken] error:', e);
    return null;
  }
}

function isDemoUserId(userId: string): boolean {
  return userId.startsWith('demo_');
}

export async function GET(_req: NextRequest) {
  try {
    const token = _req.cookies.get('prismatic_token')?.value;
    if (!token) return NextResponse.json({ user: null });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ user: null });

    if (isDemoUserId(payload.userId)) {
      return NextResponse.json({
        user: {
          id: payload.userId,
          email: payload.email || 'demo@prismatic.app',
          name: '演示账号',
          canUseProFeatures: true,
          isAdmin: false,
        }
      });
    }

    if (!DATABASE_URL) return NextResponse.json({ user: null });

    try {
      const sql = neon(DATABASE_URL);
      const rows = await sql`SELECT id, email, name, role, plan, credits FROM users WHERE id = ${payload.userId} LIMIT 1`;

      if (rows.length === 0) return NextResponse.json({ user: null });

      const u: any = rows[0];
      const role = u.role || 'FREE';
      const plan = u.plan || 'FREE';

      return NextResponse.json({
        user: {
          id: u.id,
          email: u.email || '',
          name: u.name,
          role,
          plan,
          credits: u.credits || 0,
          canUseProFeatures: role === 'ADMIN' || plan !== 'FREE' || (u.credits || 0) > 0,
          isAdmin: role === 'ADMIN',
        }
      });
    } catch (dbError) {
      console.error('[GET /api/user/me] DB error:', dbError);
      return NextResponse.json({ error: 'Database error: ' + String(dbError) }, { status: 500 });
    }
  } catch (error) {
    console.error('[GET /api/user/me] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const token = req.cookies.get('prismatic_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (isDemoUserId(payload.userId)) {
      return NextResponse.json({ error: 'Demo accounts cannot update profile' }, { status: 403 });
    }

    if (!DATABASE_URL) return NextResponse.json({ error: 'Server error' }, { status: 500 });

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
          const raw = (existing[0] as any).preferences;
          let prefs = { gender: null, province: null };
          try { prefs = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch {}
          if (gender !== undefined) prefs.gender = gender;
          if (province !== undefined) prefs.province = province;
          await sql`UPDATE users SET preferences = ${JSON.stringify(prefs)}, "updatedAt" = NOW() WHERE id = ${payload.userId}`;
        }
      }

      const rows = await sql`SELECT id, email, name, role, plan, credits FROM users WHERE id = ${payload.userId} LIMIT 1`;
      if (rows.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      const u: any = rows[0];
      const role = u.role || 'FREE';
      const plan = u.plan || 'FREE';

      return NextResponse.json({
        user: {
          id: u.id,
          email: u.email || '',
          name: u.name,
          role,
          plan,
          credits: u.credits || 0,
        }
      });
    } catch (dbError) {
      console.error('[PUT /api/user/me] DB error:', dbError);
      return NextResponse.json({ error: 'Database error: ' + String(dbError) }, { status: 500 });
    }
  } catch (error) {
    console.error('[PUT /api/user/me] unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error: ' + String(error) }, { status: 500 });
  }
}
