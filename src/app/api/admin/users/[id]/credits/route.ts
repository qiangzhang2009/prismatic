/**
 * POST /api/admin/users/[id]/credits — Add credits to a user (admin only)
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { authenticateAdminRequest } from '@/lib/user-management';

const prisma = new PrismaClient();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { amount } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { credits: { increment: amount } },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email || '',
      name: user.name,
      role: user.role || 'FREE',
      plan: user.plan || 'FREE',
      credits: user.credits || 0,
    });
  } catch (error) {
    console.error('[Admin POST /users/[id]/credits] Error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}
