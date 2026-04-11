/**
 * Prismatic — NextAuth v4 API Route
 * GET and POST handlers for NextAuth
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
