/**
 * POST /api/auth/login
 * Login with email + password
 * Supports both database users and demo accounts
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createJWTToken, demoEmailToUUID, ensureDemoUserInDB, getUserById, canUseProFeatures } from '@/lib/user-management';
import { z } from 'zod';

const DEMO_ACCOUNTS = [
  { email: 'demo1@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo2@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo3@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo4@prismatic.app', password: 'Prismatic2024!' },
  { email: 'demo5@prismatic.app', password: 'Prismatic2024!' },
];

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Force no-cache so Set-Cookie headers are never stripped by Vercel edge caching
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

function isDemoAccount(email: string, password: string) {
  return DEMO_ACCOUNTS.some(
    (demo) => demo.email.toLowerCase() === email.toLowerCase() && demo.password === password
  );
}

function createDemoUser(email: string) {
  const num = email.match(/demo(\d+)/)?.[1] || '1';
  const uuid = demoEmailToUUID(email.toLowerCase());
  return {
    id: `demo_${uuid}`,  // prefix lets isDemoUserId() identify demo users
    email: email.toLowerCase(),
    name: `演示账号 ${num}`,
    nameZh: `演示账号 ${num}`,
    gender: null,
    province: null,
    emailVerified: true,
    role: 'PRO' as const,
    plan: 'LIFETIME' as const,
    avatar: null,
    canUseProFeatures: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { email, password } = loginSchema.parse(json);

    // Check demo accounts first
    if (isDemoAccount(email, password)) {
      const demoUser = createDemoUser(email);
      // Ensure demo user is active in DB (handles soft-deleted users)
      const dbId = demoUser.id.replace('demo_', '');
      await ensureDemoUserInDB(dbId, demoUser.email, demoUser.name);
      // Fetch latest data from DB so admin modifications are reflected
      const dbUser = await getUserById(dbId);
      const token = createJWTToken(demoUser.id, demoUser.email);
      const responseBody = dbUser
        ? { user: { ...dbUser, canUseProFeatures: canUseProFeatures(dbUser.role, dbUser.plan, dbUser.credits) }, message: 'Login successful' }
        : { user: demoUser, message: 'Login successful' };
      const response = NextResponse.json(responseBody, { status: 200, headers: NO_CACHE_HEADERS });
      response.cookies.set('prismatic_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60,
        path: '/',
      });
      return response;
    }

    const user = await verifyCredentials(email, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }
    console.log(`[POST /api/auth/login] verifyCredentials returned: id=${user.id} plan=${user.plan} credits=${user.credits}`);

    const token = createJWTToken(user.id, user.email);

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          avatar: user.avatar,
        },
        message: 'Login successful'
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
