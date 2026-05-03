/**
 * TCM Chat API — 多人物中医AI助手
 * Node.js Runtime (60s timeout)
 *
 * Features:
 *   - 基于tcm-personas.ts的人物人格注入
 *   - 古籍RAG检索（症状 → 古籍引证）
 *   - 中西医对照输出
 *   - 医疗免责声明
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLLMProviderWithKey } from '@/lib/llm';
import { TCM_PERSONAS } from '@/lib/tcm-personas';
import { buildRAGContext, retrieve } from '@/lib/tcm-rag';
import { authenticateRequest } from '@/lib/user-management';

export const runtime = 'nodejs';

interface TCMChatRequest {
  personaId: string;
  message: string;
  language?: 'zh' | 'en' | 'auto';
  includeModernMedicine?: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
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
): Promise<string> {
  const llm = createLLMProviderWithKey('deepseek', apiKey);
  const response = await llm.chat({
    model: 'deepseek-chat',
    messages: messages as Parameters<typeof llm.chat>[0]['messages'],
    temperature: 0.7,
    maxTokens: 2500,
  });
  return response.content;
}

export async function POST(req: NextRequest) {
  try {
    const body: TCMChatRequest = await req.json();
    const { personaId, message, language = 'zh', includeModernMedicine = true, history = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!personaId || !TCM_PERSONAS[personaId]) {
      return NextResponse.json(
        { error: `Invalid personaId. Available: ${Object.keys(TCM_PERSONAS).join(', ')}` },
        { status: 400 }
      );
    }

    // Auth (optional — allow unauthenticated for demo)
    let userApiKey: string | undefined;
    try {
      const userId = await authenticateRequest(req);
      if (userId) {
        userApiKey = undefined;
      }
    } catch {
      // Continue unauthenticated
    }

    // ── RAG Retrieval ────────────────────────────────────────────────────
    let ragContext = null;
    try {
      ragContext = await buildRAGContext(message, 4);
    } catch (e) {
      console.warn('[TCM Chat] RAG retrieval failed, proceeding without it:', e);
    }

    const systemPrompt = buildTCMSystemPrompt(personaId, language, ragContext ?? undefined);

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Append history (last 10 messages for context window)
    for (const msg of history.slice(-10)) {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }

    conversationMessages.push({ role: 'user', content: message });

    const response = await callLLM(userApiKey, conversationMessages);

    return NextResponse.json({
      personaId,
      personaName: TCM_PERSONAS[personaId]?.nameZh,
      response,
      rag: ragContext ? {
        citations: ragContext.citations,
        note: ragContext.note,
        chunkCount: ragContext.citations.length,
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
  // Return available personas
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

  // Also return RAG stats
  let ragStats = null;
  try {
    const { getRAGStats } = await import('@/lib/tcm-rag');
    ragStats = await getRAGStats();
  } catch {
    ragStats = { ready: false, error: 'RAG not initialized' };
  }

  return NextResponse.json({ personas, total: personas.length, rag: ragStats });
}
