/**
 * Prismatic — User Management System
 * 双写策略：同时维护 Prisma User 表和旧表 prismatic_users
 * 保证中间件鉴权（使用旧表）和新功能（使用新表）的兼容性
 */

import { PrismaClient } from '@prisma/client';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

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
  credits: number;
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

// ─── Database Connection ────────────────────────────────────────────────────────

function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  // eslint-disable-next-line
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

function getGender(user: any): 'male' | 'female' | null {
  if (!user.preferences) return null;
  try {
    const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
    return prefs.gender as 'male' | 'female' | null;
  } catch { return null; }
}

function getProvince(user: any): string | null {
  if (!user.preferences) return null;
  try {
    const prefs = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
    return prefs.province as string | null;
  } catch { return null; }
}

// ─── User Operations ─────────────────────────────────────────────────────────────

export async function createUser(input: CreateUserInput & { emailVerified?: boolean }): Promise<PublicUser | null> {
  try {
    const existing = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) return null;

    const passwordHash = await bcrypt.hash(input.password, 12);

    // 创建新表记录
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: input.email.toLowerCase(),
        passwordHash,
        name: input.name || null,
        preferences: JSON.stringify({
          gender: input.gender,
          province: input.province,
        }),
        status: 'ACTIVE',
        role: 'FREE',
        plan: 'FREE',
        credits: 0,
        emailVerified: input.emailVerified ? new Date() : null,
      },
    });

    // 同步到旧表
    const sql = getSql();
    await sql`
      INSERT INTO prismatic_users
        (id, email, password_hash, name, gender, province, email_verified, role, plan, credits, is_active, created_at, updated_at)
      VALUES (
        ${newUser.id},
        ${newUser.email},
        ${passwordHash},
        ${input.name ?? null},
        ${input.gender ?? null},
        ${input.province ?? null},
        ${input.emailVerified ?? false},
        'FREE',
        'FREE',
        0,
        TRUE,
        ${newUser.createdAt},
        ${newUser.updatedAt}
      )
    `;

    return {
      id: newUser.id,
      email: newUser.email || '',
      name: newUser.name,
      gender: input.gender || null,
      province: input.province || null,
      emailVerified: !!input.emailVerified,
      role: 'FREE',
      plan: 'FREE',
      credits: 0,
      avatar: null,
      createdAt: newUser.createdAt,
      lastLoginAt: null,
    };
  } catch (error) {
    console.error('[createUser] Error:', error);
    return null;
  }
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, password_hash, name, gender, province, email_verified, role, plan, credits, created_at
      FROM prismatic_users
      WHERE email = ${email.toLowerCase()} AND is_active = TRUE
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const row = rows[0];

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) return null;

    // 尝试更新 last_login_at（如果列存在）
    try {
      await sql`UPDATE prismatic_users SET last_login_at = NOW() WHERE id = ${row.id}`;
    } catch { /* 列不存在则忽略 */ }

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      gender: row.gender as any,
      province: row.province,
      emailVerified: row.email_verified,
      role: row.role as UserRole,
      plan: row.plan as SubscriptionPlan,
      credits: Number(row.credits ?? 0),
      avatar: null,
      createdAt: row.created_at,
      lastLoginAt: null,
    };
  } catch (error) {
    console.error('[verifyCredentials] Error:', error);
    return null;
  }
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      return {
        id: user.id,
        email: user.email || '',
        name: user.name,
        gender: getGender(user),
        province: getProvince(user),
        emailVerified: !!user.emailVerified,
        role: (user.role || 'FREE') as UserRole,
        plan: (user.plan || 'FREE') as SubscriptionPlan,
        credits: user.credits || 0,
        avatar: user.avatar,
        createdAt: user.createdAt,
        lastLoginAt: user.updatedAt, // 使用 updatedAt 作为最后登录时间
      };
    }

    const sql = getSql();
    const rows = await sql`
      SELECT id, email, name, gender, province, email_verified, role, plan, credits, created_at
      FROM prismatic_users
      WHERE id = ${userId} AND is_active = TRUE
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const row = rows[0];

    // 异步同步到新表
    syncUserToNewTable(row).catch(console.error);

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      gender: row.gender as any,
      province: row.province,
      emailVerified: row.email_verified,
      role: row.role as UserRole,
      plan: row.plan as SubscriptionPlan,
      credits: Number(row.credits ?? 0),
      avatar: null,
      createdAt: row.created_at,
      lastLoginAt: null,
    };
  } catch (error) {
    console.error('[getUserById] Error:', error);
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  return getUserById(email);
}

async function syncUserToNewTable(oldUser: any): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: oldUser.id },
      update: {
        email: oldUser.email,
        name: oldUser.name,
        preferences: JSON.stringify({
          gender: oldUser.gender,
          province: oldUser.province,
        }),
        status: oldUser.is_active ? 'ACTIVE' : 'SUSPENDED',
        role: oldUser.role as any,
        plan: oldUser.plan as any,
        credits: oldUser.credits || 0,
        emailVerified: oldUser.email_verified ? new Date() : null,
        updatedAt: new Date(),
      },
      create: {
        id: oldUser.id,
        email: oldUser.email,
        passwordHash: oldUser.password_hash || null,
        name: oldUser.name,
        preferences: JSON.stringify({
          gender: oldUser.gender,
          province: oldUser.province,
        }),
        status: oldUser.is_active ? 'ACTIVE' : 'SUSPENDED',
        role: oldUser.role as any,
        plan: oldUser.plan as any,
        credits: oldUser.credits || 0,
        emailVerified: oldUser.email_verified ? new Date() : null,
        createdAt: new Date(oldUser.created_at),
      },
    });
  } catch (error) {
    console.error('[syncUserToNewTable] Error:', error);
  }
}

// ─── Admin Operations ────────────────────────────────────────────────────────────

export async function updateUserRole(userId: string, role: UserRole): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET role = ${role}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;

    return true;
  } catch (error) {
    console.error('[updateUserRole] Error:', error);
    return false;
  }
}

export async function updateUserPlan(userId: string, plan: SubscriptionPlan, role?: UserRole): Promise<boolean> {
  try {
    const data: any = { plan };
    if (role) data.role = role;
    await prisma.user.update({
      where: { id: userId },
      data,
    });

    const sql = getSql();
    if (role) {
      await sql`UPDATE prismatic_users SET plan = ${plan}, role = ${role}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
    } else {
      await sql`UPDATE prismatic_users SET plan = ${plan}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
    }

    return true;
  } catch (error) {
    console.error('[updateUserPlan] Error:', error);
    return false;
  }
}

export async function updateUserCredits(userId: string, credits: number): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { credits },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET credits = ${credits}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;

    return true;
  } catch (error) {
    console.error('[updateUserCredits] Error:', error);
    return false;
  }
}

export async function adminSetUser(userId: string, updates: {
  name?: string;
  email?: string;
  role?: UserRole;
  plan?: SubscriptionPlan;
  credits?: number;
  isActive?: boolean;
}): Promise<boolean> {
  try {
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email.toLowerCase();
    if (updates.role !== undefined) data.role = updates.role;
    if (updates.plan !== undefined) data.plan = updates.plan;
    if (updates.credits !== undefined) data.credits = updates.credits;
    if (updates.isActive !== undefined) data.status = updates.isActive ? 'ACTIVE' : 'SUSPENDED';

    await prisma.user.update({
      where: { id: userId },
      data,
    });

    const sql = getSql();

    // 使用多个独立的 UPDATE 语句，避免字符串拼接
    if (updates.name !== undefined) {
      await sql`UPDATE prismatic_users SET name = ${updates.name}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updates.email !== undefined) {
      await sql`UPDATE prismatic_users SET email = ${updates.email.toLowerCase()}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updates.role !== undefined) {
      await sql`UPDATE prismatic_users SET role = ${updates.role}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updates.plan !== undefined) {
      await sql`UPDATE prismatic_users SET plan = ${updates.plan}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updates.credits !== undefined) {
      await sql`UPDATE prismatic_users SET credits = ${updates.credits}, updated_at = NOW() WHERE id = ${userId}`;
    }
    if (updates.isActive !== undefined) {
      await sql`UPDATE prismatic_users SET is_active = ${updates.isActive}, updated_at = NOW() WHERE id = ${userId}`;
    }

    return true;
  } catch (error) {
    console.error('[adminSetUser] Error:', error);
    return false;
  }
}

export async function setUserBan(userId: string, banned: boolean, reason?: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: banned ? 'BANNED' : 'ACTIVE',
        banReason: reason || null,
        bannedAt: banned ? new Date() : null,
      },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET is_active = ${!banned}, updated_at = NOW() WHERE id = ${userId}`;

    return true;
  } catch (error) {
    console.error('[setUserBan] Error:', error);
    return false;
  }
}

export async function verifyEmail(userId: string): Promise<boolean> {
  try {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: now },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET email_verified = true, updated_at = NOW() WHERE id = ${userId}`;

    return true;
  } catch (error) {
    console.error('[verifyEmail] Error:', error);
    return false;
  }
}

export async function updatePassword(userId: string, passwordHash: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET password_hash = ${passwordHash}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;

    return true;
  } catch (error) {
    console.error('[updatePassword] Error:', error);
    return false;
  }
}

export async function isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
  try {
    const where: any = { email: email.toLowerCase() };
    if (excludeUserId) where.id = { not: excludeUserId };

    const count = await prisma.user.count({ where });
    return count > 0;
  } catch (error) {
    console.error('[isEmailTaken] Error:', error);
    return false;
  }
}

export async function getAllUsers(limit = 100): Promise<PublicUser[]> {
  try {
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(user => ({
      id: user.id,
      email: user.email || '',
      name: user.name,
      gender: getGender(user),
      province: getProvince(user),
      emailVerified: !!user.emailVerified,
      role: (user.role || 'FREE') as UserRole,
      plan: (user.plan || 'FREE') as SubscriptionPlan,
      credits: user.credits || 0,
      avatar: user.avatar,
      createdAt: user.createdAt,
      lastLoginAt: user.updatedAt,
    }));
  } catch (error) {
    console.error('[getAllUsers] Error:', error);
    return [];
  }
}

// ─── JWT Operations ──────────────────────────────────────────────────────────────

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
const JWT_EXPIRY = '30d';

export function createJWTToken(userId: string, email?: string): string {
  return jwt.sign({ userId, email }, AUTH_SECRET, { expiresIn: JWT_EXPIRY });
}

export type JWTPayload = {
  userId: string;
  email?: string;
  iat?: number;
  exp?: number;
};

export function verifyJWTToken(token: string): JWTPayload | null {
  try {
    const payload = jwt.verify(token, AUTH_SECRET) as JWTPayload;
    return payload;
  } catch {
    return null;
  }
}

// ─── Auth Helpers ────────────────────────────────────────────────────────────────

export function isDemoUserId(userId: string): boolean {
  return userId.startsWith('demo_');
}

export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN';
}

export async function authenticateRequest(
  req: { cookies: { get: (name: string) => { value?: string } | undefined } }
): Promise<string | null> {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return null;
  const payload = verifyJWTToken(token);
  if (!payload) return null;
  return payload.userId;
}

export async function authenticateAdminRequest(
  req: { cookies: { get: (name: string) => { value?: string } | undefined } }
): Promise<string | null> {
  const userId = await authenticateRequest(req);
  if (!userId) return null;
  if (isDemoUserId(userId)) return null;
  const user = await getUserById(userId);
  if (!user || !isAdmin(user.role)) return null;
  return userId;
}

// ─── Sessions ───────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const { randomBytes } = await import('crypto');
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
  const row = rows[0] as any;
  return { userId: row.user_id, expiresAt: row.expires_at };
}

export async function deleteSession(token: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM prismatic_sessions WHERE token = ${token}`;
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM prismatic_sessions WHERE user_id = ${userId}`;
}

// ─── Verification Codes ─────────────────────────────────────────────────────────

export async function createVerificationCode(email: string, type: 'register' | 'reset'): Promise<string> {
  const { randomBytes } = await import('crypto');
  const sql = getSql();

  const code = randomBytes(3).toString('hex').slice(0, 6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await sql`
    INSERT INTO verification_codes (identifier, code, type, expires_at)
    VALUES (${email.toLowerCase()}, ${code}, ${type}, ${expiresAt})
    ON CONFLICT (identifier, type) DO UPDATE SET
      code = ${code},
      expires_at = ${expiresAt},
      attempts = 0
  `;

  return code;
}

export async function verifyCode(email: string, code: string, type: 'register' | 'reset'): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT code, attempts, max_attempts, expires_at FROM verification_codes
    WHERE identifier = ${email.toLowerCase()} AND type = ${type}
  `;

  if (rows.length === 0) return false;
  const row = rows[0] as any;

  if (row.attempts >= row.max_attempts) return false;
  if (new Date() > new Date(row.expires_at)) return false;
  if (row.code !== code) {
    await sql`UPDATE verification_codes SET attempts = attempts + 1 WHERE identifier = ${email.toLowerCase()} AND type = ${type}`;
    return false;
  }

  await sql`DELETE FROM verification_codes WHERE identifier = ${email.toLowerCase()} AND type = ${type}`;
  return true;
}

// ─── Auth Events ─────────────────────────────────────────────────────────────────

export async function logAuthEvent(
  userId: string | null,
  eventType: string,
  success: boolean,
  reason?: string,
  ip?: string,
  userAgent?: string,
  provider?: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO auth_events (user_id, event_type, provider, ip, user_agent, success, reason)
    VALUES (${userId}, ${eventType}, ${provider ?? null}, ${ip ?? null}, ${userAgent ?? null}, ${success}, ${reason ?? null})
  `;
}

// ─── Admin Stats ─────────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
}> {
  const sql = getSql();
  const today = new Date().toISOString().slice(0, 10);

  const totalUsers = Number((await sql`SELECT COUNT(*) FROM prismatic_users WHERE is_active = TRUE`)[0].count);
  const activeUsers = Number((await sql`
    SELECT COUNT(DISTINCT user_id) FROM prismatic_message_stats
    WHERE date >= ${today}
  `)[0].count || 0);
  const newUsersToday = Number((await sql`
    SELECT COUNT(*) FROM prismatic_users
    WHERE DATE(created_at) = ${today} AND is_active = TRUE
  `)[0].count || 0);

  const byRoleRows = await sql`
    SELECT role, COUNT(*) as count FROM prismatic_users WHERE is_active = TRUE GROUP BY role
  `;
  const byPlanRows = await sql`
    SELECT plan, COUNT(*) as count FROM prismatic_users WHERE is_active = TRUE GROUP BY plan
  `;

  const byRole: Record<string, number> = {};
  const byPlan: Record<string, number> = {};

  for (const r of byRoleRows as any[]) byRole[r.role] = Number(r.count);
  for (const r of byPlanRows as any[]) byPlan[r.plan] = Number(r.count);

  return { totalUsers, activeUsers, newUsersToday, byRole, byPlan };
}

// ─── Feature Access ──────────────────────────────────────────────────────────────

export function canUseProFeatures(role: UserRole, plan: SubscriptionPlan, credits: number = 0): boolean {
  return role === 'ADMIN' || plan !== 'FREE' || credits > 0;
}

// ─── Additional Admin Helper Functions ──────────────────────────────────────────

export async function updateUserName(userId: string, name: string): Promise<boolean> {
  const sql = getSql();
  await sql`UPDATE prismatic_users SET name = ${name}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
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

export async function updateUserAvatar(userId: string, avatar: string): Promise<boolean> {
  // avatar 字段只在新表 User 中存在，旧表 prismatic_users 没有该字段
  // 仅更新新表即可
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { avatar },
    });
    return true;
  } catch (error) {
    console.error('[updateUserAvatar] Error:', error);
    return false;
  }
}

export async function verifyPassword(userId: string, password: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    SELECT password_hash FROM prismatic_users WHERE id = ${userId} AND is_active = TRUE
  `;
  if (rows.length === 0) return false;
  return bcrypt.compare(password, rows[0].password_hash);
}

export async function changePassword(userId: string, newPassword: string): Promise<boolean> {
  const sql = getSql();
  const hash = await bcrypt.hash(newPassword, 12);
  await sql`UPDATE prismatic_users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userId} AND is_active = TRUE`;
  return true;
}

// ─── Demo User Helpers ────────────────────────────────────────────────────────────

export function demoEmailToUUID(email: string): string {
  const { createHash } = require('crypto');
  const hash = createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function ensureDemoUserInDB(userId: string, email: string, name: string): Promise<void> {
  const sql = getSql();
  const dbId = userId.replace('demo_', '');

  await sql`
    INSERT INTO prismatic_users (id, email, name, role, plan, is_active, created_at, updated_at)
    VALUES (
      ${dbId},
      ${email.toLowerCase()},
      ${name},
      'PRO',
      'LIFETIME',
      TRUE,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      is_active = TRUE,
      updated_at = NOW()
  `;
}

// ─── Admin Operations (Advanced) ─────────────────────────────────────────────────

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

  // 检查邮箱冲突
  if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
    const normalized = updates.email.toLowerCase();
    const conflict = await sql`
      SELECT id FROM prismatic_users WHERE email = ${normalized} AND id != ${userId}
    `;
    if (conflict.length > 0) throw new Error('邮箱已被其他账号使用');
  }

  // 更新新表
  const prismaData: any = {};
  if (updates.role !== undefined) prismaData.role = updates.role;
  if (updates.plan !== undefined) prismaData.plan = updates.plan;
  if (updates.credits !== undefined) prismaData.credits = updates.credits;
  if (updates.name !== undefined) prismaData.name = updates.name || null;
  if (updates.gender !== undefined || updates.province !== undefined) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    const prefs = existingUser?.preferences ? JSON.parse(existingUser.preferences as string) : {};
    if (updates.gender !== undefined) prefs.gender = updates.gender;
    if (updates.province !== undefined) prefs.province = updates.province;
    prismaData.preferences = JSON.stringify(prefs);
  }

  if (Object.keys(prismaData).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: prismaData,
    });
  }

  // 更新旧表 - 每个字段单独执行 UPDATE，避免模板字符串拼接错误
  if (updates.role !== undefined) {
    await sql`UPDATE prismatic_users SET role = ${updates.role}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.plan !== undefined) {
    await sql`UPDATE prismatic_users SET plan = ${updates.plan}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.credits !== undefined) {
    await sql`UPDATE prismatic_users SET credits = ${updates.credits}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.name !== undefined) {
    await sql`UPDATE prismatic_users SET name = ${updates.name || null}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.gender !== undefined) {
    await sql`UPDATE prismatic_users SET gender = ${updates.gender}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.province !== undefined) {
    await sql`UPDATE prismatic_users SET province = ${updates.province}, updated_at = NOW() WHERE id = ${userId}`;
  }
  if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
    await sql`UPDATE prismatic_users SET email = ${updates.email.toLowerCase()}, updated_at = NOW() WHERE id = ${userId}`;
  }

  // 返回更新后的数据
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

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    });

    const sql = getSql();
    await sql`UPDATE prismatic_users SET is_active = FALSE, updated_at = NOW() WHERE id = ${userId}`;

    return true;
  } catch (error) {
    console.error('[deleteUser] Error:', error);
    return false;
  }
}
