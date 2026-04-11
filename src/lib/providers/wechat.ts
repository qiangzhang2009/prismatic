/**
 * Prismatic — WeChat OAuth Provider
 *
 * Flow:
 * 1. User clicks "Login with WeChat"
 * 2. Redirect to WeChat OAuth authorization page
 * 3. WeChat redirects back with ?code=xxx
 * 4. Exchange code for access_token + openid
 * 5. Get user info (unionid, nickname, headimgurl)
 * 6. Create or link user account
 *
 * Required env vars:
 *   WECHAT_APP_ID      — from WeChat Open Platform
 *   WECHAT_APP_SECRET  — from WeChat Open Platform
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WeChatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  unionid?: string;
  scope: string;
  errcode?: number;
  errmsg?: string;
}

interface WeChatUserInfo {
  openid: string;
  unionid?: string;
  nickname: string;
  sex: number; // 1=男, 2=女, 0=未知
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  errcode?: number;
  errmsg?: string;
}

// ─── OAuth Authorization URL ─────────────────────────────────────────────────

/**
 * Generate WeChat OAuth authorization URL
 * Docs: https://developers.weixin.qq.com/doc/oplatform/Website_Apps/WeChat_web_login_Interface/Introduction.html
 */
export function getWeChatAuthUrl(state: string): string {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXTAUTH_URL}/api/auth/wechat/callback`
  );
  const scope = 'snsapi_login'; // 请求用户信息 scope
  // 如果只需要 openid，可以用 snsapi_base（无需用户确认）

  return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
}

/**
 * Alternative: Generate WeChat OAuth URL for mobile (扫码登录)
 * This uses the same flow but better UX on mobile
 */
export function getWeChatMobileAuthUrl(state: string): string {
  const appId = process.env.WECHAT_APP_ID;
  const redirectUri = encodeURIComponent(
    `${process.env.NEXTAUTH_URL}/api/auth/wechat/callback`
  );
  const scope = 'snsapi_login';

  return `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}#wechat_redirect`;
}

// ─── Token Exchange ─────────────────────────────────────────────────────────────

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code: string): Promise<WeChatTokenResponse> {
  const appId = process.env.WECHAT_APP_ID;
  const appSecret = process.env.WECHAT_APP_SECRET;

  const url = 'https://api.weixin.qq.com/sns/oauth2/access_token';

  const params = new URLSearchParams({
    appid: appId ?? '',
    secret: appSecret ?? '',
    code,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
  });

  const data = await response.json();

  if (data.errcode) {
    throw new WeChatError(data.errcode, data.errmsg ?? 'Unknown error');
  }

  return data as WeChatTokenResponse;
}

// ─── Get User Info ─────────────────────────────────────────────────────────────

/**
 * Get WeChat user info using access token and openid
 */
async function getWeChatUserInfo(
  accessToken: string,
  openid: string
): Promise<WeChatUserInfo> {
  const url = 'https://api.weixin.qq.com/sns/userinfo';

  const params = new URLSearchParams({
    access_token: accessToken,
    openid,
    lang: 'zh_CN',
  });

  const response = await fetch(`${url}?${params.toString()}`, {
    method: 'GET',
  });

  const data = await response.json();

  if (data.errcode) {
    throw new WeChatError(data.errcode, data.errmsg ?? 'Unknown error');
  }

  return data as WeChatUserInfo;
}

// ─── Custom Error ─────────────────────────────────────────────────────────────

export class WeChatError extends Error {
  constructor(
    public code: number,
    message: string
  ) {
    super(message);
    this.name = 'WeChatError';
  }

  get isInvalidCode(): boolean {
    return this.code === 40029; // invalid code
  }

  get isExpiredCode(): boolean {
    return this.code === 40163; // code used
  }

  get isRateLimited(): boolean {
    return this.code === 40029 || this.code === 40226;
  }
}

// ─── Auth Handler ───────────────────────────────────────────────────────────────

/**
 * Handle WeChat OAuth callback
 * Returns the user record (created or updated)
 */
export async function handleWeChatCallback(
  code: string
): Promise<{ user: any; isNewUser: boolean }> {
  // 1. Exchange code for access token
  const tokenData = await exchangeCodeForToken(code);

  // 2. Get user info
  const wechatUser = await getWeChatUserInfo(
    tokenData.access_token,
    tokenData.openid
  );

  // 3. Find existing user by WeChat openid or unionid
  const existingByOpenid = await prisma.user.findUnique({
    where: { wechatOpenid: wechatUser.openid },
  });

  if (existingByOpenid) {
    // Update WeChat info if changed
    await prisma.user.update({
      where: { id: existingByOpenid.id },
      data: {
        wechatNickname: wechatUser.nickname,
        wechatAvatar: wechatUser.headimgurl,
        wechatUnionid: tokenData.unionid ?? undefined,
      },
    });

    // Update or create account link
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'WECHAT',
          providerAccountId: wechatUser.openid,
        },
      },
      create: {
        userId: existingByOpenid.id,
        provider: 'WECHAT',
        providerAccountId: wechatUser.openid,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        scope: tokenData.scope,
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    return { user: existingByOpenid, isNewUser: false };
  }

  // 4. If unionid is available, check if user already exists by unionid
  // (same WeChat user in different apps can share unionid)
  let existingByUnionid = null;
  if (tokenData.unionid) {
    existingByUnionid = await prisma.user.findUnique({
      where: { wechatUnionid: tokenData.unionid },
    });
  }

  let user;
  if (existingByUnionid) {
    // Link WeChat to existing user
    user = await prisma.user.update({
      where: { id: existingByUnionid.id },
      data: {
        wechatOpenid: wechatUser.openid,
        wechatNickname: wechatUser.nickname,
        wechatAvatar: wechatUser.headimgurl,
        wechatUnionid: tokenData.unionid ?? undefined,
      },
    });
  } else {
    // Create new user
    user = await prisma.user.create({
      data: {
        name: wechatUser.nickname,
        avatar: wechatUser.headimgurl,
        wechatOpenid: wechatUser.openid,
        wechatUnionid: tokenData.unionid ?? undefined,
        wechatNickname: wechatUser.nickname,
        wechatAvatar: wechatUser.headimgurl,
        emailVerified: new Date(), // Verified through WeChat
      },
    });
  }

  // 5. Create account link
  await prisma.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: 'WECHAT',
        providerAccountId: wechatUser.openid,
      },
    },
    create: {
      userId: user.id,
      provider: 'WECHAT',
      providerAccountId: wechatUser.openid,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      scope: tokenData.scope,
    },
    update: {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    },
  });

  return { user, isNewUser: true };
}

// ─── NextAuth Provider Config ────────────────────────────────────────────────

/**
 * NextAuth-compatible WeChat provider
 * Add this to the providers array in auth-complete.ts
 */
export function createWeChatProvider() {
  return {
    id: 'wechat',
    name: '微信',
    type: 'oauth' as const,
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: {
        appid: process.env.WECHAT_APP_ID,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/wechat/callback`,
        scope: 'snsapi_login',
        response_type: 'code',
        state: 'wechat',
      },
    },
    token: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    userinfo: 'https://api.weixin.qq.com/sns/userinfo',
    profile(profile: any) {
      return {
        id: profile.openid,
        name: profile.nickname,
        email: null,
        image: profile.headimgurl,
      };
    },
    clientId: process.env.WECHAT_APP_ID,
    clientSecret: process.env.WECHAT_APP_SECRET,
  };
}
