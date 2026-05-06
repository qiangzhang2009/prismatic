/**
 * Affiliates API
 * GET  /api/affiliates          — list all (admin)
 * GET  /api/affiliates/:id      — get single affiliate + conversions
 * POST /api/affiliates          — create affiliate (admin or self-register)
 * PUT  /api/affiliates          — update / approve / reject / pause / delete / settle (admin)
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateRequest, authenticateAdminRequest } from '@/lib/user-management';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';

function sql() { return neon(process.env.DATABASE_URL!); }
function makeCode() { return nanoid(8).toUpperCase(); }
function makeToken() { return randomBytes(16).toString('base64url'); }

// GET — list affiliates (admin only)
export async function GET(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = sql();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const status = searchParams.get('status') ?? 'all';

    // GET single affiliate with conversions
    if (id) {
      const rows = await db`
        SELECT id, partner_id, name, wechat_id, email, referral_code,
               commission_type, commission_rate, commission_fixed,
               status, total_referrals, total_conversions,
               total_commission, pending_commission, withdrawn_commission,
               bio, dashboard_token, created_at, updated_at
        FROM prismatic_affiliates
        WHERE id = ${Number(id)}
      `;
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const conversions = await db`
        SELECT id, plan, amount, commission, commission_status, created_at
        FROM prismatic_conversions
        WHERE affiliate_id = ${Number(id)}
        ORDER BY created_at DESC
        LIMIT 200
      `;
      const referrals = await db`
        SELECT id, user_id, referral_code, referred_at
        FROM prismatic_referrals
        WHERE affiliate_id = ${Number(id)}
        ORDER BY referred_at DESC
        LIMIT 100
      `;
      return NextResponse.json({ affiliate: rows[0], conversions, referrals });
    }

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
    return NextResponse.json({
      affiliate,
      dashboard_url: `/partners/dashboard?token=${dashboard_token}`,
    }, { status: 201 });
  } catch (err) {
    console.error('[API/affiliates POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — admin update affiliate (approve/reject/pause/activate, edit fields, settle commission)
export async function PUT(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      id, action,
      name, wechat_id, email, commission_type, commission_rate, commission_fixed, bio,
      settle_amount,
    } = body;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = sql();

    // Status actions
    if (action === 'approve') {
      await db`UPDATE prismatic_affiliates SET status = 'active', updated_at = NOW() WHERE id = ${Number(id)}`;
      return NextResponse.json({ ok: true, message: '已批准' });
    }
    if (action === 'reject') {
      await db`UPDATE prismatic_affiliates SET status = 'rejected', updated_at = NOW() WHERE id = ${Number(id)}`;
      return NextResponse.json({ ok: true, message: '已拒绝' });
    }
    if (action === 'pause') {
      await db`UPDATE prismatic_affiliates SET status = 'paused', updated_at = NOW() WHERE id = ${Number(id)}`;
      return NextResponse.json({ ok: true, message: '已暂停' });
    }
    if (action === 'activate') {
      await db`UPDATE prismatic_affiliates SET status = 'active', updated_at = NOW() WHERE id = ${Number(id)}`;
      return NextResponse.json({ ok: true, message: '已激活' });
    }

    // Commission settlement
    if (action === 'settle') {
      const amount = Number(settle_amount);
      if (!settle_amount || isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: '结算金额必须大于0' }, { status: 400 });
      }
      // Get current pending_commission
      const rows = await db`SELECT pending_commission, withdrawn_commission FROM prismatic_affiliates WHERE id = ${Number(id)}`;
      if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const current = Number(rows[0].pending_commission);
      const settled = Math.min(amount, current);
      await db`
        UPDATE prismatic_affiliates SET
          pending_commission = pending_commission - ${settled},
          withdrawn_commission = withdrawn_commission + ${settled},
          updated_at = NOW()
        WHERE id = ${Number(id)}
      `;
      return NextResponse.json({ ok: true, settled, remaining: current - settled, message: `已结算 ¥${settled.toFixed(2)}` });
    }

    // Full field update (edit)
    const updates: Record<string, any> = { updated_at: new Date() };
    if (name !== undefined) updates.name = name;
    if (wechat_id !== undefined) updates.wechat_id = wechat_id;
    if (email !== undefined) updates.email = email || null;
    if (commission_type !== undefined) updates.commission_type = commission_type;
    if (commission_rate !== undefined) updates.commission_rate = Number(commission_rate);
    if (commission_fixed !== undefined) updates.commission_fixed = Number(commission_fixed);
    if (bio !== undefined) updates.bio = bio || null;

    const fields = Object.keys(updates);
    if (fields.length > 1) {
      // Build dynamic SET clause
      const setClauses = fields.map((k, i) => `"${k}" = $${i + 2}`).join(', ');
      const vals = [Number(id), ...fields.map(k => updates[k])];
      await db.query(`UPDATE prismatic_affiliates SET ${setClauses} WHERE id = $1`, vals);
    }

    return NextResponse.json({ ok: true, message: '已更新' });
  } catch (err) {
    console.error('[API/affiliates PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// DELETE — delete affiliate (admin only)
export async function DELETE(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const db = sql();

    // Delete conversions and referrals first (foreign key)
    await db`DELETE FROM prismatic_conversions WHERE affiliate_id = ${Number(id)}`;
    await db`DELETE FROM prismatic_referrals WHERE affiliate_id = ${Number(id)}`;
    const result = await db`DELETE FROM prismatic_affiliates WHERE id = ${Number(id)} RETURNING id`;

    if (!result[0]) return NextResponse.json({ error: 'Affiliate not found' }, { status: 404 });

    return NextResponse.json({ ok: true, deleted: result[0].id });
  } catch (err) {
    console.error('[API/affiliates DELETE]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
