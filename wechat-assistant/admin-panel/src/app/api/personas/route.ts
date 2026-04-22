// ============================================
// Personas API — Persona 管理
// ============================================
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loadAllPersonas, clearPersonaCache } from '@/lib/persona-registry';
import { BUILTIN_PERSONAS } from '@/lib/persona-registry';

// GET /api/personas — 获取所有 Persona
export async function GET() {
  try {
    // 从数据库读自定义 Persona
    const dbPersonas = await db.persona.findMany({
      where: { isBuiltIn: false },
      orderBy: { createdAt: 'desc' },
    });

    // 从 JSON 文件读内置 Persona
    let builtinPersonas: unknown[] = [];
    try {
      builtinPersonas = await loadAllPersonas();
    } catch {
      // 文件不存在时跳过
    }

    return NextResponse.json({
      builtin: builtinPersonas,
      custom: dbPersonas,
      all: [...builtinPersonas, ...dbPersonas],
    });
  } catch (error) {
    console.error('[API/personas/GET]', error);
    return NextResponse.json({ builtin: [], custom: [], all: [] });
  }
}

// POST /api/personas — 创建/导入自定义 Persona
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slug, config } = body;

    if (!name || !slug || !config) {
      return NextResponse.json(
        { error: 'name, slug, config are required' },
        { status: 400 },
      );
    }

    // 检查 slug 是否冲突
    if (BUILTIN_PERSONAS.includes(slug as never)) {
      return NextResponse.json(
        { error: `Slug "${slug}" conflicts with built-in persona` },
        { status: 409 },
      );
    }

    const persona = await db.persona.create({
      data: {
        name,
        slug,
        config: typeof config === 'string' ? config : JSON.stringify(config),
        source: 'custom',
        isBuiltIn: false,
      },
    });

    // 清除缓存
    clearPersonaCache();

    return NextResponse.json({ persona }, { status: 201 });
  } catch (error) {
    console.error('[API/personas/POST]', error);
    return NextResponse.json({ error: 'Failed to create persona' }, { status: 500 });
  }
}
