/**
 * TCM Chat API — 多人物中医AI助手
 * Node.js Runtime (60s timeout)
 *
 * Features:
 *   - 基于tcm-personas.ts的人物人格注入
 *   - 古籍RAG检索（症状 → 古籍引证）
 *   - 中西医对照输出
 *   - 医疗免责声明
 *   - 对话持久化：复用 chat API 的 persistConversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createLLMProviderWithKey } from '@/lib/llm';
import { TCM_PERSONAS } from '@/lib/tcm-personas';
import { buildRAGContext } from '@/lib/tcm-rag';
import { authenticateRequest } from '@/lib/user-management';
import { persistConversation } from '@/app/api/chat/route';
import { Pool } from '@neondatabase/serverless';

export const runtime = 'nodejs';

interface TCMChatRequest {
  personaId: string;
  message: string;
  language?: 'zh' | 'en' | 'auto';
  includeModernMedicine?: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
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

    // Auth — 强制登录（与 chat API 一致）
    const userId = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: '请先登录后再使用中医对话功能' }, { status: 401 });
    }

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
    const inputRate = 0.014;  // $0.014 / 1K tokens
    const outputRate = 0.014;
    const cost = usage
      ? ((usage.promptTokens / 1000) * inputRate + (usage.completionTokens / 1000) * outputRate)
      : 0;
    const totalTokens = (usage?.promptTokens ?? 0) + (usage?.completionTokens ?? 0);

    // 构建消息对象（格式与 chat API 的 persistConversation 一致）
    const assistantMetadata = ragMetadata
      ? JSON.stringify({ rag: ragMetadata, mode: 'tcm-assistant' })
      : JSON.stringify({ mode: 'tcm-assistant' });

    const chatMessages = [
      {
        id: nanoid(),
        role: 'user',
        content: message,
        personaId: null,
        modelUsed: null,
        tokensInput: null,
        tokensOutput: null,
        apiCost: null,
        metadata: null,
        timestamp: new Date(),
      },
      {
        id: nanoid(),
        role: 'assistant',
        content: response,
        personaId: personaId,
        modelUsed: 'deepseek-chat',
        tokensInput: usage?.promptTokens ?? null,
        tokensOutput: usage?.completionTokens ?? null,
        apiCost: cost,
        metadata: assistantMetadata,
        timestamp: new Date(),
      },
    ];

    // 复用 chat API 的 persistConversation（原子事务：conversation + messages）
    const persistResult = await persistConversation(
      userId,
      convId,
      'tcm-assistant',
      'TCM',
      [personaId],
      chatMessages,
      totalTokens,
      cost
    );

    if (!persistResult) {
      console.error(`[TCM Chat] persistConversation failed for conv=${convId}`);
      return NextResponse.json(
        { error: '抱歉，消息未能保存。请稍后重试。' },
        { status: 500 }
      );
    }

    // 补充 title（persistConversation 不处理 title）
    const pool = getPool();
    const titleResult = await pool.query(
      `SELECT title FROM conversations WHERE id = $1`,
      [convId]
    );
    if (!titleResult.rows[0]?.title) {
      const title = `向${TCM_PERSONAS[personaId]?.nameZh || personaId}提问：${message.slice(0, 20).replace(/\n/g, ' ').trim()}${message.length >= 20 ? '...' : ''}`;
      await pool.query(`UPDATE conversations SET title = $1 WHERE id = $2`, [title, convId]);
    }
    await pool.end();

    return NextResponse.json({
      conversationId: convId,
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
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[TCM Chat] Error:', errMsg);
    return NextResponse.json(
      { error: 'Internal server error', detail: errMsg },
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
