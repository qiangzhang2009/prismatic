/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, changePassword, authenticateRequest } from '@/lib/user-management';

export async function POST(req: NextRequest) {
  const userId = await authenticateRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: '新密码长度不能少于4位' }, { status: 400 });
    }

    const valid = await verifyPassword(userId, currentPassword);
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 400 });
    }

    await changePassword(userId, newPassword);
    return NextResponse.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
