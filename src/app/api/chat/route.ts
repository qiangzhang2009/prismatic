/**
 * Prismatic Chat API
 * Node.js Runtime (60s timeout)
 *
 * Eight modes:
 *   solo       — single agent + conversation history
 *   prism      — parallel perspectives + synthesis (2 LLM calls)
 *   roundtable — FULL multi-turn dialogue in ONE LLM call
 *   mission    — FULL task plan + contributions + output in ONE LLM call
 *   epoch      — two-sided adversarial debate ("关公战秦琼")
 *   council    — advisory board with cross-evaluation + consensus
 *   oracle     — future diagnosis and prediction
 *   fiction    — collaborative storytelling with distinct voices
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createLLMProviderWithKey, type LLMResponse } from '@/lib/llm';
import { getPersonasByIds } from '@/lib/personas';
import { PERSONA_CONFIDENCE } from '@/lib/confidence';
import { authenticateRequest, getUserById } from '@/lib/user-management';
import { checkUserDailyLimit } from '@/lib/message-stats';
import { resolveBillingMode } from '@/lib/billing/engine';
import { prisma } from '@/lib/prisma';
import { trackEvent, trackEvents, incrementSessionMessages, trackChatStart, trackChatEnd } from '@/lib/analytics';
import type { Mode } from '@/lib/types';
import { Pool } from '@neondatabase/serverless';

export const runtime = 'nodejs';

function getModelName(llmType: 'deepseek' | 'openai' | 'anthropic'): string {
  switch (llmType) {
    case 'openai': return 'gpt-4o';
    case 'anthropic': return 'claude-sonnet-4-20250514';
    default: return 'deepseek-chat';
  }
}

/**
 * Creates LLM provider using user's API key (mode A) or platform key (mode B).
 */
function makeLLM(type: 'deepseek' | 'openai' | 'anthropic', key?: string) {
  return createLLMProviderWithKey(type, key);
}

// ─── Persistence ────────────────────────────────────────────────────────────────

function getDbPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  return new Pool({ connectionString: url });
}

/**
 * 持久化对话和消息记录到数据库。
 * 使用 raw SQL + 事务保证原子性，避免 Prisma nested write 在 skipDuplicates 时的兼容性问题。
 * 包括统计信息的更新（消息数、token、成本）。
 *
 * 关键设计：
 * - 事务包装：conversation 和 messages 作为原子单元
 * - tags 字段使用 text[] 类型
 * - metadata 使用有效 JSON（null 而不是 JSON.stringify(undefined)）
 */
async function persistConversation(
  userId: string,
  conversationId: string,
  mode: string,
  participantIds: string[],
  messages: any[],
  totalTokens?: number,
  totalCost?: number
) {
  const totalTokensNum = totalTokens || 0;
  const totalCostNum = totalCost ? parseFloat(String(totalCost)) : 0;

  // ── Validate inputs ────────────────────────────────────────────────────────
  if (!conversationId || typeof conversationId !== 'string') {
    console.error('[persistConversation] FATAL: invalid conversationId', { conversationId, userId });
    return null;
  }
  if (!userId || typeof userId !== 'string') {
    console.error('[persistConversation] FATAL: invalid userId', { userId, conversationId });
    return null;
  }
  if (!Array.isArray(messages)) {
    console.error('[persistConversation] FATAL: messages is not an array', { conversationId });
    return null;
  }

  console.log(`[persistConversation] START conversation=${conversationId} mode=${mode} messages=${messages.length} tokens=${totalTokensNum} cost=${totalCostNum}`);

  const pool = getDbPool();
  let poolEnded = false;

  // Helper to safely end the pool
  const endPool = async () => {
    if (!poolEnded) {
      poolEnded = true;
      try { await pool.end(); } catch { /* ignore */ }
    }
  };

  try {
    // Use a transaction so conversation + messages are atomic
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // ── Upsert conversation ───────────────────────────────────────────────────
      await client.query(`
        INSERT INTO conversations (id, "userId", mode, participants, "personaIds",
                                 "messageCount", "totalTokens", "totalCost", archived, tags, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $4, $5, $6, $7, false, '{}'::text[], NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          mode = EXCLUDED.mode,
          participants = EXCLUDED.participants,
          "personaIds" = EXCLUDED."personaIds",
          "messageCount" = EXCLUDED."messageCount",
          "totalTokens" = EXCLUDED."totalTokens",
          "totalCost" = EXCLUDED."totalCost",
          "updatedAt" = NOW()
      `, [conversationId, userId, mode, JSON.stringify(participantIds), messages.length, totalTokensNum, totalCostNum]);
      console.log(`[persistConversation] STEP_upsert_ok conversation=${conversationId}, messages=${messages.length}`);

      // ── Insert messages — one at a time for maximum reliability ───────────────
      // Per-message INSERT avoids PostgreSQL parameter limit issues and ensures
      // one bad message cannot block the entire batch.
      let totalInserted = 0;
      let totalSkipped = 0;
      let insertErrors = 0;

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (!msg || typeof msg !== 'object') {
          console.warn(`[persistConversation] STEP_msg_skip_invalid index=${i}`);
          totalSkipped++;
          continue;
        }

        try {
          const msgId = msg.id || nanoid();
          const resolvedPersonaId = msg.personaId || msg.speakerId || msg.assignedTo || null;
          const role = msg.role === 'agent' ? 'assistant' : (msg.role || 'user');
          const tsRaw = msg.timestamp;
          const ts = tsRaw instanceof Date ? tsRaw : (tsRaw ? new Date(tsRaw) : new Date());
          const modelUsed = msg.modelUsed || null;
          const tokensInput = msg._usage?.promptTokens || msg.tokensInput || null;
          const tokensOutput = msg._usage?.completionTokens || msg.tokensOutput || null;
          const apiCost = msg.apiCost ? parseFloat(String(msg.apiCost)) : null;
          // metadata: only stringify if it's a valid non-null object, otherwise null
          let metadata: string | null = null;
          if (msg.metadata && typeof msg.metadata === 'object') {
            metadata = JSON.stringify(msg.metadata);
          }
          const content = typeof msg.content === 'string' ? msg.content : '';

          const result = await client.query(`
            INSERT INTO messages (id, "conversationId", "userId", role, content,
                                 "personaId", "modelUsed", "tokensInput", "tokensOutput",
                                 "apiCost", metadata, "createdAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO NOTHING
          `, [msgId, conversationId, userId, role, content, resolvedPersonaId, modelUsed, tokensInput, tokensOutput, apiCost, metadata, ts]);

          if ((result.rowCount ?? 0) > 0) {
            totalInserted++;
          } else {
            totalSkipped++;
          }
        } catch (msgErr) {
          insertErrors++;
          const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
          console.warn(`[persistConversation] STEP_msg_insert_err index=${i} msgId=${msg.id} error=${errMsg}`);
        }
      }

      console.log(`[persistConversation] STEP_done conversation=${conversationId} messages=${messages.length} inserted=${totalInserted} skipped=${totalSkipped} errors=${insertErrors}`);

      await client.query('COMMIT');
      client.release();
      await endPool();
      return { id: conversationId, inserted: totalInserted, skipped: totalSkipped };
    } catch (innerErr) {
      await client.query('ROLLBACK').catch(() => {});
      client.release();
      throw innerErr;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join(' | ') : '';
    const hint = errMsg.includes('permission') ? ' → DB permission issue'
      : errMsg.includes('relation') && errMsg.includes('does not exist') ? ' → Table does not exist — run migration'
      : errMsg.includes('connection') || errMsg.includes('timeout') ? ' → DB connection issue'
      : errMsg.includes('unique') || errMsg.includes('duplicate') ? ' → Unique constraint violation'
      : errMsg.includes('invalid input syntax for type json') ? ' → metadata field has invalid JSON'
      : '';
    console.error(`[persistConversation] STEP_FATAL error=${errMsg} hint=${hint} stack=${errStack} messages=${messages.length}`);
    await endPool();
    return null;
  }
}

/**
 * 计算单个 LLM 调用的 token 使用和成本。
 */
function estimateTokenCost(model: string, inputTokens: number, outputTokens: number): { tokensInput: number; tokensOutput: number; cost: number } {
  // 简化的估算模型（实际应从 LLM provider 响应头获取）
  const inputCostPer1k: Record<string, number> = {
    'deepseek-chat': 0.014,   // $0.014 / 1K input tokens
    'gpt-4o': 0.03,
    'claude-sonnet-4-20250514': 0.03,
  };
  const outputCostPer1k: Record<string, number> = {
    'deepseek-chat': 0.014,
    'gpt-4o': 0.06,
    'claude-sonnet-4-20250514': 0.15,
  };

  const inputRate = inputCostPer1k[model] || 0.01;
  const outputRate = outputCostPer1k[model] || 0.01;

  const inputCost = (inputTokens / 1000) * inputRate;
  const outputCost = (outputTokens / 1000) * outputRate;

  return {
    tokensInput: inputTokens,
    tokensOutput: outputTokens,
    cost: inputCost + outputCost,
  };
}

async function llmChat(
  llm: { chat: (opts: any) => Promise<LLMResponse> },
  model: string,
  messages: any[],
  options: { temperature?: number; maxTokens: number }
): Promise<LLMResponse> {
  return llm.chat({ model, messages, ...options });
}

/**
 * Resolves personas from the database (for slugs not in hardcoded PERSONA_LIST).
 * Falls back to empty array if DB is unavailable.
 */
async function resolvePersonasFromDB(ids: string[]): Promise<any[]> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return [];

  const { getPersonasByIds } = await import('@/lib/personas');
  const hardcoded = getPersonasByIds(ids);
  const foundIds = new Set(hardcoded.map(p => p.id));
  const dbIds = ids.filter(id => !foundIds.has(id));
  if (dbIds.length === 0) return [];

  const pool = new Pool({ connectionString });
  try {
    const placeholders = dbIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query(
      `SELECT slug, name, namezh, nameen, domain, "taglineZh", "briefZh",
              "accentColor", "gradientFrom", "gradientTo",
              "systemPromptTemplate", "identityPrompt",
              strengths, blindspots, "mentalModels", "decisionHeuristics",
              "expressionDNA", "values", "tensions", "honestBoundaries"
       FROM distilled_personas
       WHERE slug IN (${placeholders}) AND "isActive" = true`,
      dbIds
    );

    const parseJson = (raw: unknown): any => {
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return raw; }
      }
      return raw;
    };

    const dbPersonas: any[] = result.rows.map(row => ({
      id: row.slug,
      slug: row.slug,
      name: row.name || row.nameen || '',
      nameZh: row.namezh || row.name || '',
      domain: row.domain ?? [],
      accentColor: row.accentColor || '#4d96ff',
      gradientFrom: row.gradientFrom || '#4d96ff',
      gradientTo: row.gradientTo || '#c77dff',
      tagline: row.tagline || '',
      taglineZh: row.taglineZh || '',
      brief: row.brief || '',
      briefZh: row.briefZh || '',
      systemPromptTemplate: parseJson(row.systemPromptTemplate) ?? '',
      identityPrompt: parseJson(row.identityPrompt) ?? '',
      strengths: parseJson(row.strengths) ?? [],
      blindspots: parseJson(row.blindspots) ?? [],
      mentalModels: parseJson(row.mentalModels) ?? [],
      decisionHeuristics: parseJson(row.decisionHeuristics) ?? [],
      expressionDNA: parseJson(row.expressionDNA) ?? {},
      values: parseJson(row.values) ?? [],
      tensions: parseJson(row.tensions) ?? [],
      honestBoundaries: parseJson(row.honestBoundaries) ?? [],
    }));

    await pool.end();
    return dbPersonas;
  } catch (err) {
    console.error('[resolvePersonasFromDB]', err);
    await pool.end().catch(() => {});
    return [];
  }
}

function getPersonaConfidence(personaId: string): number {
  const c = PERSONA_CONFIDENCE[personaId];
  return c ? c.overall / 100 : 0.5; // 0-1 scale
}

// ─── Solo: Deep Dive ────────────────────────────────────────────────────────

async function handleSolo(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  message: string,
  history: any[] = []
) {
  const persona = personas[0];

  const systemPrompt = `${persona.systemPromptTemplate}
Identity: ${persona.identityPrompt}
Strengths: ${persona.strengths.join(', ')}
Use "I" not "this persona would...".`;

  const msgs: any[] = [{ role: 'system', content: systemPrompt }];

  for (const h of history.slice(-8)) {
    msgs.push({ role: 'user', content: h.content });
    if (h.response) msgs.push({ role: 'assistant', content: h.response });
  }

  msgs.push({ role: 'user', content: message });

  const result = await llmChat(llm, modelName, msgs, { temperature: 0.7, maxTokens: 500 });

  return [{
    id: nanoid(),
    personaId: persona.id,
    role: 'agent',
    content: result.content,
    confidence: getPersonaConfidence(persona.id),
    timestamp: new Date().toISOString(),
    // Real token usage from API
    _usage: result.usage,
  }];
}

// ─── Prism: Multi-Perspective ────────────────────────────────────────────────
// Step 1: All personas answer in parallel
// Step 2: Synthesis

async function handlePrism(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  question: string
) {

  // Step 1: Parallel perspective answers
  const perspectiveResults = await Promise.allSettled(
    personas.map(persona => {
      const prompt = `${persona.systemPromptTemplate}
Identity: ${persona.identityPrompt}

问题：「${question}」

用你的视角和思维方式回答这个问题。150字以内，直接、有观点、像你在说话。`;
      return llmChat(llm, modelName,
        [{ role: 'system', content: prompt }, { role: 'user', content: question }],
        { temperature: 0.7, maxTokens: 250 }
      ).then(r => ({
        personaId: persona.id,
        nameZh: persona.nameZh,
        response: r.content,
        _usage: r.usage, // capture real token usage
      }));
    })
  );

  const perspectives = perspectiveResults
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<any>).value);

  if (perspectives.length === 0) return { messages: [], synthesis: null };

  // Step 2: Synthesis
  const perspectiveTexts = perspectives
    .map(p => `[${p.nameZh}]: ${p.response}`)
    .join('\n\n');

  const synthesisResult = await llmChat(llm, modelName, [
    { role: 'system', content: '你是认知综合者。分析多个专家视角，给出共识、分歧和整合洞察，中文回复。' },
    { role: 'user', content: `问题：「${question}」\n\n各视角回答：\n${perspectiveTexts}\n\n请提取：1) 共识 2) 分歧 3) 整合洞察（各40字以内）` },
  ], { temperature: 0.4, maxTokens: 300 });

  const messages = perspectives.map(p => ({
    id: nanoid(),
    personaId: p.personaId,
    role: 'agent',
    content: p.response,
    confidence: getPersonaConfidence(p.personaId),
    timestamp: new Date().toISOString(),
    _usage: p._usage,
  }));

  return {
    messages,
    synthesis: {
      id: nanoid(),
      content: synthesisResult.content,
      timestamp: new Date().toISOString(),
      _usage: synthesisResult.usage,
    },
  };
}

// ─── Roundtable: Full Multi-Turn Dialogue in ONE Call ───────────────────────
// The LLM generates the complete dialogue (openings + reactions + convergence)
// as a structured response in a single LLM call. Much faster and more reliable.

async function handleRoundtable(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  topic: string
) {

  // Limit to 5 personas max for a clean dialogue
  const speakers = personas.slice(0, 5);

  // Build a mapping of persona IDs to names for reliable speaker matching
  const speakerMap = Object.fromEntries(speakers.map((p) => [p.nameZh, p.id]));

  // Minimal persona descriptions to keep input token count low
  const speakerList = speakers.map((p, i) =>
    `${i + 1}. ${p.nameZh}（${p.strengths.slice(0, 2).join('、')}）`
  ).join('\n');

  const systemPrompt = `你是圆桌辩论主持人。多个思想家就话题展开对话，每人说一句（60字以内），2轮，共${speakers.length * 2}条发言，最后一段50字以内的总结。

格式（markdown，每行一条发言）：
**人物名**: 发言内容

最后一行：
【总结】: 盲点+碰撞点（50字以内）`;

  const userPrompt = `话题：${topic}
思想家：${speakerList}

请生成${speakers.length}人×2轮的对话，最后总结。`;

  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.7, maxTokens: 500 }
  );

  const rawContent = result.content.trim();

  // Strategy 1: Try markdown speaker pattern (primary)
  const speakerRegex = /^\*\*(.+?)\*\*[:：]\s*(.+)$/gm;
  const markdownMatches: { speakerName: string; content: string }[] = [];
  let match;
  while ((match = speakerRegex.exec(rawContent)) !== null) {
    markdownMatches.push({ speakerName: match[1].trim(), content: match[2].trim() });
  }

  let turns: any[] = [];
  let convergence = '';

  if (markdownMatches.length > 0) {
    // Find the summary line
    const summaryMatch = markdownMatches.find(m =>
      m.speakerName.includes('总结') || m.speakerName.includes('盲点')
    );
    const dialogueMatches = summaryMatch
      ? markdownMatches.filter(m => m !== summaryMatch)
      : markdownMatches;

    turns = dialogueMatches.map((m, i) => ({
      round: Math.floor(i / speakers.length),
      speakerId: speakerMap[m.speakerName] ?? speakers[i % speakers.length]?.id ?? 'unknown',
      speakerName: m.speakerName,
      content: m.content,
      timestamp: new Date().toISOString(),
    }));

    if (summaryMatch) {
      convergence = summaryMatch.content;
    } else if (dialogueMatches.length > 0) {
      convergence = dialogueMatches[dialogueMatches.length - 1].content;
    }
  } else {
    // Strategy 2: Try JSON (fallback)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        turns = (parsed.turns ?? []).map((t: any, i: number) => ({
          round: t.round ?? Math.floor(i / speakers.length),
          speakerId: t.speakerId ?? speakers[i % speakers.length]?.id ?? 'unknown',
          speakerName: t.speakerName ?? '',
          content: t.content ?? '',
          timestamp: new Date().toISOString(),
        }));
        convergence = parsed.convergence ?? '';
      } catch {
        // JSON parse failed — treat as plain text
        convergence = rawContent.replace(/[{}]/g, '').trim();
      }
    } else {
      // Strategy 3: Last resort — use raw content as summary
      convergence = rawContent;
    }
  }

  // If no meaningful turns extracted, create a single summary turn
  if (turns.length === 0 && convergence) {
    turns = speakers.map((p, i) => ({
      round: 0,
      speakerId: p.id,
      speakerName: p.nameZh,
      content: `关于「${topic.slice(0, 20)}...」发表了自己的看法。`,
      timestamp: new Date().toISOString(),
    }));
  }

  return {
    turns,
    convergence: {
      id: nanoid(),
      content: convergence || '各方观点已呈现。',
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Mission: Complete Task Plan + Results + Output in ONE Call ──────────────
// All three steps (decompose, execute, integrate) combined into a single prompt
// for maximum speed and reliability.

async function handleMission(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  mission: string
) {

  // Limit to 4 personas
  const participants = personas.slice(0, 4);

  const personaList = participants.map((p, i) =>
    `${i + 1}. 【${p.nameZh}】${p.identityPrompt}（擅长：${p.strengths.slice(0, 2).join('、')}）`
  ).join('\n');

  const systemPrompt = `你是任务协作专家，将复杂任务分解并由多个专家角色协作完成，最终整合为完整输出。

输出格式（markdown）：
📋 任务分解
• **方面1**: 子任务描述 → 负责人：人物名
• **方面2**: 子任务描述 → 负责人：人物名

**【人物名1】方面1**（100字以内，用第一人称）:
贡献内容...

**【人物名2】方面2**（100字以内，用第一人称）:
贡献内容...

✨ 最终整合（200字以内，结构清晰、可直接使用）`;

  const userPrompt = `任务：${mission}

可用专家：
${personaList}

请分解任务、让各专家完成分工、并整合出最终完整成果。`;

  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.5, maxTokens: 800 }
  );

  const rawContent = result.content.trim();
  const _missionUsage = result.usage;

  // Build persona name → id map for matching
  const personaNameMap: Record<string, string> = {};
  for (const p of participants) {
    personaNameMap[p.nameZh] = p.id;
  }

  // Strategy 1: Try markdown structured output
  let taskPlan: any[] = [];
  let results: any[] = [];
  let output = '';

  // Extract task plan section
  const planMatch = rawContent.match(/📋\s*任务分解\n([\s\S]*?)(?=\n\*\*【|\n✨|$)/i);
  if (planMatch) {
    const planLines = planMatch[1].split('\n').filter(l => l.trim());
    for (const line of planLines) {
      const m = line.match(/^\s*•\s+\*\*(.+?)\*\*[:：]\s*(.+?)\s*(?:→|->)\s*负责人[：:]\s*(.+?)\s*$/);
      if (m) {
        taskPlan.push({
          description: m[2].trim(),
          aspect: m[1].trim(),
          assignedTo: personaNameMap[m[3].trim()] ?? participants[0]?.id ?? 'unknown',
          status: 'done',
        });
      } else {
        const simpleM = line.match(/^\s*•\s+\*\*(.+?)\*\*[:：]\s*(.+)$/);
        if (simpleM) {
          taskPlan.push({
            description: simpleM[2].trim(),
            aspect: simpleM[1].trim(),
            assignedTo: participants[0]?.id ?? 'unknown',
            status: 'done',
          });
        }
      }
    }
  }

  // Extract individual contributions
  const contribRegex = /\*\*【(.+?)】(.+?)\*\*\s*\((?:.*?)\)?\s*\n([\s\S]*?)(?=\n(?:✨|\*\*【|\n|$))/g;
  let contribMatch;
  while ((contribMatch = contribRegex.exec(rawContent)) !== null) {
    const personaName = contribMatch[1].trim();
    const aspect = contribMatch[2].trim().replace(/[【】]/g, '');
    const resultText = contribMatch[3].trim();
    results.push({
      personaId: personaNameMap[personaName] ?? participants[0]?.id ?? 'unknown',
      personaName,
      aspect,
      result: resultText.slice(0, 300),
    });
  }

  // Extract final output
  const outputMatch = rawContent.match(/(?:✨|最终整合)[^\n]*\n([\s\S]*)$/i);
  if (outputMatch) {
    output = outputMatch[1].trim();
  } else {
    // Fallback: use everything after the last contribution
    const lastContribIndex = rawContent.lastIndexOf('**【');
    if (lastContribIndex > 0) {
      output = rawContent.slice(lastContribIndex).replace(/\*\*【[\s\S]+?\*\*\s*\([\s\S]+?\)\n/, '').trim();
    } else {
      output = rawContent;
    }
  }

  // Fallback: if parsing produced nothing meaningful, use the raw content
  if (taskPlan.length === 0 && results.length === 0) {
    output = rawContent;
    taskPlan = participants.map((p, i) => ({
      description: `${p.nameZh}从自己的专业视角分析了任务`,
      aspect: p.domain?.[0] ?? '综合分析',
      assignedTo: p.id,
      status: 'done',
    }));
  }

  return {
    taskPlan,
    results,
    output: {
      id: nanoid(),
      content: output || rawContent,
      timestamp: new Date().toISOString(),
    },
    _usage: _missionUsage,
  };
}

// ─── Epoch Clash: Two-Sided Adversarial Debate ──────────────────────────────
// "关公战秦琼" — exactly 2 personas, PRO vs CON, structured debate

async function handleEpoch(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  topic: string
) {

  if (personas.length < 2) {
    return { turns: [], verdict: { winner: null, reasoning: '需要至少2位人物才能进行关公战秦琼', consensus: '' } };
  }

  const [pro, con] = personas;
  const speakerMap: Record<string, string> = {
    [pro.nameZh]: pro.id,
    [con.nameZh]: con.id,
  };

  const systemPrompt = `你是辩论裁判，主持两位思想家就一个话题展开正反方对决。

规则：
- **正方**（${pro.nameZh}）：${pro.identityPrompt}
- **反方**（${con.nameZh}）：${con.identityPrompt}
- 每人发言不超过80字，语言风格必须与人物一致
- 共3轮：第1轮各陈述观点 → 第2轮互相反驳 → 第3轮各做最终陈述
- 最后裁判给出：胜负判断、核心分歧、评分

格式（markdown）：
**【正方 · ${pro.nameZh} · 开场】**: 内容
**【反方 · ${con.nameZh} · 开场】**: 内容
**【正方 · 反驳】**: 内容
**【反方 · 反驳】**: 内容
**【正方 · 最终陈词】**: 内容
**【反方 · 最终陈词】**: 内容
---
**【裁判判决】**: 正方X分 vs 反方Y分 | 核心分歧 | 关键胜点`;

  const userPrompt = `辩题：${topic}

请主持完整辩论。`;

  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.7, maxTokens: 700 }
  );

  const rawContent = result.content.trim();
  const _epochUsage = result.usage;

  // Parse turns: "**【...】**: 内容" pattern
  const turnRegex = /^\*\*【(.+?)】(?:\s*(.+?))?\*\*[:：]\s*(.+)$/gm;
  const turns: any[] = [];
  let winner = '';
  let reasoning = '';

  let match;
  while ((match = turnRegex.exec(rawContent)) !== null) {
    const label = match[1].trim();
    const speakerName = label.includes('正方') ? pro.nameZh
      : label.includes('反方') ? con.nameZh
      : '';
    const round = label.includes('开场') ? 0
      : label.includes('反驳') ? 1
      : label.includes('最终') ? 2
      : -1;

    if (label.includes('裁判') || label.includes('判决')) {
      // Parse verdict line
      const verdictContent = match[3].trim();
      const scoreMatch = verdictContent.match(/正方\s*(\d+)\s*分\s*vs?\s*反方\s*(\d+)\s*分/);
      if (scoreMatch) {
        winner = parseInt(scoreMatch[1]) > parseInt(scoreMatch[2]) ? pro.nameZh
          : parseInt(scoreMatch[1]) < parseInt(scoreMatch[2]) ? con.nameZh
          : '平局';
      }
      reasoning = verdictContent;
    } else {
      turns.push({
        round,
        speakerId: speakerMap[speakerName] ?? (label.includes('正方') ? pro.id : con.id),
        speakerName: label,
        content: match[3].trim(),
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Fallback if parsing fails
  if (turns.length === 0) {
    const lines = rawContent.split('\n').filter(l => l.trim() && !l.includes('---'));
    for (let i = 0; i < lines.length; i++) {
      turns.push({
        round: Math.floor(i / 2),
        speakerId: i % 2 === 0 ? pro.id : con.id,
        speakerName: i % 2 === 0 ? `${pro.nameZh}` : `${con.nameZh}`,
        content: lines[i].replace(/^\*\*/, '').replace(/\*\*$/, '').trim(),
        timestamp: new Date().toISOString(),
      });
    }
  }

  return {
    turns,
    verdict: {
      winner: winner || null,
      reasoning: reasoning || '辩论已完成',
      consensus: winner ? `${winner}方在本轮辩论中更具说服力` : '本轮辩论以平局收场',
    },
    _usage: _epochUsage,
  };
}

// ─── Council: Advisory Board ────────────────────────────────────────────────
// 2-4 personas give expert advice, cross-evaluate, then reach consensus

async function handleCouncil(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  question: string
) {
  const speakers = personas.slice(0, 4);

  const speakerList = speakers.map((p, i) =>
    `${i + 1}. 【${p.nameZh}】${p.identityPrompt}（专长：${p.strengths.slice(0, 2).join('、')}）`
  ).join('\n');

  const systemPrompt = `你是顾问团主席，主持多位顾问就用户的问题给出专业建议。

格式（markdown）：
**【${speakers.map(p => p.nameZh).join('、')}】**
---
${speakers.map(p => `### ${p.nameZh}的建议（100字以内，用第一人称）`).join('\n')}
内容...
---
### 交叉点评（50字/每人，选最有价值的建议做点评）
**${speakers[0].nameZh}点评**: 内容
**${speakers[1].nameZh}点评**: 内容
${speakers.length > 2 ? `**${speakers[2].nameZh}点评**: 内容` : ''}
---
### 最终共识（200字以内，可直接执行的行动方案）
1. ...2. ...3. ...`;

  const userPrompt = `用户问题：${question}

可用顾问：${speakerList}

请让各顾问给出专业建议，互相点评，并最终形成共识行动方案。`;

  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.5, maxTokens: 700 }
  );

  const rawContent = result.content.trim();
  const _councilUsage = result.usage;
  const personaNameMap: Record<string, string> = {};
  for (const p of speakers) personaNameMap[p.nameZh] = p.id;

  // Extract individual advice blocks
  const adviceSectionRegex = /(?:###|【)(建议|Advice)(?:\s*（[^）]+）)?\s*\n([\s\S]*?)(?=\n(?:---|\n###|\n\*\*【))/gi;
  const adviceEntries: any[] = [];
  let match;
  while ((match = adviceSectionRegex.exec(rawContent)) !== null) {
    const text = match[2].trim().slice(0, 300);
    if (text) {
      adviceEntries.push({
        personaId: speakers[adviceEntries.length]?.id ?? speakers[0].id,
        personaName: speakers[adviceEntries.length]?.nameZh ?? speakers[0].nameZh,
        advice: text,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Fallback: split by speaker names
  if (adviceEntries.length === 0) {
    for (const p of speakers) {
      const blockMatch = rawContent.match(new RegExp(`${p.nameZh}[^\\n]*\\n([\\s\\S]{10,400}?)(?=\\n(?:---)?\\s*\\n|\\n\\s*\\*{2}|$)`, 'i'));
      adviceEntries.push({
        personaId: p.id,
        personaName: p.nameZh,
        advice: blockMatch ? blockMatch[1].trim().slice(0, 300) : `从${p.nameZh}的角度给出了专业建议。`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Extract consensus
  const consensusMatch = rawContent.match(/(?:最终共识|共识行动方案)[^\n]*\n([\s\S]{50,500}?)$/i);
  const consensus = consensusMatch ? consensusMatch[1].trim() : rawContent.slice(-300);

  return {
    advice: adviceEntries,
    consensus: {
      id: nanoid(),
      content: consensus,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Oracle: Future Diagnosis ───────────────────────────────────────────────
// 1-2 personas look at current situation and predict the future

async function handleOracle(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  question: string
) {
  const speaker = personas[0];

  const systemPrompt = `你是预言家，以${speaker.nameZh}的视角，用未来视角审视现在。

核心原则：
- 不是给你建议，而是告诉你未来会发生什么，以及为什么
- 用3-5年后的眼光回看现在
- 先诊断现状中的关键变量，再预测变化轨迹，最后给出置信度和判断依据
- 说话风格与${speaker.nameZh}一致，有观点、有判断、不含糊

格式（markdown）：
## 🔮 现状诊断（60字）
关键变量：... | 当前状态：...

## 📈 预测（3条，每条50字以内）
1. **变化A**：预测内容（含时间范围）
2. **变化B**：预测内容（含时间范围）
3. **变化C**：预测内容（含时间范围）

## ⚖️ 置信度与依据
置信度：XX% | 主要依据：...

## 💡 关键判断（80字以内，一句话）
`;

  const userPrompt = `请以预言家的视角，分析这个问题：${question}`;
  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.8, maxTokens: 600 }
  );

  return {
    diagnosis: { id: nanoid(), personaId: speaker.id, personaName: speaker.nameZh,
      content: result.content.trim(), timestamp: new Date().toISOString() },
    predictions: null, // embedded in content
    source: speaker.nameZh,
  };
}

// ─── Fiction: Collaborative Storytelling ────────────────────────────────────
// 2-3 personas co-create a story, each speaking in their own voice

async function handleFiction(
  { llm, modelName }: { llm: { chat: (opts: any) => Promise<LLMResponse> }; modelName: string },
  personas: any[],
  premise: string
) {
  const speakers = personas.slice(0, 3);

  const systemPrompt = `你是故事主持人，让${speakers.map(p => `${p.nameZh}（${p.identityPrompt}）`).join('、')}共同演绎一个故事。

规则：
- 每人保持自己的人物语言风格和行为逻辑
- 用 markdown 格式，格式：**【人物名】**：（动作和对话）
- 共6-8段，推进情节，不拖沓
- 结局开放或有意味

格式：
**【${speakers[0].nameZh}】**：（内容）
**【${speakers[1].nameZh}】**：（内容）
...
`;

  const userPrompt = `故事背景/前提：${premise}`;
  const result = await llmChat(llm, modelName,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.9, maxTokens: 800 }
  );

  const rawContent = result.content.trim();

  // Parse turns
  const turnRegex = /^\*\*【(.+?)】\*\*[:：]\s*([\s\S]*?)(?=\n(?:\*\*【|$))/gm;
  const speakerMap: Record<string, string> = {};
  for (const p of speakers) speakerMap[p.nameZh] = p.id;

  const turns: any[] = [];
  let match;
  while ((match = turnRegex.exec(rawContent)) !== null) {
    const speakerName = match[1].trim();
    turns.push({
      speakerId: speakerMap[speakerName] ?? speakers[0].id,
      speakerName,
      content: match[2].trim(),
      timestamp: new Date().toISOString(),
    });
  }

  // Fallback: just return raw content
  if (turns.length === 0) {
    turns.push({
      speakerId: speakers[0].id,
      speakerName: '旁白',
      content: rawContent.slice(0, 500),
      timestamp: new Date().toISOString(),
    });
  }

  return {
    turns,
    meta: { speakerCount: speakers.length, premise },
  };
}

export async function POST(request: NextRequest) {
  try {
    // Auth check: require login
    const userId = await authenticateRequest(request);
    if (!userId) {
      return NextResponse.json({ error: '请先登录后再使用对话功能' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { mode, participantIds, message, conversationId, history } = body as {
      mode: Mode;
      participantIds: string[];
      message: string;
      conversationId?: string;
      history?: any[];
    };

    if (!message?.trim() || !participantIds?.length) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Resolve from both hardcoded list and DB
    const hardcoded = getPersonasByIds(participantIds);
    const dbPersonas = await resolvePersonasFromDB(participantIds);
    const foundIds = new Set([...hardcoded, ...dbPersonas].map(p => p.id));
    const personas = [...hardcoded, ...dbPersonas].filter(p => foundIds.has(p.id));
    if (!personas.length) {
      return NextResponse.json({ error: 'No valid personas' }, { status: 400 });
    }

    // ── Billing mode resolution ─────────────────────────────────────────────
    const billing = await resolveBillingMode(userId);
    if (!billing.allowed) {
      return NextResponse.json({ error: billing.reason }, { status: 401 });
    }

    // Create LLM provider with user's key (mode A) or platform key (mode B)
    const llmApiKey = billing.apiKey || billing.platformApiKey;
    const llm = makeLLM(billing.provider, llmApiKey);
    const modelName = getModelName(billing.provider);
    const llmContext = { llm, modelName };

    // ── Daily usage limit check ──────────────────────────────────────────────
    const user = await getUserById(userId);
    const userPlan = user?.plan ?? 'FREE';
    const userCredits = user?.credits ?? 0;
    const { allowed, current, limit, reason } = await checkUserDailyLimit(userId, userPlan, userCredits);
    if (!allowed) {
      return NextResponse.json({
        error: `今日对话次数已达上限（${limit}次/天），明天再来探索吧~`,
        code: 'DAILY_LIMIT_REACHED',
        current,
        limit,
        billingReason: reason,
      }, { status: 429 });
    }

    const convId = conversationId ?? nanoid();
    let data: any;

    switch (mode) {
      case 'solo':
        data = { conversationId: convId, messages: await handleSolo(llmContext, personas, message, history) };
        break;
      case 'prism': {
        const result = await handlePrism(llmContext, personas, message);
        data = { conversationId: convId, ...result };
        break;
      }
      case 'roundtable':
        data = { conversationId: convId, debate: await handleRoundtable(llmContext, personas, message) };
        break;
      case 'mission':
        data = { conversationId: convId, mission: await handleMission(llmContext, personas, message) };
        break;
      case 'epoch':
        data = { conversationId: convId, debate: await handleEpoch(llmContext, personas, message) };
        break;
      case 'council':
        data = { conversationId: convId, ...(await handleCouncil(llmContext, personas, message)) };
        break;
      case 'oracle':
        data = { conversationId: convId, ...(await handleOracle(llmContext, personas, message)) };
        break;
      case 'fiction':
        data = { conversationId: convId, ...(await handleFiction(llmContext, personas, message)) };
        break;
      default:
        return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
    }

    // ── Post-conversation ─────────────────────────────────────────────────────
    // Extract all messages (including user message and AI responses).
    // For Solo mode, include the conversation history from the frontend so the
    // DB row always has the complete message list (avoids duplicate rows).
    const historyMessages = (body as any).history?.map((h: any, i: number) => ({
      id: `hist-${i}`,
      role: 'user' as const,
      content: h.content,
      timestamp: new Date(Date.now() - (body as any).history.length - i),
    })) || [];

    // ── Build allMessages: collect every response from every mode ──────────────
    // Solo: data.messages (array of agent responses)
    // Prism: data.messages (array of agent responses)
    // Roundtable/Epoch: data.debate.turns (array of dialogue turns)
    // Mission: data.mission.taskPlan + data.mission.results (task plan + individual contributions)
    // Council: data.advice (advisory responses)
    // Oracle: data.advice (predictions)
    // Fiction: data.turns (story turns)
    const agentResponses: any[] = [];

    // Solo / Prism responses
    if (Array.isArray(data.messages)) {
      agentResponses.push(...data.messages);
    }

    // Roundtable / Epoch dialogue turns
    if (Array.isArray(data.debate?.turns)) {
      agentResponses.push(...data.debate.turns);
    }

    // Mission task plan entries
    if (Array.isArray(data.mission?.taskPlan)) {
      for (const t of data.mission.taskPlan) {
        agentResponses.push({
          id: nanoid(),
          role: 'agent',
          content: t.description,
          personaId: t.assignedTo,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Mission individual contributions
    if (Array.isArray(data.mission?.results)) {
      for (const r of data.mission.results) {
        agentResponses.push({
          id: nanoid(),
          role: 'agent',
          content: r.result,
          personaId: r.personaId,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Mission integrated output (as a system summary, not an agent persona)
    if (data.mission?.output?.content) {
      // Don't add to agentResponses — the synthesis message is a system message
      // already handled by the frontend as a system role message
    }

    // Council advisory responses
    if (Array.isArray(data.advice)) {
      agentResponses.push(...data.advice.map((a: any) => ({
        id: a.id || nanoid(),
        role: 'agent',
        content: a.advice,
        personaId: a.personaId,
        timestamp: a.timestamp || new Date().toISOString(),
      })));
    }

    const allMessages = [
      ...historyMessages,
      { id: nanoid(), role: 'user', content: message, timestamp: new Date() },
      ...agentResponses,
    ].filter(Boolean);
    console.log(`[Chat API] allMessages count=${allMessages.length} history=${historyMessages.length} userMsg=1 agent=${agentResponses.length}`);

    // Use real token counts from API responses where available
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    for (const msg of allMessages) {
      if (msg._usage) {
        totalInputTokens += msg._usage.promptTokens ?? 0;
        totalOutputTokens += msg._usage.completionTokens ?? 0;
      } else {
        const chars = msg.content?.length || 0;
        const estimated = Math.ceil(chars / 4);
        if (msg.role === 'user') {
          totalInputTokens += estimated;
        } else {
          totalOutputTokens += estimated;
        }
      }
    }
    const { cost } = estimateTokenCost(getModelName(billing.provider), totalInputTokens, totalOutputTokens);
    totalCost = cost;

    // Persist conversation and messages
    const persistResult = await persistConversation(
      userId,
      convId,
      mode,
      participantIds,
      allMessages,
      totalInputTokens + totalOutputTokens,
      cost
    );
    if (!persistResult) {
      console.warn(`[Chat API] persistConversation returned null for conv=${convId}, mode=${mode}, messages=${allMessages.length} — data NOT saved to DB`);
    }

    // Tokens and cost are already set by the upsert in persistConversation

    // ── Analytics Tracking ─────────────────────────────────────────────────────
    // Track chat start event
    try {
      await trackChatStart(participantIds[0], personas[0]?.nameZh || '');
    } catch (err) {
      console.error('[Analytics] trackChatStart failed:', err);
    }

    // Track chat end event
    try {
      await trackChatEnd(convId, {
        mode,
        messageCount: allMessages.length,
        tokens: totalInputTokens + totalOutputTokens,
        cost,
      });
    } catch (err) {
      console.error('[Analytics] trackChatEnd failed:', err);
    }

    // Track individual messages as events
    try {
      const messageEvents = allMessages.map(msg => ({
        userId,
        sessionId: undefined,
        eventType: 'chat_message',
        eventName: 'chat_message',
        properties: { messageId: msg.id, contentLength: msg.content?.length || 0 },
        personaId: msg.personaId,
        conversationId: convId,
      }));
      await trackEvents(messageEvents);
    } catch (err) {
      console.error('[Analytics] track chat messages failed:', err);
    }

    // Record message usage for admin stats (legacy)
    try {
      await incrementSessionMessages(convId);
    } catch (err) {
      console.error('[Chat API] Failed to record message:', err);
    }

    // ── Deduct credits (if user has paid credits) ────────────────────────────
    // Only deduct for FREE users who have credits. Paid users are unlimited.
    let creditsAfter = userCredits;
    if (userPlan === 'FREE' && userCredits > 0) {
      try {
        const { deductCredits } = await import('@/lib/billing/engine');
        const result = await deductCredits(userId, 1, {
          description: '对话消耗',
          conversationId: convId,
        });
        creditsAfter = result.newBalance;
      } catch (err) {
        console.error('[Chat API] Failed to deduct credits:', err);
      }
    }

    return NextResponse.json({ ...data, creditsRemaining: creditsAfter });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Chat API] Error:', message);
    return NextResponse.json(
      { error: '请求失败，请稍后重试。' },
      { status: 500 }
    );
  }
}
