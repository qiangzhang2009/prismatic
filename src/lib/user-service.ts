/**
 * User Management Prisma Adapter
 *
 * 该模块提供与旧 `user-management.ts` 相同的 API，
 * 但底层使用 Prisma 而非直接 SQL，从而统一数据源。
 *
 * 迁移策略：
 * 1. 保持所有函数签名不变
 * 2. 内部实现改用 Prisma Client
 * 3. 逐步替换旧模块的导入
 */

import { PrismaClient } from '@prisma/client';
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

// 兼容旧代码的字段名映射
function mapToPublicUser(user: any): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    gender: user.preferences?.gender as any || null,
    province: user.preferences?.province as any || null,
    emailVerified: !!user.emailVerified,
    role: (user.role || 'FREE') as UserRole,
    plan: (user.plan || 'FREE') as SubscriptionPlan,
    credits: user.credits || 0,
    avatar: user.avatar,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

/**
 * 创建用户（使用 Prisma）
 */
export async function createUser(input: {
  email: string;
  password?: string;
  name?: string;
  gender?: 'male' | 'female';
  province?: string;
  emailVerified?: boolean;
  role?: UserRole;
  plan?: SubscriptionPlan;
}): Promise<PublicUser | null> {
  try {
    // 检查是否已存在
    const existing = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });
    if (existing) return null;

    const passwordHash = input.password ? await bcrypt.hash(input.password, 12) : null;

    const user = await prisma.user.create({
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
        role: input.role || 'FREE',
        plan: input.plan || 'FREE',
        credits: 0,
        emailVerified: input.emailVerified ? new Date() : null,
      },
    });

    return mapToPublicUser(user);
  } catch (error) {
    console.error('[createUser] Error:', error);
    return null;
  }
}

/**
 * 验证凭据
 */
export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'ACTIVE',
      },
    });

    if (!user || !user.passwordHash) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    // 更新最后登录时间（使用 updatedAt 字段）
    await prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: new Date() },
    });

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    return updatedUser ? mapToPublicUser(updatedUser) : null;
  } catch (error) {
    console.error('[verifyCredentials] Error:', error);
    return null;
  }
}

/**
 * 根据ID获取用户
 */
export async function getUserById(userId: string): Promise<PublicUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? mapToPublicUser(user) : null;
  } catch (error) {
    console.error('[getUserById] Error:', error);
    return null;
  }
}

/**
 * 根据邮箱获取用户
 */
export async function getUserByEmail(email: string): Promise<PublicUser | null> {
  try {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });
    return user ? mapToPublicUser(user) : null;
  } catch (error) {
    console.error('[getUserByEmail] Error:', error);
    return null;
  }
}

/**
 * 更新用户角色
 */
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

/**
 * 更新用户计划
 */
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

/**
 * 更新用户积分
 */
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

/**
 * 管理员设置用户信息
 */
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

/**
 * 封禁/解封用户
 */
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

/**
 * 验证邮箱
 */
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

/**
 * 更新密码
 */
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

/**
 * 检查邮箱是否被使用
 */
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

/**
 * 获取所有用户（管理员用）
 */
export async function getAllUsers(limit = 100): Promise<PublicUser[]> {
  try {
    const users = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return users.map(mapToPublicUser);
  } catch (error) {
    console.error('[getAllUsers] Error:', error);
    return [];
  }
}

/**
 * JWT 验证（保持不变，使用相同的密钥）
 */
export function verifyJWTToken(token: string): { userId: string } | null {
  const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as any;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export function generateToken(userId: string): string {
  const AUTH_SECRET = process.env.AUTH_SECRET ?? 'prismatic-dev-secret-2024';
  return jwt.sign({ userId }, AUTH_SECRET, { expiresIn: '30d' });
}
