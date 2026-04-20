// ============================================
// Tasks API — 定时任务管理
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parseExpression } from 'cron-parser';

// GET /api/tasks — 获取定时任务
export async function GET() {
  try {
    const tasks = await db.scheduledTask.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { taskLogs: true } },
      },
    });

    // 计算下次执行时间
    const tasksWithNextRun = tasks.map((task) => {
      try {
        const interval = parseExpression(task.cron);
        const next = interval.next().toDate();
        return { ...task, nextRun: next.toISOString() };
      } catch {
        return { ...task, nextRun: null };
      }
    });

    return NextResponse.json({ tasks: tasksWithNextRun });
  } catch (error) {
    console.error('[API/tasks/GET]', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks — 创建定时任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, cron, groups, personaId, template, enabled } = body;

    if (!name || !cron || !personaId) {
      return NextResponse.json(
        { error: 'name, cron, personaId are required' },
        { status: 400 },
      );
    }

    // 验证 cron 表达式
    try {
      parseExpression(cron);
    } catch {
      return NextResponse.json(
        { error: 'Invalid cron expression' },
        { status: 400 },
      );
    }

    // 计算下次执行时间
    let nextRun: Date | null = null;
    try {
      const interval = parseExpression(cron);
      nextRun = interval.next().toDate();
    } catch {
      // 忽略
    }

    const task = await db.scheduledTask.create({
      data: {
        name,
        cron,
        groups: JSON.stringify(groups ?? []),
        personaId,
        template: template ?? '',
        enabled: enabled ?? true,
        nextRun,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('[API/tasks/POST]', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
