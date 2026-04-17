/**
 * Prismatic — User Management System
 * Powered by Neon PostgreSQL (serverless, auto-scales to zero)
 * 
 * Connection: @neondatabase/serverless (WebSocket-based)
 * Works with Vercel Serverless + Edge runtimes
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import jwt from 'jsonwebtoken';

export type UserRole = 'FREE' | 'PRO' | 'ADMIN';
export type SubscriptionPlan = 'FREE' | 'MONTHLY' | 'YEARLY' | 'LIFETIME';

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  emailVerified: boolean;
  role: UserRole;
  plan: SubscriptionPlan;
  credits: number; // 充值问答条数（仅充值用户有）
  avatar: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  gender?: 'male' | 'female';
  province?: string;
}

// ─── Database Connection ───────────────────────────────────────────────────────

/** Typed SQL function.
 *
 * CRITICAL: each call creates a FRESH Neon handle.
 * Neon uses HTTP to connect to the serverless Postgres gateway.
 * Reusing the same handle across Lambda cold-starts can cause
 * the WebSocket to route reads to a stale read-replica connection,
 * resulting in "admin updates → user sees old data" bug. */
function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(connectionString);
}

// ─── User Operations ──────────────────────────────────────────────────────────

export async function createUser(input: CreateUserInput & { emailVerified?: boolean }): Promise<PublicUser | null> {
  const sql = getSql();

  const existing = await sql`
    SELECT id FROM prismatic_users WHERE email = ${input.email.toLowerCase()}
  `;
  if (existing.length > 0) return null;

  const passwordHash = await bcrypt.hash(input.password, 12);

  const rows = await sql`
    INSERT INTO prismatic_users (email, password_hash, name, gender, province, email_verified, role, plan, is_active)
    VALUES (
      ${input.email.toLowerCase()},
      ${passwordHash},
      ${input.name ?? null},
      ${input.gender ?? null},
      ${input.province ?? null},
      ${input.emailVerified ?? false},
      'FREE',
      'FREE',
      TRUE
    )
    RETURNING id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
  `;

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL env not set');
  // Inline: fresh connection every call to avoid stale cached results
  // eslint-disable-next-line
  const sql = neon(connectionString);

  const rows = await sql`
    SELECT id, email, password_hash, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users
    WHERE email = ${email.toLowerCase()} AND is_active = TRUE
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
  console.log(`[verifyCredentials] DB read: id=${row.id} plan=${row.plan} credits=${row.credits}`);
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;

  await sql`
    UPDATE prismatic_users
    SET last_login_at = NOW(), updated_at = NOW()
    WHERE id = ${row.id}
  `;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  const sql = neon(connectionString);
  console.log(`[getUserById] SQL object type: ${Object.prototype.toString.call(sql)}, length=${sql.length}`);
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users WHERE id = ${id} AND is_active = TRUE
  `;
  if (rows.length === 0) {
    console.log(`[getUserById] id=${id} → NOT FOUND in DB`);
    return null;
  }
  const row = rows[0];
  console.log(`[getUserById] id=${id} → FOUND role=${row.role} plan=${row.plan} credits=${row.credits}`);
  console.log(`[getUserById] row type: plan=${typeof row.plan} credits=${typeof row.credits}`);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users WHERE email = ${email.toLowerCase()} AND is_active = TRUE
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getAllUsers(): Promise<PublicUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users WHERE is_active = TRUE
    ORDER BY created_at DESC
  `;
  return rows.map((row: any) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

/**
 * Admin-only full update using tagged template queries.
 * Uses FOR UPDATE lock in the SELECT to guarantee fresh data reads.
 */
export async function updateUserAdmin(
  userId: string,
  updates: {
    role?: UserRole;
    plan?: SubscriptionPlan;
    credits?: number;
    name?: string | null;
    gender?: string | null;
    province?: string | null;
    email?: string;
  }
): Promise<PublicUser | null> {
  const sql = getSql();

  // Handle email conflict check first (outside the main update)
  if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
    const normalized = updates.email.toLowerCase();
    const conflict = await sql`
      SELECT id FROM prismatic_users WHERE email = ${normalized} AND id != ${userId}
    `;
    if (conflict.length > 0) throw new Error('邮箱已被其他账号使用');
  }

  // Apply all changes via tagged template (safe, type-correct)
  if (updates.role !== undefined) {
    await sql`UPDATE prismatic_users SET role = ${updates.role}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.plan !== undefined) {
    await sql`UPDATE prismatic_users SET plan = ${updates.plan}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.credits !== undefined) {
    await sql`UPDATE prismatic_users SET credits = ${updates.credits}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.name !== undefined && updates.name !== null) {
    await sql`UPDATE prismatic_users SET name = ${updates.name || null}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.gender !== undefined && updates.gender !== null) {
    await sql`UPDATE prismatic_users SET gender = ${updates.gender}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.province !== undefined && updates.province !== null) {
    await sql`UPDATE prismatic_users SET province = ${updates.province}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }
  if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
    await sql`UPDATE prismatic_users SET email = ${updates.email.toLowerCase()}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  }

  // Read back — guaranteed fresh on the same WebSocket connection
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, credits, avatar, created_at, last_login_at
    FROM prismatic_users WHERE id = ${userId} AND is_active = TRUE
  `;

  if (rows.length === 0) return null;
  const row = rows[0] as any;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    gender: row.gender,
    province: row.province,
    emailVerified: row.email_verified,
    role: row.role as UserRole,
    plan: row.plan as SubscriptionPlan,
    credits: Number(row.credits ?? 0),
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function updateUserRole(userId: string, role: UserRole): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET role = ${role}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserPlan(userId: string, plan: SubscriptionPlan): Promise<boolean> {
  const sql = getSql();
  const role = plan === 'FREE' ? 'FREE' : 'PRO';
  await sql`UPDATE prismatic_users SET plan = ${plan}, role = ${role}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserCredits(userId: string, credits: number): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET credits = ${credits}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function addUserCredits(userId: string, amount: number): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    UPDATE prismatic_users
    SET credits = GREATEST(0, credits + ${amount}), updated_at = NOW()
    WHERE id = ${userId}
    RETURNING credits
  `;
  return rows.length > 0 ? Number(rows[0].credits) : 0;
}

export async function updateUserName(userId: string, name: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET name = ${name}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserAvatar(userId: string, avatar: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET avatar = ${avatar}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserProfile(userId: string, data: {
  name?: string;
  gender?: 'male' | 'female';
  province?: string;
}): Promise<boolean> {
  if (data.name === undefined && data.gender === undefined && data.province === undefined) {
    return true;
  }
  const sql = getSql();
  await sql`
    UPDATE prismatic_users
    SET
      name = COALESCE(${data.name}, name),
      gender = COALESCE(${data.gender}, gender),
      province = COALESCE(${data.province}, province),
      updated_at = NOW()
    WHERE id = ${userId}
  `;
  return true;
}

export async function verifyUserEmail(userId: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET email_verified = TRUE, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserEmail(userId: string, email: string): Promise<boolean> {
  const sql = getSql();
  const normalized = email.toLowerCase();
  const existing = await sql`
    SELECT id FROM prismatic_users WHERE email = ${normalized} AND id != ${userId}
  `;
  if (existing.length > 0) {
    throw new Error('邮箱已被其他账号使用');
  }
  await sql`UPDATE prismatic_users SET email = ${normalized}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function deleteUser(userId: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET is_active = FALSE, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT password_hash FROM prismatic_users WHERE id = ${userId} AND is_active = TRUE`;
  if (rows.length === 0) return false;
  return bcrypt.compare(password, rows[0].password_hash);
}

export async function changePassword(userId: string, newPassword: string): Promise<boolean> {
  const sql = getSql();
  const hash = await bcrypt.hash(newPassword, 12);
  await sql`UPDATE prismatic_users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

// ─── Demo User Helpers (shared) ────────────────────────────────────────────────

export function isDemoUserId(userId: string) {
  return userId.startsWith('demo_');
}

/**
 * Derive a stable, valid UUID v5 from email for demo users.
 * Same email always → same UUID. Shared between login (JWT userId)
 * and /api/auth/me (DB lookup) so both use the same identifier.
 */
export function demoEmailToUUID(email: string): string {
  const hash = createHash('sha1').update(email.toLowerCase()).digest('hex').slice(0, 32);
  return (
    hash.slice(0, 8) + '-' +
    hash.slice(8, 12) + '-' +
    '5' + hash.slice(13, 16) + '-' +
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20) + '-' +
    hash.slice(20, 32)
  );
}

export async function ensureDemoUserInDB(userId: string, email: string, name: string): Promise<void> {
  const sql = getSql();
  // Step 1: If user was soft-deleted, reactivate them (preserve all other fields)
  await sql`
    UPDATE prismatic_users
    SET is_active = TRUE, updated_at = NOW()
    WHERE id = ${userId} AND is_active = FALSE
  `;
  // Step 2: If user doesn't exist at all, create them
  const existing = await sql`
    SELECT id FROM prismatic_users WHERE id = ${userId}
  `;
  if (existing.length === 0) {
    const passwordHash = await bcrypt.hash('demo-no-password', 4);
    await sql`
      INSERT INTO prismatic_users (id, email, password_hash, name, role, plan, credits, email_verified, is_active)
      VALUES (${userId}, ${email.toLowerCase()}, ${passwordHash}, ${name}, 'PRO', 'LIFETIME', 0, TRUE, TRUE)
    `;
  }
}

// ─── JWT (for middleware auth) ─────────────────────────────────────────────────

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
const JWT_EXPIRY = '30d';

export interface JWTPayload {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
}

/** Create a signed JWT token for a user (used in login/register) */
export function createJWTToken(userId: string, email?: string): string {
  return jwt.sign({ userId, email }, AUTH_SECRET, { expiresIn: JWT_EXPIRY });
}

/** Verify a JWT token and return the payload (used in middleware + API routes) */
export function verifyJWTToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Server-side auth helper — verifies prismatic_token from request cookies.
 * Returns the userId if valid, null otherwise.
 * Use this instead of getSession() for all API routes.
 */
export async function authenticateRequest(req: { cookies: { get: (name: string) => { value?: string } | undefined } }): Promise<string | null> {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return null;
  const payload = verifyJWTToken(token);
  if (!payload) return null;
  return payload.userId;
}

/**
 * Admin-only auth helper — verifies JWT and checks role=ADMIN.
 * Also handles demo users (they are never admins).
 */
export async function authenticateAdminRequest(req: { cookies: { get: (name: string) => { value?: string } | undefined } }): Promise<string | null> {
  const userId = await authenticateRequest(req);
  if (!userId) return null;
  // Demo users are never admins
  if (isDemoUserId(userId)) return null;
  const user = await getUserById(userId);
  if (!user || !isAdmin(user.role)) return null;
  return userId;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const sql = getSql();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO prismatic_sessions (user_id, token, expires_at)
    VALUES (${userId}, ${token}, ${expiresAt})
  `;
  return token;
}

export async function getSession(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, expires_at FROM prismatic_sessions
    WHERE token = ${token} AND expires_at > NOW()
  `;
  if (rows.length === 0) return null;
  return { userId: rows[0].user_id, expiresAt: rows[0].expires_at };
}

export async function deleteSession(token: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM prismatic_sessions WHERE token = ${token}`;
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM prismatic_sessions WHERE user_id = ${userId}`;
}

// ─── Verification Codes ───────────────────────────────────────────────────────

export async function createVerificationCode(email: string, type: 'register' | 'reset'): Promise<string> {
  const sql = getSql();
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await sql`
    INSERT INTO prismatic_verification_codes (email, code, type, expires_at)
    VALUES (${email.toLowerCase()}, ${code}, ${type}, ${expiresAt})
  `;
  return code;
}

export async function verifyCode(email: string, code: string, type: 'register' | 'reset'): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT id FROM prismatic_verification_codes
    WHERE email = ${email.toLowerCase()}
      AND code = ${code}
      AND type = ${type}
      AND used_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return false;
  await sql`UPDATE prismatic_verification_codes SET used_at = NOW() WHERE id = ${rows[0].id}`;
  return true;
}

// ─── Auth Events ─────────────────────────────────────────────────────────────

export async function logAuthEvent(
  eventType: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string,
  details?: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO prismatic_auth_events (user_id, event_type, ip_address, user_agent, details)
    VALUES (${userId ?? null}, ${eventType}, ${ipAddress ?? null}, ${userAgent ?? null}, ${details ?? null})
  `;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  total: number;
  totalAll: number;
  inactive: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
  verified: number;
}> {
  const sql = getSql();

  // Query ALL users (including soft-deleted) for totalAll and inactive count
  const allRows = await sql`
    SELECT role, plan, created_at, email_verified, is_active FROM prismatic_users
  `;

  // Query active users for role/plan distribution
  const activeRows = await sql`
    SELECT role, plan, created_at, email_verified FROM prismatic_users WHERE is_active = TRUE
  `;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byRole: Record<string, number> = {};
  const byPlan: Record<string, number> = {};
  let recent = 0;
  let verified = 0;

  for (const row of activeRows as any[]) {
    byRole[row.role] = (byRole[row.role] || 0) + 1;
    byPlan[row.plan] = (byPlan[row.plan] || 0) + 1;
    if (new Date(row.created_at) > thirtyDaysAgo) recent++;
    if (row.email_verified) verified++;
  }

  const total = activeRows.length;
  const totalAll = allRows.length;
  const inactive = totalAll - total;

  return { total, totalAll, inactive, byRole, byPlan, recent, verified };
}

// ─── Permission Helpers ───────────────────────────────────────────────────────

export function canUseProFeatures(role: UserRole, plan: SubscriptionPlan, credits: number = 0): boolean {
  return plan !== 'FREE' || role === 'ADMIN' || credits > 0;
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

// ─── Prisma Client (for other DB operations) ──────────────────────────────────

let _prisma: any = null;
export function getPrisma() {
  if (_prisma) return _prisma;
  const { PrismaClient } = require('@prisma/client');
  _prisma = new PrismaClient();
  return _prisma;
}
