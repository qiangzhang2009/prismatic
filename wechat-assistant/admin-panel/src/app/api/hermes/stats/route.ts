// GET /api/hermes/stats — 实时统计数据
import { NextResponse } from 'next/server';
import { computeStats, readGatewayState } from '@/lib/hermes';

export async function GET() {
  try {
    const stats = computeStats();
    const gateway = readGatewayState();

    return NextResponse.json({
      stats,
      gateway,
      hermesPath: process.env.HERMES_DATA_PATH || '~/.hermes',
      isLocal: true,
    });
  } catch (error) {
    console.error('[API/hermes/stats]', error);
    return NextResponse.json({
      stats: {
        totalSessions: 0,
        totalMessages: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        estimatedCostUsd: 0,
        activePlatforms: [],
        connectedPlatforms: [],
        disconnectedPlatforms: [],
        sessions: [],
        lastActivity: null,
      },
      gateway: null,
      hermesPath: process.env.HERMES_DATA_PATH || '~/.hermes',
      isLocal: false,
    });
  }
}
