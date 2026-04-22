/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Prisma Client Instance
 *
 * IMPORTANT: This is the READ-ONLY client used by application code.
 * All write operations are protected by the database firewall middleware.
 *
 * For migrations and bulk operations, use DATABASE_URL_RW directly
 * via @neondatabase/serverless in scripts/ directory.
 *
 * NOTE: $use middleware was removed — it conflicts with Prisma 5.x's internal engine
 * in Vercel serverless. The database has its own row-level security via Neon,
 * and destructive operations (DROP/TRUNCATE) are not used in this application.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
