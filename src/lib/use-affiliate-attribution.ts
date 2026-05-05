'use client';

/**
 * useAffiliateAttribution
 * Reads the prismatic_ref cookie and records attribution when user is logged in.
 * Call this in auth callbacks and registration flows.
 */

import { useEffect } from 'react';
import { useAuthStore } from './auth-store';

export function useAffiliateAttribution() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const refCode = document.cookie
      .split('; ')
      .find(row => row.startsWith('prismatic_ref='))
      ?.split('=')[1];

    if (!refCode) return;

    // Record attribution (idempotent — does nothing if already recorded)
    fetch('/api/affiliates/attribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        referral_code: refCode,
        user_id: user.id,
        landing_page: window.location.href,
        referrer: document.referrer,
        user_agent: navigator.userAgent,
      }),
    }).catch(() => {});
  }, [user]);
}
