/**
 * Prismatic — Send Verification Code API (No-Auth Mode Stub)
 * POST /api/auth/send-code
 * In no-auth mode, this returns a dev code for testing purposes.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { type, target } = body;

  if (!target) {
    return NextResponse.json({ error: '目标地址不能为空' }, { status: 400 });
  }

  if (process.env.NODE_ENV === 'development') {
    // In dev, return a fixed code
    return NextResponse.json({
      success: true,
      message: '验证码已发送（开发模式）',
      devCode: '123456',
    });
  }

  return NextResponse.json({
    success: true,
    message: '验证码功能需要启用数据库认证模式',
  });
}
