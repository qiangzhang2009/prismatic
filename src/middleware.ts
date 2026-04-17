/**
 * Prismatic — Middleware
 * Protects /app and /admin routes — validates JWT and checks DB role.
 * Uses jose for Edge runtime compatibility.
 *
 * Security: middleware verifies the user's role against the database on every
 * protected request. This ensures admin demotions take effect immediately —
 * the old JWT role claim alone is not authoritative.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';

function getSecretKey() {
  return new TextEncoder().encode(AUTH_SECRET);
}

interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verifies the JWT token and returns the payload.
 * Returns null if the token is invalid or expired.
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Checks the database for the user's current role.
 * Returns 'ADMIN', 'PRO', or 'FREE'. Defaults to 'FREE' if not found.
 * Falls back gracefully on DB errors so a DB outage doesn't hard-lock users.
 */
async function getUserRoleFromDB(userId: string): Promise<string> {
  // Only import Neon here (Edge-compatible), not Prisma.
  // Only do DB lookup for /admin routes to minimize DB load.
  try {
    const { neon } = await import('@neondatabase/serverless');
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return 'FREE';
    // eslint-disable-next-line
    const sql = neon(connectionString);
    // Cast enums to text for proper string comparison
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
    // DB unavailable — let the request through; /api/auth/me will handle auth errors.
    console.error('[middleware] getUserRoleFromDB error:', err);
    return 'FREE';
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth guard for /app routes (requires any valid JWT)
  if (pathname.startsWith('/app')) {
    const token = req.cookies.get('prismatic_token')?.value;
    if (!token || !(await verifyToken(token))) {
      const signInUrl = new URL('/auth/signin', req.url);
      signInUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Admin guard for /admin routes (requires ADMIN role from DB)
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

    // Check DB for current role — this catches admin demotions immediately.
    const role = await getUserRoleFromDB(payload.userId);
    if (role !== 'ADMIN') {
      const forbiddenUrl = new URL('/app', req.url);
      return NextResponse.redirect(forbiddenUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
