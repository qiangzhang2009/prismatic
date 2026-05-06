/**
 * GET /api/admin/debate — 获取辩论配置和状态
 * POST /api/admin/debate/config — 设置临时辩论计划
 * DELETE /api/admin/debate/config — 清除临时计划
 * POST /api/admin/debate/trigger — 手动触发辩论
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { authenticateAdminRequest } from '@/lib/user-management';
import { getDebateByDate, getRecentDebates, runDailyDebate } from '@/lib/debate-arena-engine';
import {
  DEBATE_SAFE_TOPICS,
  DEBATE_TCM_INTERNATIONAL_TOPICS,
  isTCMInternationalPeriod,
} from '@/lib/constants';

function getSql(): NeonQueryFunction<false, false> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL not set');
  // eslint-disable-next-line
  return neon(connectionString) as NeonQueryFunction<false, false>;
}

interface DebateConfig {
  id: number;
  topics: string[];
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
}

// 获取临时辩论配置
async function getDebateConfig(): Promise<DebateConfig | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT * FROM prismatic_debate_config
      ORDER BY id DESC
      LIMIT 1
    `;
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as any;
    return {
      id: row.id,
      topics: typeof row.topics === 'string' ? JSON.parse(row.topics) : row.topics || [],
      start_date: row.start_date,
      end_date: row.end_date,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      created_by: row.created_by,
    };
  } catch {
    return null;
  }
}

// 保存临时辩论配置
async function saveDebateConfig(params: {
  topics: string[];
  startDate: string;
  endDate: string;
  adminId: string;
}): Promise<DebateConfig> {
  const sql = getSql();
  const topicsJson = JSON.stringify(params.topics);

  // 删除旧的配置
  await sql`DELETE FROM prismatic_debate_config`;

  // 插入新配置
  const rows = await sql`
    INSERT INTO prismatic_debate_config (topics, start_date, end_date, created_by)
    VALUES (${topicsJson}::jsonb, ${params.startDate}, ${params.endDate}, ${params.adminId})
    RETURNING *
  `;

  const row = (Array.isArray(rows) ? rows : [])[0] as any;
  return {
    id: row.id,
    topics: typeof row.topics === 'string' ? JSON.parse(row.topics) : row.topics || [],
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    created_by: row.created_by,
  };
}

// 清除临时配置
async function clearDebateConfig(): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM prismatic_debate_config`;
}

// 检查当前是否有临时配置生效
function isCustomConfigActive(config: DebateConfig | null): boolean {
  if (!config) return false;
  const now = new Date();
  const start = new Date(config.start_date);
  const end = new Date(config.end_date);
  return now >= start && now <= end;
}

// 获取当前应使用的辩论话题
function getCurrentTopic(config: DebateConfig | null): string {
  if (!config) {
    if (isTCMInternationalPeriod()) {
      const dayOfWeek = new Date().getDay();
      const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return DEBATE_TCM_INTERNATIONAL_TOPICS[dayIndex % DEBATE_TCM_INTERNATIONAL_TOPICS.length] ?? DEBATE_TCM_INTERNATIONAL_TOPICS[0];
    }
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const safeTopics = DEBATE_SAFE_TOPICS.filter(t => !t.toLowerCase().includes('中医'));
    return safeTopics[dayOfYear % safeTopics.length] ?? 'AI 会取代大部分人类工作吗？';
  }
  if (isCustomConfigActive(config)) {
    // 按星期选择话题
    const dayOfWeek = new Date().getDay(); // 0=周日
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=周一
    return config.topics[dayIndex % config.topics.length] ?? config.topics[0];
  }
  if (isTCMInternationalPeriod()) {
    const dayOfWeek = new Date().getDay();
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return DEBATE_TCM_INTERNATIONAL_TOPICS[dayIndex % DEBATE_TCM_INTERNATIONAL_TOPICS.length] ?? DEBATE_TCM_INTERNATIONAL_TOPICS[0];
  }
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const safeTopics = DEBATE_SAFE_TOPICS.filter(t => !t.toLowerCase().includes('中医'));
  return safeTopics[dayOfYear % safeTopics.length] ?? 'AI 会取代大部分人类工作吗？';
}

// 检查表是否存在
async function ensureConfigTable(): Promise<void> {
  const sql = getSql();
  try {
    await sql`CREATE TABLE IF NOT EXISTS prismatic_debate_config (
      id SERIAL PRIMARY KEY,
      topics JSONB NOT NULL DEFAULT '[]',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;
  } catch {
    // 表可能已存在
  }
}

// GET — 获取辩论配置和状态
export async function GET(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureConfigTable();
    const config = await getDebateConfig();
    const todayDebate = await getDebateByDate();
    const recentDebates = await getRecentDebates(7);
    const customActive = isCustomConfigActive(config);
    const tcmActive = isTCMInternationalPeriod();

    return NextResponse.json({
      config,
      customActive,
      tcmActive,
      currentTopic: getCurrentTopic(config),
      todayDebate,
      recentDebates,
      availableTopics: DEBATE_SAFE_TOPICS,
      suggestedTopics: [
        '传统医学与现代医学的融合可能性',
        'AI 对就业市场的深远影响',
        '社交媒体对青少年心理健康的影响',
        '气候变化：个人行动 vs 政策变革',
        '知识付费的长期价值',
        '远程工作文化的利弊',
        '基因编辑的伦理边界',
        '虚拟现实社交的未来',
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin/Debate]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST — 设置临时辩论计划 或 手动触发辩论
export async function POST(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    await ensureConfigTable();

    if (action === 'config') {
      // 设置临时辩论计划
      const { topics, startDate, endDate } = body;
      if (!Array.isArray(topics) || topics.length === 0) {
        return NextResponse.json({ error: 'topics 必须是非空数组' }, { status: 400 });
      }
      if (!startDate || !endDate) {
        return NextResponse.json({ error: '需要提供 startDate 和 endDate' }, { status: 400 });
      }

      const config = await saveDebateConfig({
        topics,
        startDate,
        endDate,
        adminId,
      });

      return NextResponse.json({
        success: true,
        message: '临时辩论计划已保存',
        config,
      });
    }

    if (action === 'clear') {
      // 清除临时计划
      await clearDebateConfig();
      return NextResponse.json({
        success: true,
        message: '临时辩论计划已清除',
      });
    }

    if (action === 'trigger') {
      // 手动触发辩论
      const { topic } = body;
      const result = await runDailyDebate(topic);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '辩论已开始',
        debateId: result.debateId,
        topic: result.topic,
      });
    }

    return NextResponse.json({ error: '未知 action' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin/Debate POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — 清除临时辩论计划
export async function DELETE(req: NextRequest) {
  let adminId: string | null = null;
  try {
    adminId = await authenticateAdminRequest(req);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await ensureConfigTable();
    await clearDebateConfig();
    return NextResponse.json({
      success: true,
      message: '临时辩论计划已清除',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Admin/Debate DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
