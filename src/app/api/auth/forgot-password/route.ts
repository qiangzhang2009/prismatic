/**
 * POST /api/auth/forgot-password
 * Generate a verification code and send it to user's email
 * For now, we just log the code and return it (email sending can be added via Resend/SendGrid)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createVerificationCode, getUserByEmail } from '@/lib/user-management';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    // Check if user exists
    const user = await getUserByEmail(email);
    if (!user) {
      // Don't reveal whether email exists or not for security
      return NextResponse.json({
        message: '如果该邮箱已注册，验证码已发送至您的邮箱',
      });
    }

    // Generate a 6-digit verification code
    const code = await createVerificationCode(email, 'reset');

    // In production, send email via Resend/SendGrid.
    // For now, we log the code so the admin can help users manually.
    console.log(`[FORGOT-PASSWORD] Code for ${email}: ${code}`);

    return NextResponse.json({
      message: '验证码已发送到您的邮箱',
      // Remove this in production — keeping for development only
      devCode: code,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
