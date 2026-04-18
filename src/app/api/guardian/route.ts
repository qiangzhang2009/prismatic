/**
 * GET /api/guardian — Today's guardians (public)
 */
import { NextResponse } from 'next/server';
import { getTodayGuardians } from '@/lib/guardian';

// Add timeout wrapper for database operations
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([promise, timeout]);
}

export async function GET() {
  try {
    // Allow up to 30s for cold-start serverless environments with Neon connections
    const guardians = await withTimeout(getTodayGuardians(), 30_000);
    if (guardians === null) {
      return NextResponse.json({ guardians: [], note: 'Guardian data temporarily unavailable' });
    }
    return NextResponse.json({ guardians });
  } catch (error) {
    console.error('[Guardian API] Error:', error);
    return NextResponse.json({ guardians: [], note: 'Guardian data temporarily unavailable' });
  }
}
