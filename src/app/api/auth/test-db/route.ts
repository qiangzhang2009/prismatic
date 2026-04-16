/**
 * GET /api/auth/test-db?userId=xxx — Direct DB test (admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function GET(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const sql = neon(process.env.DATABASE_URL!);
  try {
    // Direct unsafe query to bypass any type coercion
    const result = await sql.unsafe(
      `SELECT id, email, role, plan, credits FROM prismatic_users WHERE id = '${userId}' AND is_active = TRUE`
    ) as any;
    return NextResponse.json({ userId, result, length: result.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
