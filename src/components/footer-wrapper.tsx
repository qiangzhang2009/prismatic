'use client';

/**
 * Footer wrapper for client components
 * Server components can't import client components, but we can create a wrapper
 */
import { Footer } from '@/components/footer';

export function FooterWrapper() {
  return <Footer />;
}
