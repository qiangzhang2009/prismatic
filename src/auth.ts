/**
 * Prismatic — No-Auth Mode
 * All users are guests by default — no sign-up required.
 * Data is stored in localStorage.
 */

import type { NextAuthOptions } from 'next-auth';

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string;
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
