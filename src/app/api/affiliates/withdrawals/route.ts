/**
 * Withdrawals API
 * POST /api/affiliates/withdrawals — partner requests a withdrawal
 * GET  /api/affiliates/withdrawals — list withdrawals (admin)
 * PUT  /api/affiliates/withdrawals — admin processes a withdrawal
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

function sql() { return neon(process.env.DATABASE_URL!); }

// POST — partner requests withdrawal (auth via token query param)
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 401 });

    const body = await req.json();
    const { amount } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const db = sql();

    // Verify token
    const affiliate = await db`
      SELECT id, wechat_id, pending_commission FROM prismatic_affiliates
      WHERE dashboard_token = ${token} AND status = 'active'
    `;

    if (!affiliate[0]) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const pending = Number(affiliate[0].pending_commission);
    if (amount > pending) {
      return NextResponse.json({ error: `可提现金额不足，当前可提 ¥${pending.toFixed(2)}` }, { status: 400 });
    }

    const rows = await db`
      INSERT INTO prismatic_withdrawals (affiliate_id, amount, method, payment_info)
      VALUES (${affiliate[0].id}, ${amount}, 'wechat', ${affiliate[0].wechat_id})
      RETURNING id, amount, status, created_at
    `;

    // Deduct from pending
    await db`
      UPDATE prismatic_affiliates
      SET pending_commission = pending_commission - ${amount}
      WHERE id = ${affiliate[0].id}
    `;

    return NextResponse.json({ withdrawal: rows[0] }, { status: 201 });
  } catch (err) {
    console.error('[API/withdrawals POST]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — list withdrawals (admin)
export async function GET(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = sql();
    const rows = await db`
      SELECT w.id, w.affiliate_id, w.amount, w.status, w.method, w.payment_info,
             w.processed_at, w.note, w.created_at,
             a.name as affiliate_name, a.wechat_id
      FROM prismatic_withdrawals w
      JOIN prismatic_affiliates a ON a.id = w.affiliate_id
      ORDER BY w.created_at DESC
      LIMIT 100
    `;

    return NextResponse.json({ withdrawals: rows });
  } catch (err) {
    console.error('[API/withdrawals GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT — admin processes withdrawal
export async function PUT(req: NextRequest) {
  try {
    const adminId = await authenticateAdminRequest(req);
    if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { withdrawal_id, status, note } = body;

    const db = sql();

    if (status === 'paid') {
      await db`
        UPDATE prismatic_withdrawals
        SET status = 'paid', processed_by = ${adminId}, processed_at = NOW(), note = ${note ?? null}
        WHERE id = ${Number(withdrawal_id)}
      `;
    } else if (status === 'rejected') {
      // Return amount to pending
      const wd = await db`SELECT affiliate_id, amount FROM prismatic_withdrawals WHERE id = ${Number(withdrawal_id)}`;
      if (wd[0]) {
        await db`
          UPDATE prismatic_affiliates
          SET pending_commission = pending_commission + ${wd[0].amount}
          WHERE id = ${wd[0].affiliate_id}
        `;
      }
      await db`
        UPDATE prismatic_withdrawals
        SET status = 'rejected', processed_by = ${adminId}, processed_at = NOW(), note = ${note ?? null}
        WHERE id = ${Number(withdrawal_id)}
      `;
    } else {
      await db`
        UPDATE prismatic_withdrawals
        SET status = ${status}, note = ${note ?? null}
        WHERE id = ${Number(withdrawal_id)}
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API/withdrawals PUT]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
