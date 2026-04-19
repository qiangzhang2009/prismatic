/**
 * Capacity monitoring cron job
 * Runs daily at 9:00 AM to check storage usage and alert if needed.
 * Triggered by Vercel Cron (configured in vercel.json).
 *
 * Path: /api/cron/capacity-check
 * Schedule: 0 9 * * * (daily at 9 AM)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCapacityReport } from '@/lib/admin/capacity-monitor';

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const report = await getCapacityReport();

    if (report.storage.status === 'red' || report.storage.status === 'yellow') {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const subject = `[棱镜] 数据库存储${report.storage.status === 'red' ? '紧急' : '预警'} — ${(report.storage.usedPercent * 100).toFixed(1)}%`;
        const body = [
          `棱镜数据库存储预警`,
          ``,
          `使用率：${(report.storage.usedPercent * 100).toFixed(1)}%`,
          `已用空间：${report.storage.usedBytes} bytes`,
          `消息总数：${report.storage.messageCount}`,
          `对话总数：${report.storage.conversationCount}`,
          `活跃用户：${report.storage.userCount}`,
          report.storage.daysUntilFull !== null ? `预计耗尽：${report.storage.daysUntilFull} 天` : '',
          ``,
          `建议：${report.upgradeRecommendation}`,
        ].filter(Boolean).join('\n');

        // Try to send email via Resend (if configured)
        try {
          const resendApiKey = process.env.RESEND_API_KEY;
          if (resendApiKey) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: 'Prismatic <noreply@prismatic.app>',
                to: [adminEmail],
                subject,
                text: body,
              }),
            });
          }
        } catch (emailErr) {
          console.warn('[Cron/Capacity] Failed to send alert email:', emailErr);
        }

        console.warn(
          `[Cron/Capacity] Alert triggered: ${report.storage.status} — ` +
          `${(report.storage.usedPercent * 100).toFixed(1)}% — ` +
          `预计 ${report.storage.daysUntilFull} 天耗尽`
        );
      }
    }

    return NextResponse.json({
      ok: true,
      storageStatus: report.storage.status,
      usedPercent: report.storage.usedPercent,
      daysUntilFull: report.storage.daysUntilFull,
      generatedAt: report.generatedAt,
    });
  } catch (err) {
    console.error('[Cron/Capacity] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
