/**
 * POST /api/auth/register
 * Register a new user with email + password
 * Supports skipping verification code when email provider is not configured
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUser, createJWTToken } from '@/lib/user-management';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(4, '密码至少4位').max(100, '密码最多100位'),
  name: z.string().min(1, '请输入昵称').max(50, '昵称最多50字').optional().default(''),
  gender: z.enum(['male', 'female']).optional(),
  province: z.string().max(50).optional(),
  code: z.string().length(6, '验证码为6位数字').optional(),
});

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    const { email, password, name, gender, province, code } = parsed.data;

    if (code) {
      const { verifyCode } = await import('@/lib/user-management');
      const codeValid = await verifyCode(email, code, 'register');
      if (!codeValid) {
        return NextResponse.json(
          { error: '验证码错误或已过期，请重新获取' },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    const existing = await createUser({ email, password, name, gender, province, emailVerified: true });
    if (!existing) {
      return NextResponse.json(
        { error: '该邮箱已注册，请直接登录' },
        { status: 409, headers: NO_CACHE_HEADERS }
      );
    }

    const token = createJWTToken(existing.id, existing.email);

    const response = NextResponse.json(
      {
        user: {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          gender: existing.gender,
          province: existing.province,
          role: existing.role,
          plan: existing.plan,
        },
        message: '注册成功',
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );

    response.cookies.set('prismatic_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }
    console.error('Register error:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
