/**
 * POST /api/auth/logout
 * Logout and delete session
 */
import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/user-management';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  
  if (token) {
    await deleteSession(token);
  }
  
  const res = NextResponse.json({ message: 'Logged out successfully' });
  res.cookies.set('prismatic_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  
  return res;
}
