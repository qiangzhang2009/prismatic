/**
 * Database Migration — Affiliates System
 * Admin only: POST /api/migrate/affiliates
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';

export async function POST(req: NextRequest) {
  const adminId = await authenticateAdminRequest(req);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    const results: string[] = [];

    // ── Affiliates table ──────────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_affiliates (
          id              BIGSERIAL PRIMARY KEY,
          partner_id      VARCHAR(50) UNIQUE NOT NULL,
          name            VARCHAR(100) NOT NULL,
          wechat_id       VARCHAR(100) NOT NULL,
          email           VARCHAR(255),
          referral_code   VARCHAR(20) UNIQUE NOT NULL,
          commission_type VARCHAR(20) DEFAULT 'percentage',
          commission_rate DECIMAL(5,2) DEFAULT 20.00,
          commission_fixed DECIMAL(10,2) DEFAULT 0,
          status          VARCHAR(20) DEFAULT 'pending',
          dashboard_token VARCHAR(100) UNIQUE,
          total_referrals INTEGER DEFAULT 0,
          total_conversions INTEGER DEFAULT 0,
          total_commission DECIMAL(12,2) DEFAULT 0,
          pending_commission DECIMAL(12,2) DEFAULT 0,
          withdrawn_commission DECIMAL(12,2) DEFAULT 0,
          bio             TEXT,
          created_at      TIMESTAMPTZ DEFAULT NOW(),
          updated_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_affiliates_status ON public.prismatic_affiliates(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON public.prismatic_affiliates(referral_code)`;
      results.push('prismatic_affiliates ✓');
    } catch (e: any) {
      results.push(`prismatic_affiliates: ${e.message}`);
    }

    // ── Conversions table ──────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_conversions (
          id              BIGSERIAL PRIMARY KEY,
          affiliate_id    BIGINT REFERENCES public.prismatic_affiliates(id),
          user_id         VARCHAR(255),
          plan            VARCHAR(50),
          amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
          commission      DECIMAL(10,2) DEFAULT 0,
          commission_status VARCHAR(20) DEFAULT 'pending',
          settled_at      TIMESTAMPTZ,
          settled_by      VARCHAR(255),
          ip_hash         VARCHAR(64),
          user_agent      TEXT,
          utm_source      VARCHAR(100),
          utm_medium      VARCHAR(100),
          utm_campaign    VARCHAR(100),
          referrer        TEXT,
          created_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversions_affiliate ON public.prismatic_conversions(affiliate_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversions_user ON public.prismatic_conversions(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_conversions_status ON public.prismatic_conversions(commission_status)`;
      results.push('prismatic_conversions ✓');
    } catch (e: any) {
      results.push(`prismatic_conversions: ${e.message}`);
    }

    // ── Referral tracking table (stores first-touch attribution) ────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_referrals (
          id              BIGSERIAL PRIMARY KEY,
          affiliate_id    BIGINT REFERENCES public.prismatic_affiliates(id),
          user_id         VARCHAR(255) NOT NULL,
          source          VARCHAR(20) DEFAULT 'link',
          ip_hash         VARCHAR(64),
          user_agent      TEXT,
          referrer_url    TEXT,
          landing_page    VARCHAR(500),
          created_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_referrals_user ON public.prismatic_referrals(user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_referrals_affiliate ON public.prismatic_referrals(affiliate_id)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_user_unique ON public.prismatic_referrals(user_id)`;
      results.push('prismatic_referrals ✓');
    } catch (e: any) {
      results.push(`prismatic_referrals: ${e.message}`);
    }

    // ── Withdrawals table ─────────────────────────────────────────────────────
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS public.prismatic_withdrawals (
          id              BIGSERIAL PRIMARY KEY,
          affiliate_id   BIGINT REFERENCES public.prismatic_affiliates(id),
          amount          DECIMAL(10,2) NOT NULL,
          status          VARCHAR(20) DEFAULT 'pending',
          method          VARCHAR(20) DEFAULT 'wechat',
          payment_info    TEXT,
          processed_by    VARCHAR(255),
          processed_at    TIMESTAMPTZ,
          note            TEXT,
          created_at      TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate ON public.prismatic_withdrawals(affiliate_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.prismatic_withdrawals(status)`;
      results.push('prismatic_withdrawals ✓');
    } catch (e: any) {
      results.push(`prismatic_withdrawals: ${e.message}`);
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[migrate/affiliates]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
