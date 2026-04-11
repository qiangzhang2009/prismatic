/**
 * Prismatic — Auth Utils Stub (No-Auth Mode)
 * These functions are stubs that work without a database.
 * To enable full auth: set USE_AUTH=true and configure DATABASE_URL.
 */

export async function hashPassword(password: string): Promise<string> {
  // In no-auth mode, we don't store passwords
  const { hash } = await import('bcryptjs');
  return hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const { compare } = await import('bcryptjs');
  return compare(password, hash);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('密码至少8个字符');
  if (password.length > 128) errors.push('密码最多128个字符');
  if (!/[A-Z]/.test(password)) errors.push('密码需要包含至少一个大写字母');
  if (!/[a-z]/.test(password)) errors.push('密码需要包含至少一个小写字母');
  if (!/[0-9]/.test(password)) errors.push('密码需要包含至少一个数字');
  return { valid: errors.length === 0, errors };
}

export async function generateCode(): Promise<{ success: boolean; code?: string }> {
  // In dev mode, generate a random 6-digit code
  if (process.env.NODE_ENV === 'development') {
    return { success: true, code: '123456' };
  }
  return { success: true, code: String(Math.floor(100000 + Math.random() * 900000)) };
}

export async function verifyCode(): Promise<boolean> {
  return true;
}

export async function logAuthEvent(): Promise<void> {
  // No-op in no-auth mode
}

export async function checkRateLimit(): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  return { allowed: true, remaining: 100, resetAt: new Date() };
}

export async function createEmailUser(): Promise<{ id: string; name: string }> {
  return { id: `guest_${Date.now()}`, name: '访客' };
}

export async function createPhoneUser(): Promise<{ id: string; name: string }> {
  return { id: `guest_${Date.now()}`, name: '访客' };
}

export async function linkAccount(): Promise<void> {}
export async function unlinkAccount(): Promise<void> {}
