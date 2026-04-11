/**
 * Prismatic — WeChat OAuth Callback (Stub)
 * WeChat OAuth is disabled in no-auth mode.
 * If configured later, set USE_AUTH=true and configure DATABASE_URL.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL('/auth/signin?error=wechat_disabled', request.url)
  );
}
