/**
 * Debug endpoint to check user credits in production
 * Only accessible in development or when CRON_SECRET is provided
 */

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

export async function GET(req: NextRequest) {
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  // In production, require authorization
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const sql = neon(DATABASE_URL);
    
    // Check the specific user
    const users = await sql`
      SELECT id, email, credits, "dailyCredits", "lastDailyResetAt"
      FROM users 
      WHERE email = '3740977@qq.com'
    `;

    // Check all users for comparison
    const allUsers = await sql`
      SELECT id, email, credits, "dailyCredits", "lastDailyResetAt"
      FROM users 
      ORDER BY "lastDailyResetAt" DESC
      LIMIT 10
    `;

    // Get connection info
    const dbInfo = await sql`SELECT current_database() as db_name`;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      database: dbInfo[0],
      targetUser: users[0] || null,
      allUsers: allUsers,
    });
  } catch (error) {
    const err = error instanceof Error ? error.message : String(error);
    console.error('[debug/user-credits]', err);
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
