/**
 * Debug endpoint - TEMPORARY: check which database is being used
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

export async function GET(req: NextRequest) {
  if (!DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not set' });
  }
  
  // Extract database name from connection string
  const dbName = DATABASE_URL.split('/').pop()?.split('?')[0] || 'unknown';
  const host = DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown';
  
  // Query the user to compare with known values
  const token = req.cookies.get('prismatic_token')?.value;
  
  try {
    const sql = neon(DATABASE_URL);
    
    // Get all users to compare
    const rows = await sql`SELECT id, email, "dailyCredits", credits FROM users WHERE email LIKE '%3740977%' LIMIT 1`;
    
    return NextResponse.json({
      database: {
        host,
        dbName,
        url: DATABASE_URL.replace(/:[^:@]+@/, ':***@'), // Mask password
      },
      user3740977: rows[0] || null,
      hasToken: !!token
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
