/**
 * POST /api/admin/users/[id]/credits — Add paid credits to a user (admin only)
 * 
 * 新纯积分系统：充值积分操作
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
    const { amount, description } = body;

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }

    // Use transaction to atomically update credits and write log
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new Error('User not found');

      const newBalance = (user.credits || 0) + amount;
      await tx.user.update({
        where: { id },
        data: { credits: { increment: amount } },
      });
      await tx.userCreditLog.create({
        data: {
          userId: id,
          type: 'ADMIN_ADD',
          amount,
          balance: newBalance,
          description: description || `管理员手动充值 ${amount} 积分`,
          operatorId: adminId,
        },
      });
      return { newBalance };
    });

    return NextResponse.json({
      id,
      paidCredits: result.newBalance,
      dailyCredits: 20, // 每日积分由定时任务管理
      added: amount,
    });
  } catch (error) {
    console.error('[Admin POST /users/[id]/credits] Error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}

/**
 * GET /api/admin/users/[id]/credits — Get user points info
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        credits: true,
        dailyCredits: true,
        lastDailyResetAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      paidCredits: user.credits || 0,
      dailyCredits: user.dailyCredits || 20,
      lastDailyResetAt: user.lastDailyResetAt,
      totalCredits: (user.credits || 0) + (user.dailyCredits || 20),
    });
  } catch (error) {
    console.error('[Admin GET /users/[id]/credits] Error:', error);
    return NextResponse.json({ error: 'Failed to get credits' }, { status: 500 });
  }
}
