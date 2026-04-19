/**
 * User credit transaction logs
 * GET — returns paginated credit history
 */
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, parseInt(searchParams.get('pageSize') || '20', 10));

  const [logs, total] = await Promise.all([
    prisma.userCreditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.userCreditLog.count({ where: { userId } }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
