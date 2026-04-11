/**
 * Prismatic — Register API (No-Auth Mode Stub)
 * POST /api/auth/register
 * In no-auth mode, registration is not available — everyone is a guest.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: false,
    error: '当前为免注册模式，无需账号即可使用。请直接访问首页开始探索。',
  }, { status: 400 });
}
