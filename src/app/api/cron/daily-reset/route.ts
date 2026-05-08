/**
 * Daily Points Reset Cron API
 * 
 * 定时重置所有用户的每日积分
 * 
 * 配置方式：
 * 1. Vercel Cron Jobs: vercel.json 添加
 * 2. 外部定时任务: curl 或 cron job 调用此 API
 * 
 * 安全：需要 CRON_SECRET 环境变量验证请求来源
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetDailyCredits, DAILY_CREDITS } from '@/lib/points-service';

export const runtime = 'nodejs';

// 允许的来源（Vercel Cron Jobs 会设置特定的 header）
const ALLOWED_SOURCES = ['vercel', 'cron'];
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  // 验证请求来源
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron') || req.headers.get('x-cron-source');
  const source = cronHeader || (authHeader ? 'external' : 'unknown');

  // 如果配置了 CRON_SECRET，验证它
  if (CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      console.warn(`[Daily Reset] Unauthorized request from ${source}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else {
    // 没有配置 secret，只允许已知的 cron 来源
    if (!ALLOWED_SOURCES.includes(source)) {
      console.warn(`[Daily Reset] Request from unknown source: ${source}`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const startTime = Date.now();
    console.log(`[Daily Reset] Starting daily credits reset at ${new Date().toISOString()}`);

    const result = await resetDailyCredits();

    const duration = Date.now() - startTime;
    console.log(`[Daily Reset] Completed in ${duration}ms, reset ${result.resetCount} users`);

    return NextResponse.json({
      success: true,
      resetCount: result.resetCount,
      dailyCredits: DAILY_CREDITS,
      duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Daily Reset] Error: ${errMsg}`);
    return NextResponse.json({
      success: false,
      error: errMsg,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET 请求返回状态信息
export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron') || req.headers.get('x-cron-source');
  
  // 验证来源
  if (!ALLOWED_SOURCES.includes(cronHeader || '') && !CRON_SECRET) {
    return NextResponse.json({
      endpoint: 'Daily Points Reset',
      method: 'POST',
      description: '重置所有用户的每日积分',
      dailyCredits: DAILY_CREDITS,
      requiredHeaders: CRON_SECRET ? { 'Authorization': 'Bearer <CRON_SECRET>' } : { 'x-vercel-cron': '1' },
    });
  }

  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
