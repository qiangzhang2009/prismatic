/**
 * Dashboard loader — GET /api/affiliates/dashboard?token=XXX
 * Returns affiliate data for the partner dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function sql() { return neon(process.env.DATABASE_URL!); }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const db = sql();

    const owner = await db`
      SELECT id, partner_id, name, wechat_id, referral_code,
             commission_type, commission_rate, commission_fixed,
             total_referrals, total_conversions,
             total_commission, pending_commission, withdrawn_commission,
             bio, created_at
      FROM prismatic_affiliates
      WHERE dashboard_token = ${token}
    `;

    if (!owner[0]) {
      return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
    }

    if (owner[0].status !== 'active') {
      return NextResponse.json({ error: '你的账号正在审核中，请等待管理员批准' }, { status: 403 });
    }

    // Compute live stats from the conversions table (not stale cached fields)
    const liveStats = await db`
      SELECT
        COUNT(*) AS total_conversions,
        COALESCE(SUM(commission), 0) AS total_commission,
        COALESCE(SUM(CASE WHEN commission_status = 'pending' THEN commission ELSE 0 END), 0) AS pending_commission
      FROM prismatic_conversions
      WHERE affiliate_id = ${owner[0].id}
    `;

    const recentConversions = await db`
      SELECT id, plan, amount, commission, commission_status, created_at
      FROM prismatic_conversions
      WHERE affiliate_id = ${owner[0].id}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    // Merge live stats into the affiliate object
    const affiliate = {
      ...owner[0],
      total_conversions: Number(liveStats[0]?.total_conversions ?? 0),
      total_commission: Number(liveStats[0]?.total_commission ?? 0),
      pending_commission: Number(liveStats[0]?.pending_commission ?? 0),
    };

    return NextResponse.json({ affiliate, recent_conversions: recentConversions });
  } catch (err) {
    console.error('[API/affiliates/dashboard]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
