export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyJWTToken, isAdmin, type UserRole } from '@/lib/user-management';

async function adminAuth(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return null;
  const payload = verifyJWTToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, status: true },
  });
  if (!user) return null;
  if (!isAdmin(user.role as UserRole)) return null;
  if (user.status !== 'ACTIVE') return null;
  return payload.userId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await adminAuth(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let gender: string | null = null;
    let province: string | null = null;
    try {
      const raw = typeof user.preferences === 'string'
        ? JSON.parse(user.preferences)
        : (user.preferences || {});
      const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
      gender = prefs.gender || null;
      province = prefs.province || null;
    } catch { /* ignore parse errors */ }

    return NextResponse.json({
      id: user.id,
      email: user.email || '',
      name: user.name,
      gender,
      province,
      emailVerified: !!user.emailVerified,
      status: user.status,
      role: user.role || 'FREE',
      plan: user.plan || 'FREE',
      credits: user.credits || 0,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin GET /users/[id]/edit]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await adminAuth(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    console.log('[Admin PUT /users/[id]/edit] body:', JSON.stringify(body));

    const { name, email, role, plan, status, gender, province, credits } = body;

    // Email uniqueness check
    if (email && email.trim()) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), id: { not: id } },
      });
      if (existing) {
        return NextResponse.json({ error: '邮箱已被其他账号使用' }, { status: 409 });
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (credits !== undefined) updateData.credits = credits;

    // Handle preferences
    if (gender !== undefined || province !== undefined) {
      const existing = await prisma.user.findUnique({ where: { id } });
      let prefs: any = {};
      try {
        if (existing?.preferences) {
          const raw = typeof existing.preferences === 'string'
            ? JSON.parse(existing.preferences)
            : existing.preferences;
          prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } catch { /* use empty object */ }
      if (gender !== undefined) prefs.gender = gender;
      if (province !== undefined) prefs.province = province;
      updateData.preferences = prefs;
    }

    console.log('[Admin PUT /users/[id]/edit] updateData:', JSON.stringify(updateData));

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id },
        data: updateData,
      });
    }

    // Fetch updated user
    const updated = await prisma.user.findUnique({ where: { id } });
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let genderVal: string | null = null;
    let provinceVal: string | null = null;
    try {
      const raw = typeof updated.preferences === 'string'
        ? JSON.parse(updated.preferences)
        : (updated.preferences || {});
      const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
      genderVal = prefs.gender || null;
      provinceVal = prefs.province || null;
    } catch { /* ignore */ }

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email || '',
        name: updated.name,
        gender: genderVal,
        province: provinceVal,
        emailVerified: !!updated.emailVerified,
        status: updated.status,
        role: updated.role || 'FREE',
        plan: updated.plan || 'FREE',
        credits: updated.credits || 0,
        avatar: updated.avatar,
      }
    });
  } catch (error: any) {
    console.error('[Admin PUT /users/[id]/edit] ERROR:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
