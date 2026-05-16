/**
 * GET /api/admin/debug-users — Debug user count discrepancy between Prisma and neon()
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const dbUrl = process.env.DATABASE_URL || '';
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');

  let neonResult: any = { error: 'not run' };
  let prismaResult: any = { error: 'not run' };

  // Test 1: neon() direct
  try {
    const sql = neon(dbUrl);
    const rows = await sql`SELECT id, status FROM users LIMIT 5`;
    const countRows = await sql`SELECT COUNT(*) as cnt FROM users WHERE status != 'DELETED'`;
    const countAll = await sql`SELECT COUNT(*) as cnt FROM users`;
    neonResult = {
      total: Number(countAll[0]?.cnt),
      nonDeleted: Number(countRows[0]?.cnt),
      sampleStatuses: rows.map((r: any) => ({ id: r.id, status: r.status })),
    };
  } catch (e: any) {
    neonResult = { error: e.message };
  }

  // Test 2: Prisma
  try {
    const total = await prisma.user.count();
    const nonDeleted = await prisma.user.count({ where: { status: { not: 'DELETED' } } });
    const sample = await prisma.user.findMany({ take: 5, select: { id: true, status: true } });
    prismaResult = {
      total,
      nonDeleted,
      sampleStatuses: sample.map(u => ({ id: u.id, status: u.status })),
    };
  } catch (e: any) {
    prismaResult = { error: e.message };
  }

  return NextResponse.json({
    maskedDbUrl: maskedUrl,
    dbHostname: dbUrl.match(/@([^/]+)/)?.[1] || 'unknown',
    neon: neonResult,
    prisma: prismaResult,
  });
}
