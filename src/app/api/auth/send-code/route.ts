/**
 * POST /api/auth/send-code
 * Send email verification code for registration
 */
import { NextRequest, NextResponse } from 'next/server';
import { createVerificationCode } from '@/lib/user-management';
import { sendEmailCode } from '@/lib/email';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  type: z.enum(['register']).default('register'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, type } = schema.parse(body);

    // Generate 6-digit code
    const code = await createVerificationCode(email, 'register');

    // Send email
    const result = await sendEmailCode(email, code, 'register');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    console.error('Send code error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
