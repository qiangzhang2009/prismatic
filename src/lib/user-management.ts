/**
 * Prismatic — User Management System
 * Powered by Neon PostgreSQL (serverless, auto-scales to zero)
 * 
 * Connection: @neondatabase/serverless (WebSocket-based)
 * Works with Vercel Serverless + Edge runtimes
 */

import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
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

/** Typed SQL function — always returns rows array, never FullQueryResults */
function createSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // eslint-disable-next-line
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

let _sql: ReturnType<typeof createSql> | null = null;
function getSql(): ReturnType<typeof createSql> {
  if (!_sql) {
    _sql = createSql();
  }
  return _sql;
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
    RETURNING id, email, name, gender, province, email_verified, role, plan, avatar, created_at, last_login_at
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
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  const sql = getSql();

  const rows = await sql`
    SELECT id, email, password_hash, name, gender, province, email_verified, role, plan, avatar, created_at, last_login_at
    FROM prismatic_users
    WHERE email = ${email.toLowerCase()} AND is_active = TRUE
  `;
  if (rows.length === 0) return null;

  const row = rows[0];
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
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, avatar, created_at, last_login_at
    FROM prismatic_users WHERE id = ${id} AND is_active = TRUE
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
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, avatar, created_at, last_login_at
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
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function getAllUsers(): Promise<PublicUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, email, name, gender, province, email_verified, role, plan, avatar, created_at, last_login_at
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
    avatar: row.avatar,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
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
  const sql = getSql();
  if (data.name !== undefined) {
    await sql`UPDATE prismatic_users SET name = ${data.name}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (data.gender !== undefined) {
    await sql`UPDATE prismatic_users SET gender = ${data.gender}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (data.province !== undefined) {
    await sql`UPDATE prismatic_users SET province = ${data.province}, updated_at = NOW() WHERE id = ${userId}`;
  }
  return true;
}

export async function verifyUserEmail(userId: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET email_verified = TRUE, updated_at = NOW() WHERE id = ${userId}`;
  return true;
}

export async function updateUserEmail(userId: string, email: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET email = ${email.toLowerCase()}, updated_at = NOW() WHERE id = ${userId}`;
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

export function createDemoUserFromId(userId: string) {
  const base64 = userId.replace('demo_', '');
  let email = 'demo1@prismatic.app';
  try {
    const decoded = Buffer.from(base64, 'base64').toString();
    if (decoded.includes('@')) email = decoded;
  } catch {}
  const num = email.match(/demo(\d+)/)?.[1] || '1';
  return {
    id: userId,
    email,
    name: `演示账号 ${num}`,
    nameZh: `演示账号 ${num}`,
    gender: null,
    province: null,
    emailVerified: true,
    role: 'PRO' as UserRole,
    plan: 'LIFETIME' as SubscriptionPlan,
    avatar: null,
    canUseProFeatures: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  };
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
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
  recent: number;
  verified: number;
}> {
  const sql = getSql();
  const rows = await sql`
    SELECT role, plan, created_at, email_verified FROM prismatic_users WHERE is_active = TRUE
  `;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const byRole: Record<string, number> = {};
  const byPlan: Record<string, number> = {};
  let recent = 0;
  let verified = 0;

  for (const row of rows) {
    byRole[row.role] = (byRole[row.role] || 0) + 1;
    byPlan[row.plan] = (byPlan[row.plan] || 0) + 1;
    if (new Date(row.created_at) > thirtyDaysAgo) recent++;
    if (row.email_verified) verified++;
  }

  return { total: rows.length, byRole, byPlan, recent, verified };
}

// ─── Permission Helpers ───────────────────────────────────────────────────────

export function canUseProFeatures(role: UserRole, plan: SubscriptionPlan): boolean {
  return plan !== 'FREE' || role === 'ADMIN';
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
