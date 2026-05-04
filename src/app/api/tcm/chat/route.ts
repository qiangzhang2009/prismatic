/**
 * TCM Chat API — 多人物中医AI助手
 * Node.js Runtime (60s timeout)
 *
 * Features:
 *   - 基于tcm-personas.ts的人物人格注入
 *   - 智能判断：问病情 → 结构化医学回复；聊天/看法 → 自然对话
 *   - 古籍RAG检索（症状 → 古籍引证）
 *   - 中西医对照输出
 *   - 医疗免责声明
 *   - 对话持久化：复用 chat API 的 persistConversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { safeLLMCall } from '@/lib/llm-safe';
import { TCM_PERSONAS } from '@/lib/tcm-personas';
import { buildRAGContext } from '@/lib/tcm-rag';
import { authenticateRequest, getUserById } from '@/lib/user-management';
import { persistConversation } from '@/app/api/chat/route';
import { checkUserDailyLimit, recordMessage, getDailyMessageCount } from '@/lib/message-stats';
import { getPool } from '@/lib/db-pool';

export const runtime = 'nodejs';

interface TCMChatRequest {
  personaId: string;
  message: string;
  language?: 'zh' | 'en' | 'auto';
  includeModernMedicine?: boolean;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
}

function getDbPool() {
  return getPool();
}

function classifyUserIntent(message: string, history: Array<{ role: string; content: string }>): 'medical' | 'casual' {
  const text = (message || '').toLowerCase();
  const historyText = history.map(m => m.content).join(' ').toLowerCase();
  const combined = text + ' ' + historyText;

  const medicalKeywords = [
    '症状', '不舒服', '头痛', '发烧', '咳嗽', '肚子疼', '胃痛', '失眠',
    '感冒', '血压', '血糖', '血脂', '肝功能', '肾功能', '检查', '体检',
    '治疗', '吃药', '中药', '西药', '方子', '药方', '调理', '补气', '血虚',
    '阴虚', '阳虚', '湿气', '上火', '便秘', '腹泻', '月经', '怀孕',
    '怎么治', '怎么办', '吃什么', '怎么调理', '如何治疗', '怎么保养',
    'disease', 'symptom', 'medicine', 'treatment', 'diagnosis',
    'ill', 'pain', 'fever', 'cough', 'headache', 'stomach',
  ];

  const casualKeywords = [
    '你觉得', '你怎么看', '介绍一下', '讲讲', '说说什么', '有意思吗',
    '好玩吗', '有趣吗', '你认识', '历史', '生平', '思想', '哲学',
    '书推荐', '读什么', '习惯', '性格', '爱好', '你怎么看',
    'how do you think', 'what do you think about', 'introduce',
    'tell me about', 'your thoughts', 'opinion', 'interesting',
  ];

  let medicalScore = 0;
  for (const kw of medicalKeywords) {
    if (combined.includes(kw)) medicalScore++;
  }

  let casualScore = 0;
  for (const kw of casualKeywords) {
    if (combined.includes(kw)) casualScore++;
  }

  if (medicalScore > casualScore) return 'medical';
  return 'casual';
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')        // ## headers
    .replace(/\*\*(.+?)\*\*/g, '$1')     // **bold**
    .replace(/\*(.+?)\*/g, '$1')          // *italic*
    .replace(/_(.+?)_/g, '$1')            // _italic_
    .replace(/`(.+?)`/g, '$1')            // `code`
    .replace(/^\s*[-*+]\s+/gm, '· ')     // - bullet points
    .replace(/^\s*\d+\.\s+/gm, '')       // 1. numbered lists
    .trim();
}

function buildMedicalSystemPrompt(
  personaId: string,
  language: 'zh' | 'en' | 'auto',
  ragContext?: { context: string; citations: unknown[]; note: string }
): string {
  const persona = TCM_PERSONAS[personaId];
  if (!persona) throw new Error(`TCM Persona not found: ${personaId}`);
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

${ragSection}请用${langLabel}回答。当用户描述症状或询问病情时，严格按以下结构组织（不使用 ## 或 ** 等 Markdown 标记，纯文本）：

一、辨证分析
根据用户描述，从中医角度进行辨证分析。

二、古籍引证
${ragContext?.context ? '基于检索到的古籍原文，引用相关段落。格式：书名·原文引用。' : '引用相关中医古籍原文作为支撑。格式：书名·原文引用。'}

三、日常调养建议
基于中医理论给出饮食、起居、情志等方面的建议。

四、现代医学参考
${language === 'en' || language === 'auto' ? 'Provide a brief modern medicine perspective on the symptoms described.' : '简要提供现代医学视角的参考（注明仅供参考）。'}

---
⚕️ 本回答由 ${persona.nameZh} 提供

⚠️ 【重要免责声明】
以上内容仅供参考和学习，不能替代专业医生的诊断和治疗。如有健康问题，请立即咨询有执照的医疗专业人员。This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.`;
}

function buildCasualSystemPrompt(personaId: string, language: 'zh' | 'en' | 'auto'): string {
  const persona = TCM_PERSONAS[personaId];
  if (!persona) throw new Error(`TCM Persona not found: ${personaId}`);
  const langLabel = language === 'en' ? 'English' : language === 'auto' ? 'English/中文' : '中文';

  return `你是${persona.nameZh}，一位中医医学家。

【人物简介】${persona.briefZh}

【核心思维模型】
${persona.mentalModels.map((m, i) => `${i + 1}. ${m.nameZh}（${m.name}）`).join('\n')}

【价值观】
${persona.values.map(v => `· ${v.nameZh}`).join('\n')}

请用${langLabel}与用户自然对话。风格要求：
- 像与一位睿智的长者交谈，温暖、有见地
- 可以引经据典，但不要生硬
- 不要使用 ## 标题或 **加粗** 等 Markdown 格式，纯文本表达
- 回答简洁有力，不啰嗦
- 如果涉及健康话题，可以自然地带入中医视角

---
⚕️ 本回答由 ${persona.nameZh} 提供

⚠️ 【重要免责声明】
以上内容仅供参考和学习，不能替代专业医生的诊断和治疗。如有健康问题，请立即咨询有执照的医疗专业人员。This information is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.`;
}

async function callLLM(
  userId: string,
  userPlan: string,
  apiKey: string | undefined,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  const result = await safeLLMCall({
    userId,
    userPlan,
    messages: messages as Parameters<typeof safeLLMCall>[0]['messages'],
    apiKey,
    temperature: 0.7,
    maxTokens: 2500,
  });

  if (!result.success) {
    throw new Error(result.error || 'LLM call failed');
  }

  return { content: result.content || '', usage: result.usage };
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

    // 额度检查（与 chat API 一致）
    const user = await getUserById(userId);
    const userPlan = user?.plan ?? 'FREE';
    const userCredits = user?.credits ?? 0;
    const { allowed, current, limit, reason } = await checkUserDailyLimit(userId, userPlan, userCredits);
    if (!allowed) {
      // Always include serverDailyCount in error responses so frontend can sync
      let serverDailyCount: number | undefined;
      try {
        serverDailyCount = await getDailyMessageCount(userId);
      } catch (e) {
        console.error('[TCM 429] getDailyMessageCount failed:', e);
      }
      console.error(`[TCM 429] userId=${userId} plan=${userPlan} credits=${userCredits} current=${current} serverDailyCount=${serverDailyCount} limit=${limit} reason=${reason}`);
      return NextResponse.json({
        error: `今日对话次数已达上限（${limit}次/天），明天再来吧~`,
        code: 'DAILY_LIMIT_REACHED',
        current,
        limit,
        billingReason: reason,
        serverDailyCount,
      }, { status: 429 });
    }

    const convId = conversationId || nanoid();

    // 意图分类：判断是问病情还是聊天/看法
    const intent = classifyUserIntent(message, history);
    const isCasual = intent === 'casual';

    // RAG Retrieval（仅在医学问题时进行）
    let ragContext = null;
    let ragMetadata: { citations: unknown[]; chunkCount: number } | null = null;
    if (!isCasual) {
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
    }

    const systemPrompt = isCasual
      ? buildCasualSystemPrompt(personaId, language)
      : buildMedicalSystemPrompt(personaId, language, ragContext ?? undefined);

    const conversationMessages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Append history (last 10 messages)
    for (const msg of history.slice(-10)) {
      conversationMessages.push({ role: msg.role, content: msg.content });
    }

    conversationMessages.push({ role: 'user', content: message });

    const llmResult = await callLLM(userId, userPlan, undefined, conversationMessages);
    // 去除 Markdown 格式（##、** 等）
    const response = stripMarkdown(llmResult.content);
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
    // skipDailyCount=true：TCM 对话内容不计入每日额度，单独由 recordMessage 计数
    const persistResult = await persistConversation(
      userId,
      convId,
      'tcm-assistant',
      'TCM',
      [personaId],
      chatMessages,
      totalTokens,
      cost,
      true, // skipDailyCount
    );

    if (!persistResult) {
      console.error(`[TCM Chat] persistConversation failed for conv=${convId}`);
      return NextResponse.json(
        { error: '抱歉，消息未能保存。请稍后重试。' },
        { status: 500 }
      );
    }

    // ── 扣减积分（与 chat API 一致）─────────────────────────────────────────
    // 免费且有积分的用户扣减积分
    let creditsAfter = userCredits;
    if (userPlan === 'FREE' && userCredits > 0) {
      try {
        const { deductCredits } = await import('@/lib/billing/engine');
        const result = await deductCredits(userId, 1, {
          description: '中医对话消耗',
          conversationId: convId,
        });
        creditsAfter = result.newBalance;
      } catch (err) {
        console.error('[TCM Chat] Failed to deduct credits:', err);
      }
    }

    // 补充 title（persistConversation 不处理 title）
    const pool = getDbPool();
    const titleResult = await pool.query(
      `SELECT title FROM conversations WHERE id = $1`,
      [convId]
    );
    if (!titleResult.rows[0]?.title) {
      const title = `向${TCM_PERSONAS[personaId]?.nameZh || personaId}提问：${message.slice(0, 20).replace(/\n/g, ' ').trim()}${message.length >= 20 ? '...' : ''}`;
      await pool.query(`UPDATE conversations SET title = $1 WHERE id = $2`, [title, convId]);
    }

    // 记录消息以更新每日计数（必须等待以确保 DB 更新后再查询计数）
    // recordMessage 内部已 catch 异常，这里不需要额外 try/catch
    await recordMessage(userId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[TCM Chat] recordMessage failed:', msg);
    });

    // 获取服务器端权威计数（用于前端同步 localStorage，避免硬刷新后计数丢失）
    // 即使查询失败也不影响对话响应，serverDailyCount 保持 undefined
    let serverDailyCount: number | undefined;
    try {
      serverDailyCount = await getDailyMessageCount(userId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[TCM Chat] getDailyMessageCount failed:', msg);
    }

    return NextResponse.json({
      conversationId: convId,
      personaId,
      personaName: TCM_PERSONAS[personaId]?.nameZh,
      response,
      intent,
      creditsAfter,
      serverDailyCount,
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

    const isBudgetExceeded = errMsg.includes('budget') || errMsg.includes('budget exceeded');
    const isInjection = errMsg.includes('Invalid input') || errMsg.includes('prompt injection');
    const isProviderDown = errMsg.includes('AI 提供商暂时不可用') || errMsg.includes('LLM call failed') || errMsg.includes('AI 服务暂时不可用');

    if (isBudgetExceeded) {
      return NextResponse.json({ error: errMsg, code: 'BUDGET_EXCEEDED' }, { status: 402 });
    }
    if (isInjection) {
      return NextResponse.json({ error: '输入内容包含无效字符，请重新输入。', code: 'INVALID_INPUT' }, { status: 400 });
    }
    if (isProviderDown) {
      return NextResponse.json({ error: 'AI 服务暂时不可用，请稍后重试。', code: 'PROVIDER_DOWN' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error', detail: errMsg }, { status: 500 });
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
