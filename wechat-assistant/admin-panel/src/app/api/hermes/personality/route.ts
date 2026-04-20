// GET /api/hermes/personality — 当前人格配置
// POST /api/hermes/personality — 更新人格
import { NextRequest, NextResponse } from 'next/server';
import { readPersonality } from '@/lib/hermes';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export async function GET() {
  try {
    const personality = readPersonality();
    if (!personality) {
      return NextResponse.json({ error: 'Personality file not found' }, { status: 404 });
    }
    return NextResponse.json(personality);
  } catch (error) {
    console.error('[API/hermes/personality/GET]', error);
    return NextResponse.json(
      { error: 'Failed to read personality', details: String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required' },
        { status: 400 },
      );
    }

    const soulPath = join(homedir(), '.hermes', 'SOUL.md');

    // Backup first
    if (existsSync(soulPath)) {
      const backup = readFileSync(soulPath, 'utf-8');
      const backupPath = soulPath + '.bak';
      writeFileSync(backupPath, backup, 'utf-8');
    }

    writeFileSync(soulPath, content, 'utf-8');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API/hermes/personality/POST]', error);
    return NextResponse.json(
      { error: 'Failed to update personality', details: String(error) },
      { status: 500 },
    );
  }
}
