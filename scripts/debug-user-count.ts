/**
 * Debug: Compare Prisma vs neon() user counts
 */
import { neon } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});
const sql = neon(DATABASE_URL);

async function main() {
  // neon() query
  const neonRows = await sql`SELECT COUNT(*) as cnt FROM users WHERE status != 'DELETED'`;
  console.log('neon() totalUsers (status!=DELETED):', neonRows[0]?.cnt);

  const neonAll = await sql`SELECT COUNT(*) as cnt FROM users`;
  console.log('neon() total (all):', neonAll[0]?.cnt);

  // Prisma query
  const prismaCount = await prisma.user.count({ where: { status: { not: 'DELETED' } } });
  console.log('Prisma totalUsers (status!=DELETED):', prismaCount);

  const prismaAll = await prisma.user.count();
  console.log('Prisma total (all):', prismaAll);

  // Check DATABASE_URL
  console.log('\nDATABASE_URL:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  // Check both show same database name
  const dbName = DATABASE_URL.match(/\/([^?]+)/)?.[1];
  console.log('Database name:', dbName);

  await prisma.$disconnect();
}

main().catch(console.error);
