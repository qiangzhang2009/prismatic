/**
 * User points info
 * GET — returns current points, daily points, paid points, and last reset time
 * 
 * 新纯积分系统 API
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/user-management';
import { getUserPointsInfo } from '@/lib/points-service';

export async function GET(request: NextRequest) {
  const userId = await authenticateRequest(request);
  if (!userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const pointsInfo = await getUserPointsInfo(userId);

  if (!pointsInfo) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    totalPoints: pointsInfo.totalPoints,
    dailyPoints: pointsInfo.dailyPoints,
    paidPoints: pointsInfo.paidPoints,
    lastResetAt: pointsInfo.lastResetAt,
    isResetDue: pointsInfo.isResetDue,
    // 兼容旧 API
    credits: pointsInfo.totalPoints,
    isUnlimited: false,
  });
}
