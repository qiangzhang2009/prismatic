/**
 * TCM Chat API — 多人物中医AI助手
 * Node.js Runtime (60s timeout)
 *
 * Features:
 *   - 基于tcm-personas.ts的人物人格注入
 *   - 古籍RAG检索（症状 → 古籍引证）
 *   - 中西医对照输出
 *   - 医疗免责声明
 *   - 对话持久化（写入 conversations + messages 表，与人物库对话一致）
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createLLMProviderWithKey } from '@/lib/llm';
import { TCM_PERSONAS } from '@/lib/tcm-personas';
import { buildRAGContext } from '@/lib/tcm-rag';
import { authenticateRequest } from '@/lib/user-management';
import { Pool } from '@neondatabase/serverless';

export const runtime = 'nodejs';

interface TCMChatRequest {
  personaId: string;
  message: string;
  language?: 'zh' | 'en' | 'auto';
  includeModernMedicine?: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;  // 新增：前端传入以支持多轮对话
}

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

function buildTCMSystemPrompt(
  personaId: string,
  language: 'zh' | 'en' | 'auto',
  ragContext?: { context: string; citations: unknown[]; note: string }
): string {
  const persona = TCM_PERSONAS[personaId];
  if (!persona) {
    throw new Error(`TCM Persona not found: ${personaId}`);
  }

  const langLabel = language === 'en' ? 'English' : language === 'auto' ? 'English/中文' : '中文';

  const ragSection = ragContext?.context
    ? `【古籍原文引证】（来自RAG检索）

${ragContext.context}

${ragContext.note}
`
    : '';

  return `你是${persona.nameZh}，一位中医医学家。

【人物简介】${persona.briefZh}

【核心思维模型】
${persona.mentalModels.map((m, i) => `${i + 1}. ${m.nameZh}（${m.name}）`).join('\n')}

【价值观】
${persona.values.map(v => `· ${v.nameZh}`).join('\n')}

${ragSection}
【输出格式要求】
请用${langLabel}回答，严格按以下结构组织：

## 一、辨证分析
根据用户描述的症状，从中医角度进行分析和辨证。

## 二、古籍引证
${ragContext?.context ? '基于以上检索到的古籍原文，引用相关段落作为支撑。格式：《书名》原文引用。' : '引用相关中医古籍原文作为支撑（你可以基于古籍知识给出合理引用）。格式：《书名》原文引用。'}

## 三、日常调养建议
基于中医理论给出日常调养建议，包括饮食、起居、情志等方面。

## 四、现代医学参考
${language === 'en' || language === 'auto' ? 'Provide a brief modern medicine perspective on the symptoms described.' : '简要提供现代医学视角的参考（注明仅供参考）。'}

---
⚕️ 本回答由 ${persona.nameZh} 提供

⚠️ 【重要免责声明】
以上内容仅供参考和学习，不能替代专业医生的诊断和治疗。如有健康问题，请立即咨询有执照的医疗专业人员。This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.`;
}

/**
 * 生成对话标题（首次消息时）
 */
function generateTCMTitle(personaName: string, firstMessage: string): string {
  const summary = firstMessage.slice(0, 20).replace(/\n/g, ' ').trim();
  return `向${personaName}提问：${summary}${summary.length >= 20 ? '...' : ''}`;
}

async function callLLM(
  apiKey: string | undefined,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const llm = createLLMProviderWithKey('deepseek', apiKey);
  const response = await llm.chat({
    model: 'deepseek-chat',
    messages: messages as Parameters<typeof llm.chat>[0]['messages'],
    temperature: 0.7,
    maxTokens: 2500,
  });
  return { content: response.content, usage: response.usage };
}

/**
 * 持久化 TCM 对话到数据库。
 * 复用人物库 chat API 的 persistConversation 模式，但独立实现以避免循环导入。
 */
async function persistTCMConversation(
  userId: string,
  conversationId: string,
  personaId: string,
  personaName: string,
  messages: Array<{ role: string; content: string; tokensInput?: number; tokensOutput?: number; apiCost?: number }>,
  ragMetadata?: { citations: unknown[]; chunkCount: number } | null
) {
  const pool = getPool();
  let poolEnded = false;
  const endPool = async () => {
    if (!poolEnded) {
      poolEnded = true;
      try { await pool.end(); } catch { /* ignore */ }
    }
  };

  const totalTokens = messages.reduce((sum, m) => sum + (m.tokensInput ?? 0) + (m.tokensOutput ?? 0), 0);
  const totalCost = messages.reduce((sum, m) => sum + (m.apiCost ?? 0), 0);

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 检查对话归属权
      const existingConv = await client.query(
        `SELECT "userId" FROM conversations WHERE id = $1 LIMIT 1`,
        [conversationId]
      );
      const existingOwner = existingConv.rows[0]?.userId;
      const actualConvId = (existingOwner && existingOwner !== userId)
        ? nanoid()
        : conversationId;

      // Upsert conversation
      await client.query(`
        INSERT INTO conversations (id, "userId", title, type, mode, participants, archived, tags,
                               "messageCount", "totalTokens", "totalCost", "personaIds", "createdAt", "updatedAt")
        VALUES ($1, $2, NULL, 'TCM', 'tcm-assistant', $3::text[], false, '{}'::text[],
                $4, $5, $6, $3::text[], NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          mode = EXCLUDED.mode,
          participants = EXCLUDED.participants,
          "personaIds" = EXCLUDED."personaIds",
          "totalTokens" = EXCLUDED."totalTokens",
          "totalCost" = EXCLUDED."totalCost",
          "updatedAt" = NOW()
      `, [
        actualConvId,
        userId,
        JSON.stringify([personaId]),
        messages.length,
        totalTokens,
        totalCost
      ]);

      // 如果 title 为空（首次消息），生成标题
      const titleResult = await client.query(
        `SELECT title FROM conversations WHERE id = $1`,
        [actualConvId]
      );
      if (!titleResult.rows[0]?.title) {
        const firstUserMsg = messages.find(m => m.role === 'user');
        if (firstUserMsg) {
          const title = generateTCMTitle(personaName, firstUserMsg.content);
          await client.query(
            `UPDATE conversations SET title = $1 WHERE id = $2`,
            [title, actualConvId]
          );
        }
      }

      // 批量插入消息
      const validMessages: {
        id: string; role: string; content: string;
        personaId: string | null; modelUsed: string | null;
        tokensInput: number | null; tokensOutput: number | null;
        apiCost: number | null; metadata: string | null; ts: Date;
      }[] = [];

      for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;
        const resolvedRole = msg.role === 'agent' ? 'assistant'
          : msg.role === 'user' || msg.role === 'assistant' ? msg.role
          : 'user';

        // 为 assistant 消息附加 RAG metadata
        let metadata: string | null = null;
        if (resolvedRole === 'assistant' && ragMetadata) {
          metadata = JSON.stringify({ rag: ragMetadata, mode: 'tcm-assistant' });
        }

        validMessages.push({
          id: nanoid(),
          role: resolvedRole,
          content: msg.content,
          personaId: resolvedRole === 'assistant' ? personaId : null,
          modelUsed: 'deepseek-chat',
          tokensInput: msg.tokensInput ?? null,
          tokensOutput: msg.tokensOutput ?? null,
          apiCost: msg.apiCost ?? null,
          metadata,
          ts: new Date(),
        });
      }

      if (validMessages.length > 0) {
        const rows: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (const msg of validMessages) {
          rows.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`);
          params.push(
            msg.id, actualConvId, userId, msg.role, msg.content,
            msg.personaId, msg.modelUsed, msg.tokensInput, msg.tokensOutput,
            msg.apiCost, msg.metadata, msg.ts
          );
        }

        await client.query(`
          INSERT INTO messages (id, "conversationId", "userId", role, content,
                               "personaId", "modelUsed", "tokensInput", "tokensOutput",
                               "apiCost", metadata, "createdAt")
          VALUES ${rows.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content
        `, params);
      }

      // 同步 messageCount
      const msgCountResult = await client.query(
        `SELECT COUNT(*) as cnt FROM messages WHERE "conversationId" = $1`,
        [actualConvId]
      );
      const realMsgCount = parseInt(msgCountResult.rows[0]?.cnt ?? '0', 10);
      const lastTs = validMessages.length > 0
        ? new Date(Math.max(...validMessages.map(m => m.ts.getTime())))
        : new Date();
      await client.query(
        `UPDATE conversations SET "updatedAt" = $1, "messageCount" = $2 WHERE id = $3`,
        [lastTs, realMsgCount, actualConvId]
      );

      await client.query('COMMIT');
      client.release();
      await endPool();
      return { id: actualConvId, inserted: validMessages.length };
    } catch (innerErr) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw innerErr;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[persistTCMConversation] Error:', errMsg);
    await endPool();
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: TCMChatRequest = await req.json();
    const { personaId, message, language = 'zh', includeModernMedicine = true, history = [], conversationId } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!personaId || !TCM_PERSONAS[personaId]) {
      return NextResponse.json(
        { error: `Invalid personaId. Available: ${Object.keys(TCM_PERSONAS).join(', ')}` },
        { status: 400 }
      );
    }

    // Auth
    let userId = 'anonymous';
    try {
      const uid = await authenticateRequest(req);
      if (uid) userId = uid;
    } catch {
      // Continue anonymous
    }

    // 生成或使用传入的 conversationId
    const convId = conversationId || nanoid();

    // RAG Retrieval
    let ragContext = null;
    let ragMetadata: { citations: unknown[]; chunkCount: number } | null = null;
    try {
      ragContext = await buildRAGContext(message, 4);
      if (ragContext) {
        ragMetadata = {
          citations: ragContext.citations,
          chunkCount: ragContext.citations.length,
        };
      }
    } catch (e) {
      console.warn('[TCM Chat] RAG retrieval failed, proceeding without it:', e);
    }

    const systemPrompt = buildTCMSystemPrompt(personaId, language, ragContext ?? undefined);

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Append history (last 10 messages)
    for (const msg of history.slice(-10)) {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }

    conversationMessages.push({ role: 'user', content: message });

    const llmResult = await callLLM(undefined, conversationMessages);
    const response = llmResult.content;
    const usage = llmResult.usage;

    // 估算成本
    const model = 'deepseek-chat';
    const inputRate = 0.014;  // $0.014 / 1K tokens
    const outputRate = 0.014;
    const cost = usage
      ? ((usage.promptTokens / 1000) * inputRate + (usage.completionTokens / 1000) * outputRate)
      : 0;

    // 持久化对话
    const persistResult = await persistTCMConversation(
      userId,
      convId,
      personaId,
      TCM_PERSONAS[personaId]?.nameZh || personaId,
      [
        { role: 'user', content: message },
        {
          role: 'assistant',
          content: response,
          tokensInput: usage?.promptTokens,
          tokensOutput: usage?.completionTokens,
          apiCost: cost,
        },
      ],
      ragMetadata
    );

    if (!persistResult) {
      console.warn('[TCM Chat] Failed to persist conversation, continuing anyway');
    }

    return NextResponse.json({
      conversationId: persistResult?.id || convId,
      personaId,
      personaName: TCM_PERSONAS[personaId]?.nameZh,
      response,
      rag: ragMetadata ? {
        citations: ragMetadata.citations,
        note: ragContext?.note,
        chunkCount: ragMetadata.chunkCount,
      } : null,
      disclaimer: '以上内容仅供参考和学习，不能替代专业医生的诊断和治疗。如有健康问题，请咨询有执照的医疗专业人员。This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.',
    });
  } catch (err) {
    console.error('[TCM Chat API] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const personas = Object.values(TCM_PERSONAS).map((p) => ({
    id: p.id,
    name: p.name,
    nameZh: p.nameZh,
    domain: p.domain,
    tagline: p.tagline,
    taglineZh: p.taglineZh,
    accentColor: p.accentColor,
    gradientFrom: p.gradientFrom,
    gradientTo: p.gradientTo,
    brief: p.brief,
    briefZh: p.briefZh,
    mentalModels: p.mentalModels.map((m) => ({ name: m.name, nameZh: m.nameZh })),
    distillation: p.distillation,
  }));

  let ragStats = null;
  try {
    const { getRAGStats } = await import('@/lib/tcm-rag');
    ragStats = await getRAGStats();
  } catch {
    ragStats = { ready: false, error: 'RAG not initialized' };
  }

  return NextResponse.json({ personas, total: personas.length, rag: ragStats });
}
