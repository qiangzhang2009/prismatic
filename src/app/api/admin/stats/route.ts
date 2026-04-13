/**
 * GET /api/admin/stats — Get user statistics (admin only)
 * Add ?debug=true to see raw query results including inactive users
 */
import { NextRequest, NextResponse } from 'next/server';
import { authenticateAdminRequest, getUserStats } from '@/lib/user-management';
import { neon } from '@neondatabase/serverless';

// Add timeout wrapper for database operations
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Debug mode: show all users (including inactive) and raw counts
  if (req.nextUrl.searchParams.get('debug') === 'true') {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const allRows = await withTimeout(sql`SELECT id, email, role, plan, email_verified, is_active, created_at FROM prismatic_users ORDER BY created_at DESC`, 8000);
      if (!allRows) {
        return NextResponse.json({ error: 'Database timeout' }, { status: 503 });
      }
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

  const stats = await withTimeout(getUserStats(), 8000);
  if (!stats) {
    // Return empty stats if timeout
    return NextResponse.json({
      total: 0,
      byRole: {},
      byPlan: {},
      recent: 0,
      verified: 0,
      note: 'Data temporarily unavailable',
    });
  }
  return NextResponse.json(stats);
}
