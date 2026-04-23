/**
 * Prismatic — User Management System
 * 使用 Prisma User 表进行用户管理
 */
/* eslint-disable @typescript-eslint/no-require-imports */

import { prisma } from '@/lib/prisma';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

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

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
  return neon(connectionString);
}

// ─── Helper Functions ────────────────────────────────────────────────────────────

function getGender(user: any): 'male' | 'female' | null {
  if (!user.preferences) return null;
  try {
    const raw = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
    const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return prefs?.gender as 'male' | 'female' | null;
  } catch { return null; }
}

function getProvince(user: any): string | null {
  if (!user.preferences) return null;
  try {
    const raw = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : user.preferences;
    const prefs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return prefs?.province as string | null;
  } catch { return null; }
}

// ─── User Operations ─────────────────────────────────────────────────────────────

export async function createUser(input: CreateUserInput & { emailVerified?: boolean }): Promise<PublicUser | null> {
  try {
    const sql = getSql();
    const existing = await sql`SELECT id FROM users WHERE email = ${input.email.toLowerCase()} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`[createUser] email=${input.email} → already exists in users table`);
      return null;
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const userId = crypto.randomUUID();
    const prefs = JSON.stringify({ gender: input.gender, province: input.province });

    try {
      await sql`
        INSERT INTO users (id, email, "passwordHash", name, preferences, status, role, plan, credits, "emailVerified", "createdAt", "updatedAt")
        VALUES (
          ${userId},
          ${input.email.toLowerCase()},
          ${passwordHash},
          ${input.name ?? null},
          ${prefs},
          'ACTIVE',
          'FREE',
          'FREE',
          10,
          ${input.emailVerified ? new Date() : null},
          NOW(),
          NOW()
        )
      `;
    } catch (err) {
      console.error(`[createUser] INSERT failed for ${input.email}:`, err);
      throw err;
    }

    return {
      id: userId,
      email: input.email.toLowerCase(),
      name: input.name || null,
      gender: input.gender || null,
      province: input.province || null,
      emailVerified: !!input.emailVerified,
      role: 'FREE',
      plan: 'FREE',
      credits: 10,
      avatar: null,
      createdAt: new Date(),
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
    // Query the users table using raw SQL (neon) — works regardless of Prisma schema state
    const rows = await sql`
      SELECT id, email, name, avatar,
             "passwordHash", "emailVerified", role, plan, credits,
             "createdAt", "updatedAt", preferences, status
      FROM users
      WHERE email = ${email.toLowerCase()}
        AND status::text = 'ACTIVE'
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const user: any = rows[0];

    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) return null;

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
      createdAt: new Date(user.createdAt),
      lastLoginAt: new Date(user.updatedAt),
    };
  } catch (error) {
    console.error('[verifyCredentials] Error:', error);
    return null;
  }
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, email, name, avatar,
             "passwordHash", "emailVerified", role, plan, credits,
             "createdAt", "updatedAt", preferences, status
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    const user: any = rows[0];

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
      createdAt: new Date(user.createdAt),
      lastLoginAt: new Date(user.updatedAt),
    };
  } catch (error) {
    console.error('[getUserById] Error:', error);
    return null;
  }
}

export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  return getUserById(email);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- one-time migration function
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
    return true;
  } catch (error) {
    console.error('[setUserBan] Error:', error);
    return false;
  }
}

export async function verifyEmail(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
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
  req: {
    cookies: { get: (name: string) => { value?: string } | undefined };
    headers?: { get: (name: string) => string | null };
  }
): Promise<string | null> {
  // Try cookie first, then Authorization header
  let token = req.cookies.get('prismatic_token')?.value;
  if (!token) {
    const authHeader = req.headers?.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }
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

  // Dev/demo bypass: allow demo users through when ALLOW_ADMIN_BYPASS is set.
  // This grants demo accounts admin-level access without a DB record.
  if (isDemoUserId(userId)) {
    if (process.env.ALLOW_ADMIN_BYPASS === 'true') return userId;
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });
  if (!user) return null;
  if (!isAdmin(user.role as UserRole)) return null;
  if (user.status !== 'ACTIVE') return null;
  return userId;
}

// ─── Sessions ───────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<string> {
  const { randomBytes } = await import('crypto');
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  // prismatic_sessions table does not exist — sessions are cookie/JWT-based
  // This function is kept for API compatibility but is a no-op
  void userId;
  void expiresAt;
  return token;
}

export async function getSession(token: string): Promise<{ userId: string; expiresAt: Date } | null> {
  void token;
  return null;
}

export async function deleteSession(token: string): Promise<void> {
  void token;
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  void userId;
}

// ─── Verification Codes ─────────────────────────────────────────────────────────

export async function createVerificationCode(email: string, type: 'register' | 'reset'): Promise<string> {
  const { randomBytes } = await import('crypto');
  const code = randomBytes(3).toString('hex').slice(0, 6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const typeEnum = type === 'register' ? 'REGISTER_EMAIL' : 'RESET_PASSWORD_EMAIL';

  await prisma.verificationCode.upsert({
    where: { identifier_type: { identifier: email.toLowerCase(), type: typeEnum } },
    update: { code, expiresAt, attempts: 0 },
    create: {
      identifier: email.toLowerCase(),
      code,
      type: typeEnum,
      expiresAt,
    },
  }).catch(() => {
    return prisma.verificationCode.deleteMany({
      where: { identifier: email.toLowerCase(), type: typeEnum },
    }).then(() =>
      prisma.verificationCode.create({
        data: {
          identifier: email.toLowerCase(),
          code,
          type: typeEnum,
          expiresAt,
        },
      })
    );
  });

  return code;
}

export async function verifyCode(email: string, code: string, type: 'register' | 'reset'): Promise<boolean> {
  const typeEnum = type === 'register' ? 'REGISTER_EMAIL' : 'RESET_PASSWORD_EMAIL';
  const records = await prisma.verificationCode.findMany({
    where: { identifier: email.toLowerCase(), type: typeEnum },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  if (records.length === 0) return false;
  const record = records[0];

  if (record.attempts >= record.maxAttempts) return false;
  if (new Date() > record.expiresAt) return false;

  if (record.code !== code) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.verificationCode.delete({ where: { id: record.id } });
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
  try {
    await prisma.authEvent.create({
      data: {
        userId,
        eventType: eventType as any,
        provider: provider as any || null,
        ip,
        userAgent,
        success,
        reason,
      },
    });
  } catch (error) {
    // Non-critical: don't fail requests if logging fails
    console.error('[logAuthEvent] Error:', error);
  }
}

// ─── Admin Stats ─────────────────────────────────────────────────────────────────

export async function getUserStats(): Promise<{
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  byRole: Record<string, number>;
  byPlan: Record<string, number>;
}> {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [totalUsers, newUsersToday, byRoleRows, byPlanRows, activeUsers] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({
      where: {
        createdAt: { gte: todayStart },
        status: 'ACTIVE',
      },
    }),
    prisma.user.groupBy({
      by: ['role'],
      where: { status: 'ACTIVE' },
      _count: { role: true },
    }),
    prisma.user.groupBy({
      by: ['plan'],
      where: { status: 'ACTIVE' },
      _count: { plan: true },
    }),
    prisma.conversation.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of byRoleRows) byRole[r.role || 'FREE'] = r._count.role;
  const byPlan: Record<string, number> = {};
  for (const r of byPlanRows) byPlan[r.plan || 'FREE'] = r._count.plan;

  return { totalUsers, activeUsers: activeUsers.length, newUsersToday, byRole, byPlan };
}

// ─── Feature Access ──────────────────────────────────────────────────────────────

export function canUseProFeatures(role: UserRole, plan: SubscriptionPlan): boolean {
  return role === 'ADMIN' || plan !== 'FREE';
}

// ─── Additional Admin Helper Functions ──────────────────────────────────────────

export async function updateUserName(userId: string, name: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { name },
    });
    return true;
  } catch (error) {
    console.error('[updateUserName] Error:', error);
    return false;
  }
}

export async function updateUserProfile(userId: string, data: {
  name?: string;
  gender?: 'male' | 'female';
  province?: string;
}): Promise<boolean> {
  if (data.name === undefined && data.gender === undefined && data.province === undefined) {
    return true;
  }
  try {
    const prismaData: any = {};
    if (data.name !== undefined) prismaData.name = data.name;
    if (data.gender !== undefined || data.province !== undefined) {
      const existing = await prisma.user.findUnique({ where: { id: userId } });
      let prefs: any = {};
      try {
        if (existing?.preferences) {
          prefs = typeof existing.preferences === 'string'
            ? JSON.parse(existing.preferences as string)
            : existing.preferences;
        }
      } catch { /* use empty object */ }
      if (data.gender !== undefined) prefs.gender = data.gender;
      if (data.province !== undefined) prefs.province = data.province;
      prismaData.preferences = prefs;
    }
    await prisma.user.update({
      where: { id: userId },
      data: prismaData,
    });
    return true;
  } catch (error) {
    console.error('[updateUserProfile] Error:', error);
    return false;
  }
}

export async function verifyUserEmail(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
    return true;
  } catch (error) {
    console.error('[verifyUserEmail] Error:', error);
    return false;
  }
}

export async function updateUserEmail(userId: string, email: string): Promise<boolean> {
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { email: normalized, id: { not: userId } },
  });
  if (existing) throw new Error('邮箱已被其他账号使用');
  await prisma.user.update({
    where: { id: userId },
    data: { email: normalized },
  });
  return true;
}

export async function addUserCredits(userId: string, amount: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  if (!user) return 0;
  const newCredits = Math.max(0, user.credits + amount);
  await prisma.user.update({
    where: { id: userId },
    data: { credits: newCredits },
  });
  return newCredits;
}

export async function updateUserAvatar(userId: string, avatar: string): Promise<boolean> {
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function changePassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return true;
  } catch (error) {
    console.error('[changePassword] Error:', error);
    return false;
  }
}

// ─── Demo User Helpers ────────────────────────────────────────────────────────────

export function demoEmailToUUID(email: string): string {
  const { createHash } = require('crypto');
  const hash = createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function ensureDemoUserInDB(userId: string, email: string, name: string): Promise<void> {
  const dbId = userId.replace('demo_', '');
  try {
    const existing = await prisma.user.findUnique({ where: { id: dbId } });
    if (existing) {
      await prisma.user.update({
        where: { id: dbId },
        data: {
          email: email.toLowerCase(),
          name,
          status: 'ACTIVE',
          role: 'PRO',
          plan: 'LIFETIME',
        },
      });
    } else {
      await prisma.user.create({
        data: {
          id: dbId,
          email: email.toLowerCase(),
          name,
          status: 'ACTIVE',
          role: 'PRO',
          plan: 'LIFETIME',
          credits: 0,
        },
      });
    }
  } catch (error) {
    console.error('[ensureDemoUserInDB] error:', error);
  }
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
    status?: string;
  }
): Promise<PublicUser | null> {
  console.log('[updateUserAdmin] Starting update for userId:', userId, 'updates:', JSON.stringify(updates));
  // 检查邮箱冲突 using Prisma
  if (updates.email !== undefined && updates.email !== null && updates.email !== '') {
    const normalized = updates.email.toLowerCase();
    console.log('[updateUserAdmin] Checking email uniqueness for:', normalized);
    const conflict = await prisma.user.findFirst({
      where: { email: normalized, id: { not: userId } },
    });
    if (conflict) {
      console.log('[updateUserAdmin] Email conflict found!');
      throw new Error('邮箱已被其他账号使用');
    }
  }

  // 构建 Prisma 更新数据
  const prismaData: any = {};
  if (updates.role !== undefined) prismaData.role = updates.role;
  if (updates.plan !== undefined) prismaData.plan = updates.plan;
  if (updates.credits !== undefined) prismaData.credits = updates.credits;
  if (updates.name !== undefined) prismaData.name = updates.name || null;
  if (updates.email !== undefined) prismaData.email = updates.email;
  if (updates.status !== undefined) prismaData.status = updates.status;
  if (updates.gender !== undefined || updates.province !== undefined) {
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    let prefs: any = {};
    try {
      if (existingUser?.preferences) {
        prefs = typeof existingUser.preferences === 'string'
          ? JSON.parse(existingUser.preferences as string)
          : existingUser.preferences;
      }
    } catch { /* use empty object */ }
    if (updates.gender !== undefined) prefs.gender = updates.gender;
    if (updates.province !== undefined) prefs.province = updates.province;
    prismaData.preferences = prefs;
  }

  console.log('[updateUserAdmin] prismaData to update:', JSON.stringify(prismaData));

  if (Object.keys(prismaData).length > 0) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: prismaData,
      });
      console.log('[updateUserAdmin] Update successful');
    } catch (err) {
      console.error('[updateUserAdmin] Prisma update error:', err);
      throw err;
    }
  } else {
    console.log('[updateUserAdmin] No fields to update, skipping update');
  }

  // 从 Prisma users 表返回更新后的数据
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

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
    lastLoginAt: user.updatedAt,
  };
}

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'DELETED' },
    });
    return true;
  } catch (error) {
    console.error('[deleteUser] Error:', error);
    return false;
  }
}
