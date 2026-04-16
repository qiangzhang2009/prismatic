/**
 * GET /api/auth/test-db?userId=xxx — Direct DB test (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest, getUserById } from '@/lib/user-management';

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  try {
    const user = await getUserById(userId);
    return NextResponse.json({ userId, user });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
