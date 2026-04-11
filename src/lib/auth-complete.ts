/**
 * Prismatic — Auth Complete (No-Auth Mode Stub)
 *
 * In no-auth mode, all users are guests — no database required.
 * The actual full auth implementation (with database, OAuth, SMS, etc.) is preserved
 * in this file for when you want to re-enable authentication.
 *
 * To re-enable: set USE_AUTH=true in env, configure DATABASE_URL and auth providers.
 */

import type { NextAuthOptions } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
  }
}

// ─── Full Auth Implementation (preserved for future use) ──────────────────────────
// The complete auth configuration with database, OAuth, and SMS support is
// documented here. To enable, move this to auth.ts and:
// 1. Set USE_AUTH=true in environment
// 2. Configure DATABASE_URL (PostgreSQL)
// 3. Configure email/SMS providers
// 4. Run: npx prisma db push
//
// Full providers would include:
// - Email Magic Link (via Resend/SendGrid/SMTP)
// - Email + Password Registration
// - Phone + OTP (via Aliyun SMS or Twilio)
// - WeChat OAuth (via src/lib/providers/wechat.ts)
// - GitHub OAuth
// - Google OAuth
// - Guest mode with localStorage persistence
//
// See: src/lib/auth-complete.ts.bak for the full implementation.

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: 'guest',
      name: '访客模式',
      type: 'credentials' as const,
      credentials: {
        name: { label: '名字', type: 'text' },
      },
      async authorize(credentials) {
        return {
          id: `guest_${Date.now()}`,
          name: credentials?.name ?? '访客',
          email: null,
        };
      },
    },
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },

  secret: process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024',
  debug: process.env.NODE_ENV === 'development',
};
