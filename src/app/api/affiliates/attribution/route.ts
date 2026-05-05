/**
 * Attribution API
 * POST /api/affiliates/attribution — record first-touch referral for logged-in user
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function sql() { return neon(process.env.DATABASE_URL!); }

function hash(str: string): string {
  // Simple hash for IP anonymization (keep first 2 octets only)
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h.toString(16);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referral_code, user_id, landing_page, referrer, user_agent } = body;

    if (!referral_code || !user_id) {
      return NextResponse.json({ error: 'referral_code and user_id required' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
             ?? req.headers.get('x-real-ip')
             ?? 'unknown';
    const ip_hash = hash(ip);

    const db = sql();

    // Look up affiliate by referral code
    const affiliate = await db`
      SELECT id, status FROM prismatic_affiliates
      WHERE referral_code = ${referral_code.toUpperCase()}
    `;

    if (!affiliate[0]) {
      return NextResponse.json({ attributed: false, reason: 'invalid_code' });
    }

    if (affiliate[0].status !== 'active') {
      return NextResponse.json({ attributed: false, reason: 'partner_inactive' });
    }

    // Check if already recorded (idempotent)
    const existing = await db`
      SELECT id FROM prismatic_referrals WHERE user_id = ${user_id}
    `;

    if (existing.length > 0) {
      return NextResponse.json({ attributed: false, reason: 'already_recorded' });
    }

    // Record referral
    await db`
      INSERT INTO prismatic_referrals
        (affiliate_id, user_id, ip_hash, user_agent, referrer, landing_page)
      VALUES (
        ${affiliate[0].id},
        ${user_id},
        ${ip_hash},
        ${user_agent ?? null},
        ${referrer ?? null},
        ${landing_page ?? null}
      )
    `;

    // Update affiliate referral count
    await db`
      UPDATE prismatic_affiliates
      SET total_referrals = total_referrals + 1
      WHERE id = ${affiliate[0].id}
    `;

    return NextResponse.json({ attributed: true, affiliate_id: affiliate[0].id });
  } catch (err) {
    console.error('[API/attribution]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
