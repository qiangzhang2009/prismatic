/**
 * POST /api/auth/login
 * Login with email + password
 * Supports both database users and demo accounts
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';

const DEMO_ACCOUNTS = [
  { email: 'demo1@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo2@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo3@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo4@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo5@prismatic.app', password: 'Prismatic2024!' },
];

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

function createToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, AUTH_SECRET, { expiresIn: '30d' });
}

function demoEmailToUUID(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function isDemoAccount(email: string, password: string) {
  return DEMO_ACCOUNTS.some(
    (d) => d.email.toLowerCase() === email.toLowerCase() && d.password === password
  );
}

function canUseProFeatures(role: string, plan: string, credits: number = 0): boolean {
  return role === 'ADMIN' || plan !== 'FREE' || credits > 0;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const email = (json.email as string) || '';
    const password = (json.password as string) || '';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    if (!DATABASE_URL) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500, headers: NO_CACHE_HEADERS });
    }

    // ── Demo account login ─────────────────────────────────────────────────────
    if (isDemoAccount(email, password)) {
      const num = email.match(/demo(\d+)/)?.[1] || '1';
      const uuid = demoEmailToUUID(email.toLowerCase());
      const demoUser = {
        id: `demo_${uuid}`,
        email: email.toLowerCase(),
        name: `演示账号 ${num}`,
        role: 'PRO' as const,
        plan: 'LIFETIME' as const,
        avatar: null,
        canUseProFeatures: true,
      };
      const token = createToken(demoUser.id, demoUser.email);
      const response = NextResponse.json({ user: demoUser, message: 'Login successful' }, { status: 200, headers: NO_CACHE_HEADERS });
      response.cookies.set('prismatic_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
      return response;
    }

    // ── Regular user login ─────────────────────────────────────────────────────
    const sql = neon(DATABASE_URL);
    const rows = await sql`
      SELECT id, email, name, avatar, "passwordHash", role, plan, credits
      FROM users
      WHERE email = ${email.toLowerCase()}
        AND status::text = 'ACTIVE'
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const user: any = rows[0];
    const pwHash = String(user.passwordHash || '');

    // No password set — treat as invalid
    if (!pwHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    let valid = false;
    try {
      valid = await bcrypt.compare(password, pwHash);
    } catch {
      valid = false;
    }

    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const token = createToken(user.id, user.email);
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          avatar: user.avatar,
          canUseProFeatures: canUseProFeatures(user.role, user.plan, user.credits),
          isAdmin: user.role === 'ADMIN',
        },
        message: 'Login successful',
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
    response.cookies.set('prismatic_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('[POST /api/auth/login] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
