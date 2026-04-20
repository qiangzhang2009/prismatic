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
    return NextResponse.json(
      { error: 'Failed to read Hermes stats', details: String(error) },
      { status: 500 },
    );
  }
}
