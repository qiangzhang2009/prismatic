/**
 * GET /api/admin/users/[id]/usage — Per-user usage detail (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest } from '@/lib/user-management';
import { getUserUsageDetail } from '@/lib/message-stats';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') ?? '7'), 30);

  try {
    const usage = await getUserUsageDetail(id, days);
    return NextResponse.json(usage);
  } catch (error) {
    console.error('[Admin User Usage API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user usage' }, { status: 500 });
  }
}
