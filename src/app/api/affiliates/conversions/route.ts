/**
 * Conversion API
 * POST /api/affiliates/conversions — record a conversion
 * GET  /api/affiliates/conversions — list conversions (admin)
 * PUT  /api/affiliates/conversions — update commission status (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

function sql() { return neon(process.env.DATABASE_URL!); }

function computeCommission(
  amount: number,
  type: string,
  rate: number,
  fixed: number
): number {
  if (type === 'percentage') return Math.round(amount * rate) / 100;
  if (type === 'fixed') return fixed;
  if (type === 'both') return Math.max(Math.round(amount * rate) / 100, fixed);
  return 0;
}

// POST — record a conversion (called when user completes payment)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, plan, amount, ip_hash, user_agent, utm_source, utm_medium, utm_campaign, referrer } = body;

    if (!user_id || !plan) {
      return NextResponse.json({ error: 'user_id and plan are required' }, { status: 400 });
    }

    const db = sql();

    // Check if user already has an affiliate referral
    const existing = await db`
      SELECT affiliate_id FROM prismatic_referrals WHERE user_id = ${user_id} LIMIT 1
    `;

    if (existing.length === 0) {
      return NextResponse.json({ conversion: null, reason: 'no_referral' });
    }

    const affiliateId = existing[0].affiliate_id;

    // Get affiliate commission settings
    const affiliate = await db`
      SELECT commission_type, commission_rate, commission_fixed
      FROM prismatic_affiliates WHERE id = ${affiliateId}
    `;

    if (!affiliate[0]) {
      return NextResponse.json({ conversion: null, reason: 'affiliate_not_found' });
    }

    const commission = computeCommission(
      amount ?? 0,
      affiliate[0].commission_type,
      Number(affiliate[0].commission_rate),
      Number(affiliate[0].commission_fixed)
    );

    // Insert conversion
    const rows = await db`
      INSERT INTO prismatic_conversions
        (affiliate_id, user_id, plan, amount, commission, ip_hash, user_agent,
         utm_source, utm_medium, utm_campaign, referrer)
      VALUES (
        ${affiliateId}, ${user_id}, ${plan}, ${amount ?? 0}, ${commission},
        ${ip_hash ?? null}, ${user_agent ?? null},
        ${utm_source ?? null}, ${utm_medium ?? null}, ${utm_campaign ?? null},
        ${referrer ?? null}
      )
      RETURNING id, commission
    `;

    // Update affiliate stats
    await db`
      UPDATE prismatic_affiliates SET
        total_conversions = total_conversions + 1,
        total_commission = total_commission + ${commission},
        pending_commission = pending_commission + ${commission},
        updated_at = NOW()
      WHERE id = ${affiliateId}
    `;

    return NextResponse.json({ conversion: rows[0], commission }, { status: 201 });
  } catch (err) {
    console.error('[API/conversions POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — list all conversions (admin only)
export async function GET(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'all';
    const db = sql();

    let rows;
    if (status === 'all') {
      rows = await db`
        SELECT c.id, c.user_id, c.plan, c.amount, c.commission,
               c.commission_status, c.created_at,
               a.name as affiliate_name, a.referral_code
        FROM prismatic_conversions c
        JOIN prismatic_affiliates a ON a.id = c.affiliate_id
        ORDER BY c.created_at DESC
        LIMIT 200
      `;
    } else {
      rows = await db`
        SELECT c.id, c.user_id, c.plan, c.amount, c.commission,
               c.commission_status, c.created_at,
               a.name as affiliate_name, a.referral_code
        FROM prismatic_conversions c
        JOIN prismatic_affiliates a ON a.id = c.affiliate_id
        WHERE c.commission_status = ${status}
        ORDER BY c.created_at DESC
        LIMIT 200
      `;
    }

    return NextResponse.json({ conversions: rows });
  } catch (err) {
    console.error('[API/conversions GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — update conversion status (admin: settle commission)
export async function PUT(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { conversion_id, status } = body;

    if (!conversion_id || !status) {
      return NextResponse.json({ error: 'conversion_id and status required' }, { status: 400 });
    }

    const db = sql();

    // Get conversion details
    const conv = await db`
      SELECT affiliate_id, commission, commission_status FROM prismatic_conversions
      WHERE id = ${Number(conversion_id)}
    `;

    if (!conv[0]) return NextResponse.json({ error: 'Conversion not found' }, { status: 404 });

    if (conv[0].commission_status === status) {
      return NextResponse.json({ ok: true, message: 'No change' });
    }

    // Update conversion
    await db`
      UPDATE prismatic_conversions SET
        commission_status = ${status},
        settled_at = ${status === 'paid' ? new Date() : null},
        settled_by = ${status === 'paid' ? adminId : null}
      WHERE id = ${Number(conversion_id)}
    `;

    // Update affiliate pending/withdrawn amounts
    if (status === 'paid' || status === 'cancelled') {
      const delta = conv[0].commission;
      if (status === 'paid') {
        await db`
          UPDATE prismatic_affiliates SET
            pending_commission = pending_commission - ${delta},
            withdrawn_commission = withdrawn_commission + ${delta}
          WHERE id = ${conv[0].affiliate_id}
        `;
      } else if (status === 'cancelled') {
        await db`
          UPDATE prismatic_affiliates SET
            pending_commission = pending_commission - ${delta},
            total_commission = total_commission - ${delta}
          WHERE id = ${conv[0].affiliate_id}
        `;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API/conversions PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
