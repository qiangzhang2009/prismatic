/**
 * GET /api/admin/stats — Get user statistics (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById, getUserStats, isAdmin } from '@/lib/user-management';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const session = await getSession(token);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  const stats = await getUserStats();
  return NextResponse.json(stats);
}
