/**
 * Prismatic — Authentication Configuration
 *
 * Supports: GitHub OAuth + Demo / Experience accounts
 * Uses JWT strategy (no database required for demo accounts)
 * GitHub OAuth requires DATABASE_URL in production.
 */

import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';

// ─── Demo / Experience Accounts ───────────────────────────────────────────────
// Credentials are loaded from environment variables for production safety.
// Format: DEMO_ACCOUNTS = "email1:pass1,email2:pass2,..."
// If not set, demo accounts are disabled entirely.

export interface DemoAccount {
  email: string;
  password: string;
}

function parseDemoAccounts(): DemoAccount[] {
  const raw = process.env.DEMO_ACCOUNTS;
  if (!raw) return [];
  return raw.split(',').map(entry => {
    const [email, password] = entry.split(':');
    if (!email || !password) {
      console.warn('[auth] Invalid DEMO_ACCOUNTS entry:', entry);
      return null;
    }
    return { email: email.trim(), password: password.trim() };
  }).filter((a): a is DemoAccount => a !== null);
}

export const DEMO_ACCOUNTS: DemoAccount[] = parseDemoAccounts();

// ─── Auth Options ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  // JWT strategy — no database required for demo accounts
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  providers: [
    // ── GitHub OAuth ─────────────────────────────────────────────────────────
    GithubProvider({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
      authorization: { params: { scope: 'read:user user:email' } },
    }),

    // ── Demo / Experience Accounts ────────────────────────────────────────────
    CredentialsProvider({
      id: 'demo-account',
      name: '体验账号',
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const demo = DEMO_ACCOUNTS.find(
          d => d.email === credentials.email && d.password === credentials.password
        );

        if (!demo) return null;

        // Return a guest-like user object (no DB lookup needed)
        return {
          id: `demo_${Buffer.from(demo.email).toString('base64').slice(0, 8)}`,
          name: demo.email.split('@')[0].replace('demo', '演示账号 '),
          email: demo.email,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },

    async signIn({ user }) {
      // Allow any successful authentication
      return true;
    },
  },

  secret: process.env.AUTH_SECRET ?? (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: AUTH_SECRET environment variable is not set in production. ' +
        'Set AUTH_SECRET in your Vercel environment variables.');
    }
    return 'prismatic-dev-secret-2024';
  })(),
  debug: process.env.NODE_ENV === 'development',
};
