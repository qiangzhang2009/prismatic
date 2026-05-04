/**
 * Prismatic — Shared Neon Database Pool
 *
 * Provides a globally-reused connection pool to avoid the connection leak
 * that occurred when `new Pool()` was called inside `persistConversation`
 * and other hot paths (every request created new pool connections).
 *
 * Neon serverless supports connection pooling out-of-the-box via the proxy,
 * so a single long-lived pool is safe and recommended.
 *
 * Usage:
 *   import { getPool } from '@/lib/db-pool';
 *   const pool = getPool();
 */

import { Pool } from '@neondatabase/serverless';

const globalForPool = globalThis as unknown as {
  __prismaticPool: Pool | undefined;
};

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return new Pool({ connectionString, max: 10 });
}

export function getPool(): Pool {
  if (!globalForPool.__prismaticPool) {
    globalForPool.__prismaticPool = createPool();
  }
  return globalForPool.__prismaticPool;
}

export async function closePool(): Promise<void> {
  if (globalForPool.__prismaticPool) {
    await globalForPool.__prismaticPool.end();
    globalForPool.__prismaticPool = undefined;
  }
}

// Graceful shutdown helper — call from process.on('SIGTERM', ...)
export async function gracefulShutdown(): Promise<void> {
  console.log('[db-pool] Shutting down pool...');
  await closePool();
  console.log('[db-pool] Pool closed.');
}
