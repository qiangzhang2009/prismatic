/**
 * POST /api/auth/register
 * Register a new user with email + password + verification code
 * Fields: nickname, gender, province, email, password, verification code
 */
import { NextRequest, NextResponse } from 'next/server';
import { createUser, createSession, verifyCode } from '@/lib/user-management';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码').max(100, '密码最多100位'),
  name: z.string().min(1, '请输入昵称').max(50, '昵称最多50字').optional().default(''),
  gender: z.enum(['male', 'female']).optional(),
  province: z.string().max(50).optional(),
  code: z.string().length(6, '验证码为6位数字'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name, gender, province, code } = registerSchema.parse(body);

    // Verify email code
    const codeValid = await verifyCode(email, code, 'register');
    if (!codeValid) {
      return NextResponse.json(
        { error: '验证码错误或已过期，请重新获取' },
        { status: 400 }
      );
    }

    // Check email not already registered
    const existing = await createUser({ email, password, name, gender, province, emailVerified: true });
    if (!existing) {
      return NextResponse.json(
        { error: '该邮箱已注册，请直接登录' },
        { status: 409 }
      );
    }

    const token = await createSession(existing.id);

    const res = NextResponse.json({
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
    });

    res.cookies.set('prismatic_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return res;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Register error:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
