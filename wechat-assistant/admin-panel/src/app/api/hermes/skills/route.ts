// GET /api/hermes/skills — 当前加载的 Skills
import { NextResponse } from 'next/server';
import { readSkills } from '@/lib/hermes';

export async function GET() {
  try {
    const skills = readSkills();
    return NextResponse.json({ skills, count: skills.length });
  } catch (error) {
    console.error('[API/hermes/skills]', error);
    return NextResponse.json(
      { error: 'Failed to read skills', details: String(error) },
      { status: 500 },
    );
  }
}
