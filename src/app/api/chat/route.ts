/**
 * Prismatic Chat API
 * Node.js Runtime (60s timeout)
 *
 * Four modes:
 *   solo       — single agent + conversation history
 *   prism      — parallel perspectives + synthesis (2 LLM calls)
 *   roundtable — FULL multi-turn dialogue in ONE LLM call
 *   mission    — FULL task plan + contributions + output in ONE LLM call
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createLLMProvider } from '@/lib/llm';
import { getPersonasByIds } from '@/lib/personas';
import { authenticateRequest } from '@/lib/user-management';
import { recordMessage, checkUserDailyLimit } from '@/lib/message-stats';
import type { Mode } from '@/lib/types';

export const runtime = 'nodejs';

function getLLMType(): 'deepseek' | 'openai' | 'anthropic' {
  const p = process.env.LLM_PROVIDER;
  if (p === 'openai') return 'openai';
  if (p === 'anthropic') return 'anthropic';
  return 'deepseek';
}

function getModelName(): string {
  const p = process.env.LLM_PROVIDER;
  if (p === 'openai') return 'gpt-4o';
  if (p === 'anthropic') return 'claude-sonnet-4-20250514';
  return 'deepseek-chat';
}

async function llmChat(
  llm: ReturnType<typeof createLLMProvider>,
  messages: any[],
  options: { temperature?: number; maxTokens: number }
) {
  const model = getModelName();
  return llm.chat({ model, messages, ...options });
}

// ─── Solo: Deep Dive ────────────────────────────────────────────────────────

async function handleSolo(personas: any[], message: string, history: any[] = []) {
  const llm = createLLMProvider(getLLMType());
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

  const result = await llmChat(llm, msgs, { temperature: 0.7, maxTokens: 500 });

  return [{
    id: nanoid(),
    personaId: persona.id,
    role: 'agent',
    content: result.content,
    confidence: 0.7,
    timestamp: new Date().toISOString(),
  }];
}

// ─── Prism: Multi-Perspective ────────────────────────────────────────────────
// Step 1: All personas answer in parallel
// Step 2: Synthesis

async function handlePrism(personas: any[], question: string) {
  const llm = createLLMProvider(getLLMType());

  // Step 1: Parallel perspective answers
  const perspectiveResults = await Promise.allSettled(
    personas.map(persona => {
      const prompt = `${persona.systemPromptTemplate}
Identity: ${persona.identityPrompt}

问题：「${question}」

用你的视角和思维方式回答这个问题。150字以内，直接、有观点、像你在说话。`;
      return llmChat(llm,
        [{ role: 'system', content: prompt }, { role: 'user', content: question }],
        { temperature: 0.7, maxTokens: 250 }
      ).then(r => ({
        personaId: persona.id,
        nameZh: persona.nameZh,
        response: r.content,
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

  const synthesisResult = await llmChat(llm, [
    { role: 'system', content: '你是认知综合者。分析多个专家视角，给出共识、分歧和整合洞察，中文回复。' },
    { role: 'user', content: `问题：「${question}」\n\n各视角回答：\n${perspectiveTexts}\n\n请提取：1) 共识 2) 分歧 3) 整合洞察（各40字以内）` },
  ], { temperature: 0.4, maxTokens: 300 });

  const messages = perspectives.map(p => ({
    id: nanoid(),
    personaId: p.personaId,
    role: 'agent',
    content: p.response,
    confidence: 0.7,
    timestamp: new Date().toISOString(),
  }));

  return {
    messages,
    synthesis: {
      id: nanoid(),
      content: synthesisResult.content,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Roundtable: Full Multi-Turn Dialogue in ONE Call ───────────────────────
// The LLM generates the complete dialogue (openings + reactions + convergence)
// as a structured response in a single LLM call. Much faster and more reliable.

async function handleRoundtable(personas: any[], topic: string) {
  const llm = createLLMProvider(getLLMType());

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

  const result = await llmChat(llm,
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

async function handleMission(personas: any[], mission: string) {
  const llm = createLLMProvider(getLLMType());

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

  const result = await llmChat(llm,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.5, maxTokens: 800 }
  );

  const rawContent = result.content.trim();

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
  };
}

// ─── Main Route ────────────────────────────────────────────────────────────────

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

    const personas = getPersonasByIds(participantIds);
    if (!personas.length) {
      return NextResponse.json({ error: 'No valid personas' }, { status: 400 });
    }

    // ── Daily usage limit check ──────────────────────────────────────────────
    const { allowed, current, limit } = await checkUserDailyLimit(userId);
    if (!allowed) {
      return NextResponse.json({
        error: `今日对话次数已达上限（${limit}次/天），明天再来探索吧~`,
        code: 'DAILY_LIMIT_REACHED',
        current,
        limit,
      }, { status: 429 });
    }

    const convId = conversationId ?? nanoid();
    let data: any;

    switch (mode) {
      case 'solo':
        data = { conversationId: convId, messages: await handleSolo(personas, message, history) };
        break;
      case 'prism': {
        const result = await handlePrism(personas, message);
        data = { conversationId: convId, ...result };
        break;
      }
      case 'roundtable':
        data = { conversationId: convId, debate: await handleRoundtable(personas, message) };
        break;
      case 'mission':
        data = { conversationId: convId, mission: await handleMission(personas, message) };
        break;
      default:
        return NextResponse.json({ error: 'Unknown mode' }, { status: 400 });
    }

    // Record message usage for admin stats
    try {
      await recordMessage(userId);
    } catch (err) {
      console.error('[Chat API] Failed to record message:', err);
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Chat API] Error:', message);
    return NextResponse.json(
      { error: '请求失败，请稍后重试。' },
      { status: 500 }
    );
  }
}
