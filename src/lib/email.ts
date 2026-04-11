/**
 * Prismatic — Email Utility
 * Handles sending verification emails and OTP codes
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// In production, configure one of:
// 1. Resend (recommended): process.env.RESEND_API_KEY
// 2. SendGrid: process.env.SENDGRID_API_KEY
// 3. AWS SES: process.env.AWS_SES_*

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = params;

  // ── Option 1: Resend (Recommended — simple, cheap, great DX) ──────────────
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? 'Prismatic <noreply@prismatic.app>',
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, ''),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // ── Option 2: SendGrid ──────────────���─────────────────────────────────────
  if (process.env.SENDGRID_API_KEY) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.EMAIL_FROM ?? 'noreply@prismatic.app', name: 'Prismatic' },
        subject,
        content: [
          { type: 'text/plain', value: text ?? html.replace(/<[^>]*>/g, '') },
          { type: 'text/html', value: html },
        ],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return { success: false, error: body };
    }
    return { success: true };
  }

  // ── Option 3: SMTP (nodemailer-compatible) ───────────────────────────────
  if (process.env.EMAIL_SERVER_HOST) {
    const { createTransport } = await import('nodemailer');
    const transporter = createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
      secure: Number(process.env.EMAIL_SERVER_PORT ?? 587) === 465,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'Prismatic <noreply@prismatic.app>',
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, ''),
    });
    return { success: true };
  }

  // ── Dev fallback: log to console ────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 [DEV EMAIL]', { to, subject });
    console.log(html);
    return { success: true };
  }

  return { success: false, error: 'No email provider configured' };
}

/**
 * Send verification code email for registration/login
 */
export async function sendEmailCode(email: string, code: string, type: 'register' | 'login'): Promise<{ success: boolean; error?: string }> {
  const subject = type === 'register' ? '注册 Prismatic — 验证码' : '登录 Prismatic — 验证码';
  const title = type === 'register' ? '注册账号' : '登录账号';

  return await sendEmail({
    to: email,
    subject,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fafafa;">
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">
          <h1 style="color: #1a1a2e; font-size: 22px; margin: 0 0 8px; font-weight: 700;">
            <span style="background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Prismatic
            </span>
          </h1>
          <h2 style="color: #1a1a2e; font-size: 20px; margin: 0 0 24px;">${title}</h2>
          <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
            你的验证码是：
          </p>
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-size: 32px; font-weight: 700;
               text-align: center; padding: 20px 32px; border-radius: 12px; letter-spacing: 8px; margin-bottom: 24px;
               font-family: 'SF Mono', 'Fira Code', monospace;">
            ${code}
          </div>
          <p style="color: #9ca3af; font-size: 13px; margin: 0;">
            验证码 <strong>10分钟内</strong> 有效，请勿告诉他人。
          </p>
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #f0f0f0;">
            <p style="color: #d1d5db; font-size: 12px; text-align: center; margin: 0;">
              如果不是你本人的操作，请忽略此邮件。<br/>
              © 2024 Prismatic · 折射之光
            </p>
          </div>
        </div>
      </div>
    `,
  });
}

/**
 * Send SMS verification code
 * Requires: 阿里云短信 or Twilio or Vonage
 */
export async function sendPhoneCode(
  phone: string,
  code: string,
  type: 'register' | 'login'
): Promise<{ success: boolean; error?: string }> {

  // ── Option 1: 阿里云短信 ────────────────────────────────────────────────
  if (process.env.ALIYUN_ACCESS_KEY_ID) {
    const { default: Dysmsapi } = await import('@alicloud/dysmsapi20170525');
    const client = new Dysmsapi({
      endpoint: 'dysmsapi.aliyuncs.com',
      accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET!,
    } as any);
    const result = await (client as any).sendSms({
      phoneNumbers: phone.replace('+86', ''),
      signName: process.env.ALIYUN_SMS_SIGN_NAME!,
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE!,
      templateParam: JSON.stringify({ code }),
    });
    if (result.body?.code !== 'OK') {
      return { success: false, error: result.body?.message ?? 'SMS send failed' };
    }
    return { success: true };
  }

  // ── Option 2: Twilio ────────────────────────────────────────────────────
  if (process.env.TWILIO_ACCOUNT_SID) {
    const { default: twilio } = await import('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `【Prismatic】你的验证码是${code}，${type === 'register' ? '注册' : '登录'}验证码，10分钟内有效。`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    });
    return { success: true };
  }

  // ── Dev fallback ─────────────────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    console.log(`📱 [DEV SMS] To: ${phone}, Code: ${code}, Type: ${type}`);
    return { success: true };
  }

  return { success: false, error: 'No SMS provider configured. Set ALIYUN_* or TWILIO_* env vars.' };
}
