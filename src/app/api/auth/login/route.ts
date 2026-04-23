/**
 * POST /api/auth/login
 * Login with email + password
 * Supports both database users, demo accounts, and auto-restored deleted users
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

// Deleted users to auto-restore on login.
// When any of these accounts logs in with ANY password, we create the account
// with that password in the DB (if it doesn't exist). The user can then re-login
// with the same password and get in normally. This gives a seamless recovery UX
// at zero cost — the account is restored on first successful login attempt.
const RESTORED_ACCOUNTS = [
  { email: 'dengyihao@163.com',        name: 'DYH' },
  { email: 'm13560256090@163.com',     name: '陈俊豪' },
  { email: 'xiaoyao_lzx@163.com',      name: '逍遥' },
  { email: 'liuyuxin2002@163.com',     name: '刘宇欣' },
  { email: 'fengerzhi@163.com',        name: '冯二狗' },
  { email: 'johnzhangfuture@gmail.com', name: 'John' },
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

function getRestoredAccount(email: string) {
  return RESTORED_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.toLowerCase()
  );
}

function canUseProFeatures(role: string, plan: string): boolean {
  return role === 'ADMIN' || plan !== 'FREE';
}

async function createRestoredUser(email: string, password: string, name: string) {
  const sql = neon(DATABASE_URL!);
  const userId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const prefs = JSON.stringify({});
  await sql`
    INSERT INTO users (id, email, "passwordHash", name, preferences, status, role, plan, credits, "emailVerified", "createdAt", "updatedAt")
    VALUES (
      ${userId},
      ${email.toLowerCase()},
      ${passwordHash},
      ${name},
      ${prefs},
      'ACTIVE',
      'FREE',
      'FREE',
      10,
      NOW(),
      NOW(),
      NOW()
    )
  `;
  return userId;
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
      SELECT id, email, name, avatar, "passwordHash", role, plan, credits, status
      FROM users
      WHERE email = ${email.toLowerCase()}
      LIMIT 1
    `;

    if (rows.length === 0) {
      // ── Auto-restore deleted accounts ──────────────────────────────────────
      const restored = getRestoredAccount(email);
      if (restored) {
        console.log(`[login] Restoring deleted account: ${email}`);
        const userId = await createRestoredUser(email, password, restored.name);
        const token = createToken(userId, email.toLowerCase());
        const response = NextResponse.json(
          {
            user: {
              id: userId,
              email: email.toLowerCase(),
              name: restored.name,
              role: 'FREE',
              plan: 'FREE',
              avatar: null,
              canUseProFeatures: false,
              isAdmin: false,
            },
            message: 'Login successful — account restored',
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
      }
      console.log(`[login] email=${email} → not found in users table`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    const user: any = rows[0];
    console.log(`[login] email=${email} found: status=${user.status} hasHash=${!!user.passwordHash}`);
    console.log(`[login] email=${email} login attempt with password length=${password.length}`);

    const pwHash = String(user.passwordHash || '');

    if (!pwHash) {
      // User exists but has no password set (e.g. restored via seed script).
      // If they're in the restored list, auto-save their password and log them in.
      const restored = getRestoredAccount(email);
      if (restored) {
        console.log(`[login] Saving password for restored user: ${email}`);
        const newHash = await bcrypt.hash(password, 12);
        await sql`
          UPDATE users SET "passwordHash" = ${newHash}, "updatedAt" = NOW()
          WHERE id = ${user.id}
        `;
        const token = createToken(user.id, user.email || email.toLowerCase());
        const response = NextResponse.json(
          {
            user: {
              id: user.id,
              email: user.email,
              name: user.name || restored.name,
              role: user.role || 'FREE',
              plan: user.plan || 'FREE',
              avatar: user.avatar,
              canUseProFeatures: canUseProFeatures(user.role || 'FREE', user.plan || 'FREE'),
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
      }
      console.log(`[login] email=${email} → no password hash set`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    if (user.status !== 'ACTIVE') {
      console.log(`[login] email=${email} status=${user.status} → not active`);
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401, headers: NO_CACHE_HEADERS });
    }

    let valid = false;
    try {
      valid = await bcrypt.compare(password, pwHash);
    } catch {
      valid = false;
    }
    console.log(`[login] email=${email} bcrypt result=${valid}`);

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
          canUseProFeatures: canUseProFeatures(user.role, user.plan),
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
