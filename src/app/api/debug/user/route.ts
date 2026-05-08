/**
 * Debug endpoint to check user data directly from database
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';

function verifyToken(token: string): { userId: string; email?: string } | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as { userId: string; email?: string; iat?: number; exp?: number };
    return payload.userId ? { userId: payload.userId, email: payload.email } : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'No token' });

  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Invalid token' });

  const { userId } = payload;

  if (!DATABASE_URL) return NextResponse.json({ error: 'No DB' });

  const sql = neon(DATABASE_URL);
  try {
    const rows = await sql`SELECT id, email, "dailyCredits", credits FROM users WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return NextResponse.json({ error: 'User not found' });

    const u: any = rows[0];
    console.log(`[/api/debug/user] Query result: dailyCredits=${u.dailyCredits}, credits=${u.credits}`);
    
    return NextResponse.json({
      userId,
      fromQuery: {
        dailyCredits: u.dailyCredits,
        credits: u.credits,
      },
      email: u.email
    });
  } catch (error) {
    console.error('[/api/debug/user] error:', error);
    return NextResponse.json({ error: String(error) });
  }
}
