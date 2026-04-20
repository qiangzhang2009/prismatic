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
 * The firewall is only active in production (Vercel, vercel=1).
 * In development, it logs warnings but does NOT block operations.
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const client = new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

  if (isProduction) {
    const { createDatabaseFirewall } = require('./database-firewall');
    const firewall = createDatabaseFirewall();
    client.$use(firewall as any);
  }

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
