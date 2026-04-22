// GET /api/hermes/channels — 平台通道列表
import { NextResponse } from 'next/server';
import { readChannelDirectory } from '@/lib/hermes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const channels = readChannelDirectory();
    return NextResponse.json(channels);
  } catch (error) {
    console.error('[API/hermes/channels]', error);
    return NextResponse.json({ updated_at: '', platforms: {} });
  }
}
