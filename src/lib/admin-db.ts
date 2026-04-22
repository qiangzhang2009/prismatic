/**
 * Shared database pool helper for admin API routes.
 * Uses @neondatabase/serverless Pool to bypass Prisma engine incompatibility.
 */

import { Pool } from '@neondatabase/serverless';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set');
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
