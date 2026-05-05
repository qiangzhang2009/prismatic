/**
 * Prismatic — Middleware
 * Protects /app and /admin routes — validates JWT and checks DB role.
 * Uses jose for Edge runtime compatibility.
 *
 * Security model:
 * - /app routes: require any valid JWT
 * - /admin routes: require JWT + ADMIN role (from DB, or bypassed for demo users)
 *
 * Demo user bypass: when ALLOW_ADMIN_BYPASS='true', users with userId starting
 * with 'demo_' or email starting with 'demo' are granted ADMIN access without a
 * DB record lookup. This is for development/demo environments only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_SECRET = (() => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') {
      throw new Error('FATAL: AUTH_SECRET environment variable is not set. ' +
        'Requests will be rejected in production.');
    }
    console.warn('[middleware] AUTH_SECRET not set — using insecure default (dev only)');
    return 'prismatic-dev-secret-2024';
  }
  return secret;
})();

function getSecretKey() {
  return new TextEncoder().encode(AUTH_SECRET);
}

interface JWTPayload {
  userId: string;
  email?: string;
  name?: string;
  iat?: number;
  exp?: number;
}

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

function isDemoUser(userId: string, email?: string): boolean {
  return userId.startsWith('demo_') || (email != null && email.startsWith('demo'));
}

async function getUserRoleFromDB(userId: string): Promise<string> {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return 'FREE';
    // eslint-disable-next-line
    const sql = neon(connectionString);
    const rows = await sql`
      SELECT role::text as role
      FROM users
      WHERE id = ${userId}
        AND status::text = 'ACTIVE'
      LIMIT 1
    `;
    if (rows.length === 0) return 'FREE';
    return String(rows[0].role);
  } catch (err) {
    console.error('[middleware] getUserRoleFromDB error:', err);
    return 'FREE';
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Affiliate: parse ?ref=CODE and set httpOnly cookie ─────────────────────
  const ref = req.nextUrl.searchParams.get('ref');
  if (ref) {
    const existing = req.cookies.get('prismatic_ref');
    if (!existing) {
      const response = NextResponse.next();
      response.cookies.set('prismatic_ref', ref, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
      return response;
    }
  }

  // Auth guard for /app routes
  if (pathname.startsWith('/app')) {
    const token = req.cookies.get('prismatic_token')?.value;
    if (!token || !(await verifyToken(token))) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Admin guard for /admin routes
  if (pathname.startsWith('/admin')) {
    const token = req.cookies.get('prismatic_token')?.value;
    if (!token) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }

    // DEMO USER BYPASS: inline check, before DB call.
    // CRITICAL: bypass is ONLY allowed when BOTH conditions are met:
    //   1. ALLOW_ADMIN_BYPASS is explicitly set to 'true'
    //   2. NOT in production (or Vercel preview/local dev only)
    const canBypass = process.env.ALLOW_ADMIN_BYPASS === 'true'
      && (process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production');
    if (isDemoUser(payload.userId, payload.email) && canBypass) {
      return NextResponse.next();
    }

    // DB role check
    const role = await getUserRoleFromDB(payload.userId);
    if (role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/app', req.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
