/**
 * Prismatic — NextAuth.js v4 Authentication Configuration
 * Supports GitHub OAuth, Google OAuth, and demo Credentials authentication
 */

import type { NextAuthOptions, Session } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

declare module 'next-auth' {
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

export const authOptions: NextAuthOptions = {
  providers: [
    // GitHub OAuth — configure AUTH_GITHUB_ID and AUTH_GITHUB_SECRET in env
    GithubProvider({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    }),
    // Google OAuth — configure AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET in env
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
    // Demo credentials — replace with real database auth in production
    CredentialsProvider({
      name: '邮箱登录',
      credentials: {
        email: { label: '邮箱', type: 'email', placeholder: 'your@email.com' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Demo users — replace with database lookup in production
        const demoUsers = [
          { id: 'demo-user-1', email: 'demo@prismatic.app', name: 'Demo User', password: 'demo123' },
        ];

        const user = demoUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          return { id: user.id, email: user.email, name: user.name };
        }

        return null;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Secret is required — Vercel env var AUTH_SECRET
  secret: process.env.AUTH_SECRET ?? 'dev-secret-change-in-production-prismatic-2024',

  debug: process.env.NODE_ENV === 'development',
};
