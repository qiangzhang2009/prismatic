/**
 * Affiliates API
 * GET  /api/affiliates          — list all (admin)
 * POST /api/affiliates          — create affiliate (admin or self-register)
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, authenticateAdminRequest } from '@/lib/user-management';
import { nanoid } from 'nanoid';

function sql() { return neon(process.env.DATABASE_URL!); }
function makeCode() { return nanoid(8).toUpperCase(); }
function makeToken() { return nanoid(32); }

// GET — list affiliates (admin only)
export async function GET(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') ?? 'all';

    const db = sql();
    let rows;
    if (status === 'all') {
      rows = await db`
        SELECT id, partner_id, name, wechat_id, email, referral_code,
               commission_type, commission_rate, commission_fixed,
               status, total_referrals, total_conversions,
               total_commission, pending_commission, withdrawn_commission,
               bio, created_at
        FROM prismatic_affiliates
        ORDER BY created_at DESC
      `;
    } else {
      rows = await db`
        SELECT id, partner_id, name, wechat_id, email, referral_code,
               commission_type, commission_rate, commission_fixed,
               status, total_referrals, total_conversions,
               total_commission, pending_commission, withdrawn_commission,
               bio, created_at
        FROM prismatic_affiliates
        WHERE status = ${status}
        ORDER BY created_at DESC
      `;
    }

    return NextResponse.json({ affiliates: rows });
  } catch (err) {
    console.error('[API/affiliates GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — create affiliate (admin or self-registration)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, wechat_id, email, commission_type, commission_rate, commission_fixed, bio, is_admin } = body;

    if (!name || !wechat_id) {
      return NextResponse.json({ error: 'name and wechat_id are required' }, { status: 400 });
    }

    const db = sql();
    let referral_code: string;
    let dashboard_token: string;

    // Generate unique codes
    let attempts = 0;
    do {
      referral_code = makeCode();
      const existing = await db`SELECT 1 FROM prismatic_affiliates WHERE referral_code = ${referral_code}`;
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);
    if (attempts >= 10) return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });

    attempts = 0;
    do {
      dashboard_token = makeToken();
      const existing = await db`SELECT 1 FROM prismatic_affiliates WHERE dashboard_token = ${dashboard_token}`;
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);
    if (attempts >= 10) return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });

    // Self-registration → pending; Admin creates → active
    const status = is_admin ? 'active' : 'pending';

    const rows = await db`
      INSERT INTO prismatic_affiliates
        (partner_id, name, wechat_id, email, referral_code, dashboard_token,
         commission_type, commission_rate, commission_fixed, status, bio)
      VALUES (
        ${'partner_' + nanoid(6)},
        ${name},
        ${wechat_id},
        ${email ?? null},
        ${referral_code},
        ${dashboard_token},
        ${commission_type ?? 'percentage'},
        ${commission_rate != null ? Number(commission_rate) : 10},
        ${commission_fixed != null ? Number(commission_fixed) : 0},
        ${status},
        ${bio ?? null}
      )
      RETURNING id, partner_id, name, wechat_id, email, referral_code, dashboard_token,
                commission_type, commission_rate, commission_fixed, status, bio, created_at
    `;

    const affiliate = rows[0];
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://prismatic.zxqconsulting.com';
    return NextResponse.json({
      affiliate,
      dashboard_url: `${baseUrl}/partners/dashboard?token=${dashboard_token}`,
    }, { status: 201 });
  } catch (err) {
    console.error('[API/affiliates POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — admin update affiliate (approve/reject/pause/activate)
export async function PUT(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, action, commission_rate, commission_fixed } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = sql();

    if (action === 'approve') {
      await db`UPDATE prismatic_affiliates SET status = 'active', updated_at = NOW() WHERE id = ${Number(id)}`;
    } else if (action === 'reject') {
      await db`UPDATE prismatic_affiliates SET status = 'rejected', updated_at = NOW() WHERE id = ${Number(id)}`;
    } else if (action === 'pause') {
      await db`UPDATE prismatic_affiliates SET status = 'paused', updated_at = NOW() WHERE id = ${Number(id)}`;
    } else if (action === 'activate') {
      await db`UPDATE prismatic_affiliates SET status = 'active', updated_at = NOW() WHERE id = ${Number(id)}`;
    } else if (commission_rate !== undefined || commission_fixed !== undefined) {
      await db`
        UPDATE prismatic_affiliates SET
          commission_rate = ${commission_rate ?? null},
          commission_fixed = ${commission_fixed ?? null},
          updated_at = NOW()
        WHERE id = ${Number(id)}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API/affiliates PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
