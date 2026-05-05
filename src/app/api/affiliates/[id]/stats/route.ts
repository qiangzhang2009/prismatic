/**
 * Affiliate Stats API
 * GET /api/affiliates/[id]/stats — affiliate's own dashboard stats
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function sql() { return neon(process.env.DATABASE_URL!); }

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    const db = sql();

    // Verify ownership via token
    if (token) {
      const owner = await db`
        SELECT id, partner_id, name, wechat_id, referral_code,
               commission_type, commission_rate, commission_fixed,
               total_referrals, total_conversions,
               total_commission, pending_commission, withdrawn_commission,
               bio, created_at
        FROM prismatic_affiliates
        WHERE id = ${Number(id)} AND dashboard_token = ${token}
      `;
      if (owner.length === 0) {
        return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });
      }

      // Recent conversions
      const recentConversions = await db`
        SELECT id, plan, amount, commission, commission_status, created_at
        FROM prismatic_conversions
        WHERE affiliate_id = ${Number(id)}
        ORDER BY created_at DESC
        LIMIT 20
      `;

      // Monthly stats
      const monthlyStats = await db`
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as conversions,
          COALESCE(SUM(amount), 0) as revenue,
          COALESCE(SUM(commission), 0) as commission
        FROM prismatic_conversions
        WHERE affiliate_id = ${Number(id)}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC
        LIMIT 12
      `;

      return NextResponse.json({
        affiliate: owner[0],
        recent_conversions: recentConversions,
        monthly_stats: monthlyStats,
      });
    }

    // Admin view
    const { authenticateAdminRequest } = await import('@/lib/user-management');
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const affiliate = await db`
      SELECT id, partner_id, name, wechat_id, referral_code,
             commission_type, commission_rate, commission_fixed,
             total_referrals, total_conversions,
             total_commission, pending_commission, withdrawn_commission,
             bio, created_at
      FROM prismatic_affiliates WHERE id = ${Number(id)}
    `;

    if (!affiliate[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const recentConversions = await db`
      SELECT c.id, c.plan, c.amount, c.commission, c.commission_status,
             c.user_id, c.created_at, u.email
      FROM prismatic_conversions c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.affiliate_id = ${Number(id)}
      ORDER BY c.created_at DESC
      LIMIT 50
    `;

    return NextResponse.json({ affiliate: affiliate[0], recent_conversions: recentConversions });
  } catch (err) {
    console.error('[API/affiliates/stats]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
