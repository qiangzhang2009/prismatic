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
    const guardians = await withTimeout(getTodayGuardians(), 8000);
    if (guardians === null) {
      // Return empty array on timeout instead of error
      return NextResponse.json({ guardians: [], note: 'Guardian data temporarily unavailable' });
    }
    return NextResponse.json({ guardians });
  } catch (error) {
    console.error('[Guardian API] Error:', error);
    return NextResponse.json({ guardians: [], note: 'Guardian data temporarily unavailable' });
  }
}
