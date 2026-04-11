/**
 * Prismatic — NextAuth Middleware
 * Protects routes that require authentication
 */

import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    '/app/:path*',
    '/settings/:path*',
    '/api/user/:path*',
  ],
};
