/**
 * User credits + billing mode info
 * GET — returns current credits, plan, and active billing mode
 */
import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      plan: true,
      apiKeyEncrypted: true,
      apiKeyStatus: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const hasApiKey = !!(user.apiKeyEncrypted && user.apiKeyStatus === 'valid');
  const activeMode = hasApiKey ? 'A' : 'B';

  return NextResponse.json({
    credits: user.plan !== 'FREE' ? -1 : (user.credits ?? 0),
    plan: user.plan ?? 'FREE',
    isUnlimited: user.plan !== 'FREE',
    hasApiKey,
    apiKeyStatus: user.apiKeyStatus,
    activeMode,
  });
}
