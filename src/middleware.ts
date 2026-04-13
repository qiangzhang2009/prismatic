/**
 * Prismatic — Middleware
 * Protects /app routes — requires valid prismatic_token (JWS)
 * Uses jose for Edge runtime compatibility.
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';

function getSecretKey() {
  return new TextEncoder().encode(AUTH_SECRET);
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith('/app')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('prismatic_token')?.value;

  if (!token || !(await verifyToken(token))) {
    const signInUrl = new URL('/auth/signin', req.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
