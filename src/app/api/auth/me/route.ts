/**
 * GET /api/auth/me — Get current authenticated user
 * PUT /api/auth/me — Update current user profile
 */

// Force dynamic rendering — this route must NEVER be cached.
// It reads from the database on every request to reflect admin changes immediately.
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  verifyJWTToken, updateUserName, updateUserProfile,
  canUseProFeatures, isDemoUserId, demoEmailToUUID,
} from '@/lib/user-management';

const prisma = new PrismaClient();

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

  // ── Demo user: return hardcoded demo user (no DB required) ───────────────────
  if (isDemoUserId(userId)) {
    const demoUser = {
      id: userId,
      email: payload.email || 'demo@prismatic.app',
      name: '演示账号',
      gender: null,
      province: null,
      emailVerified: true,
      role: 'PRO' as const,
      plan: 'LIFETIME' as const,
      credits: 999999,
      avatar: null,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };
    return NextResponse.json({ user: { ...demoUser, canUseProFeatures: true, isAdmin: false } }, { headers: NO_CACHE_HEADERS });
  }

  // ── Regular user: query DB by userId ────────────────────────────────────────
  // Query the users table (Prisma) instead of the legacy prismatic_users table
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) return NextResponse.json({ user: null }, { headers: NO_CACHE_HEADERS });

  const role: 'FREE' | 'PRO' | 'ADMIN' = (user.role || 'FREE') as any;
  const plan: 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME' = (user.plan || 'FREE') as any;
  const u = {
    id: user.id,
    email: user.email || '',
    name: user.name,
    gender: (() => { try { const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences; return p?.gender || null; } catch { return null; } })() as 'male' | 'female' | null,
    province: (() => { try { const p = typeof user.preferences === 'string' ? JSON.parse(user.preferences as string) : user.preferences; return p?.province || null; } catch { return null; } })() as string | null,
    emailVerified: !!user.emailVerified,
    role,
    plan,
    credits: user.credits || 0,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLoginAt: user.updatedAt,
  };
  console.log(`[GET /api/auth/me] userId=${userId} → found=true role=${u.role} plan=${u.plan} credits=${u.credits}`);
  return NextResponse.json({
    user: {
      ...u,
      canUseProFeatures: canUseProFeatures(u.role, u.plan, u.credits),
      isAdmin: u.role === 'ADMIN',
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

    // Demo user: read-only (no DB profile to update)
    if (isDemoUserId(userId)) {
      return NextResponse.json({ user: { id: userId, email: payload.email || 'demo@prismatic.app', name: '演示账号', role: 'PRO', plan: 'LIFETIME', credits: 999999, canUseProFeatures: true, isAdmin: false } }, { headers: NO_CACHE_HEADERS });
    }

    // Regular user: update profile using Prisma
    if (name !== undefined) await updateUserName(userId, name);
    if (gender !== undefined || province !== undefined) {
      await updateUserProfile(userId, { gender, province });
    }
    // Read back from Prisma users table
    const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!updatedUser) return NextResponse.json({ error: 'User not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    const up = {
      id: updatedUser.id,
      email: updatedUser.email || '',
      name: updatedUser.name,
      gender: (() => { try { const p = typeof updatedUser.preferences === 'string' ? JSON.parse(updatedUser.preferences as string) : updatedUser.preferences; return p?.gender || null; } catch { return null; } })() as 'male' | 'female' | null,
      province: (() => { try { const p = typeof updatedUser.preferences === 'string' ? JSON.parse(updatedUser.preferences as string) : updatedUser.preferences; return p?.province || null; } catch { return null; } })() as string | null,
      emailVerified: !!updatedUser.emailVerified,
      role: (updatedUser.role || 'FREE') as 'FREE' | 'PRO' | 'ADMIN',
      plan: (updatedUser.plan || 'FREE') as 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME',
      credits: updatedUser.credits || 0,
      avatar: updatedUser.avatar,
      createdAt: updatedUser.createdAt,
      lastLoginAt: updatedUser.updatedAt,
    };
    return NextResponse.json({ user: up }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
