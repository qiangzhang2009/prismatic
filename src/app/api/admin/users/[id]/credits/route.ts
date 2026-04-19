/**
 * POST /api/admin/users/[id]/credits — Add credits to a user (admin only)
 * Records the operation in UserCreditLog for auditability.
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
      credits: result.newBalance,
      added: amount,
    });
  } catch (error) {
    console.error('[Admin POST /users/[id]/credits] Error:', error);
    return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
  }
}
