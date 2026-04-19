/**
 * DEBUG: Check user in both tables
 * GET /api/debug/user-lookup?email=xxx&key=xxx
 */
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = neon(DATABASE_URL);
const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email') || '';
  const adminKey = searchParams.get('key') || '';

  if (adminKey !== 'debug-admin-key-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!email) {
    return NextResponse.json({ error: 'email param required' }, { status: 400 });
  }

  const normalized = email.toLowerCase();

  // Check users table (neon SQL - lowercase table name)
  let usersRows: any[] = [];
  let usersError = null;
  try {
    usersRows = await sql`
      SELECT id, email, "passwordHash", status, role, plan, name, "createdAt", "updatedAt"
      FROM users
      WHERE email = ${normalized}
      LIMIT 1
    `;
  } catch (e) {
    usersError = String(e);
  }

  // Check User table (Prisma - case-sensitive)
  let prismaRow = null;
  let prismaError = null;
  try {
    prismaRow = await prisma.user.findFirst({
      where: { email: normalized },
      select: { id: true, email: true, status: true, role: true, plan: true, name: true },
    });
  } catch (e) {
    prismaError = String(e);
  }

  // Try to INSERT a test user
  let insertResult = null;
  let insertError = null;
  try {
    const testId = crypto.randomUUID();
    await sql`
      INSERT INTO users (id, email, "passwordHash", status, role, plan, credits, "createdAt", "updatedAt")
      VALUES (${testId}, ${normalized}, 'test_hash_should_not_exist', 'ACTIVE'::user_status, 'FREE'::user_role, 'FREE'::subscription_plan, 0, NOW(), NOW())
    `;
    // Rollback by deleting
    await sql`DELETE FROM users WHERE id = ${testId}`;
    insertResult = 'INSERT succeeded, rolled back';
  } catch (e) {
    insertError = String(e);
  }

  return NextResponse.json({
    email: normalized,
    users_table: usersError ? { error: usersError } : (usersRows.length > 0 ? {
      id: usersRows[0].id,
      email: usersRows[0].email,
      status: String(usersRows[0].status),
      hasPasswordHash: !!usersRows[0].passwordHash,
    } : null),
    User_table_prisma: prismaError ? { error: prismaError } : prismaRow,
    insert_test: { result: insertResult, error: insertError },
  }, { status: 200 });
}
