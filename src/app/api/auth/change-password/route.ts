/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession, verifyPassword, changePassword } from '@/lib/user-management';

export async function POST(req: NextRequest) {
  const token = req.cookies.get('prismatic_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const session = await getSession(token);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: '新密码长度不能少于4位' }, { status: 400 });
    }

    const valid = await verifyPassword(session.userId, currentPassword);
    if (!valid) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 400 });
    }

    await changePassword(session.userId, newPassword);
    return NextResponse.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
