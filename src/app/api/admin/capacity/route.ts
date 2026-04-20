/**
 * Admin capacity monitoring API
 * GET — returns full capacity report (storage, compute, recommendations)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { getCapacityReport } from '@/lib/admin/capacity-monitor';

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const report = await getCapacityReport();
    return NextResponse.json(report);
  } catch (err) {
    console.error('[Admin/Capacity] Error:', err);
    return NextResponse.json({
      storage: null,
      compute: null,
      estimatedDaysBeforeLimit: null,
      recommendedTier: 'free',
      upgradeRecommendation: '容量报告暂时不可用，请稍后重试。',
      generatedAt: new Date().toISOString(),
    });
  }
}
