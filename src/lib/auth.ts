/**
 * Prismatic — NextAuth.js Authentication Configuration
 * Supports GitHub OAuth, Google OAuth, and Email/Credential authentication
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
  }
}

const handler = NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    }),
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID ?? '',
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
    }),
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

        // Demo implementation - replace with actual database lookup
        // In production, verify against your user database with hashed passwords
        const demoUsers = [
          {
            id: 'demo-user-1',
            email: 'demo@prismatic.app',
            name: 'Demo User',
            password: 'demo123',
          },
        ];

        const user = demoUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
          };
        }

        return null;
      },
    }),
  ],

  // Use Prisma adapter for database persistence (optional)
  // Uncomment when using with a database
  // adapter: PrismaAdapter(prisma) as Adapter,

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        return url;
      }
      return baseUrl + '/app';
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

  secret: process.env.AUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
});

export const { handlers, auth, signIn, signOut } = handler;

export const authOptions = handler;
