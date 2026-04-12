/**
 * GET /api/admin/stats — Get user statistics (admin only)
 * Add ?debug=true to see raw query results including inactive users
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, getUserById, getUserStats, isAdmin } from '@/lib/user-management';
import { neon } from '@neondatabase/serverless';

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

  // Debug mode: show all users (including inactive) and raw counts
  if (req.nextUrl.searchParams.get('debug') === 'true') {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const allRows = await sql`SELECT id, email, role, plan, email_verified, is_active, created_at FROM prismatic_users ORDER BY created_at DESC`;
      return NextResponse.json({
        mode: 'debug',
        totalRows: allRows.length,
        activeRows: allRows.filter(r => r.is_active).length,
        inactiveRows: allRows.filter(r => !r.is_active).length,
        users: allRows,
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message });
    }
  }

  const stats = await getUserStats();
  return NextResponse.json(stats);
}
