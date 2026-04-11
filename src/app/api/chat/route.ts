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

  // Minimal persona descriptions to keep input token count low
  const speakerList = speakers.map((p, i) =>
    `${i + 1}. ${p.nameZh}（${p.strengths.slice(0, 2).join('、')}）`
  ).join('\n');

  const systemPrompt = `你是圆桌辩论主持人。多个思想家就话题展开对话，每人说一句（60字以内），2轮，共${speakers.length * 2}条发言，最后50字总结：盲点+碰撞点。

格式：{turns:[{speakerName,content}],convergence:""}`;

  const userPrompt = `话题：${topic}
思想家：${speakerList}

请生成${speakers.length}人×2轮的对话，最后总结。`;

  const result = await llmChat(llm,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.7, maxTokens: 400 }
  );

  // Parse the JSON response
  let turns: any[] = [];
  let convergence = result.content;

  // Try to extract JSON from the response
  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
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
      convergence = parsed.convergence ?? convergence;
    } catch {
      // If JSON parsing fails, treat entire content as convergence
      convergence = result.content;
    }
  } else {
    // Fallback: treat the whole thing as a convergence summary
    convergence = result.content;
  }

  return {
    turns,
    convergence: {
      id: nanoid(),
      content: convergence,
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

输出格式（JSON）：
{
  "taskPlan": [
    {"description": "子任务描述", "assignedTo": "persona-id", "aspect": "负责方面", "status": "done"}
  ],
  "results": [
    {"personaId": "persona-id", "personaName": "姓名", "aspect": "方面", "result": "贡献内容（150字以内）"}
  ],
  "output": "整合后的完整最终输出（200字以内，结构清晰、可直接使用）"
}

规则：
- 每个角色只负责自己擅长的方面，不要越界
- 最终输出要整合所有角色的贡献，形成完整连贯的结果
- 用中文回复，第一人称
- 最终输出要结构化（可用列表、分段等格式）`;

  const userPrompt = `任务：${mission}

可用专家：
${personaList}

请分解任务、让各专家完成分工、并整合出最终完整成果。`;

  const result = await llmChat(llm,
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    { temperature: 0.5, maxTokens: 600 }
  );

  // Parse JSON response
  let taskPlan: any[] = [];
  let results: any[] = [];
  let output = result.content;

  const jsonMatch = result.content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      taskPlan = (parsed.taskPlan ?? []).map((t: any, i: number) => ({
        ...t,
        assignedTo: t.assignedTo ?? participants[i % participants.length]?.id ?? 'unknown',
        status: 'done',
      }));
      results = (parsed.results ?? []).map((r: any, i: number) => ({
        ...r,
        personaId: r.personaId ?? participants[i % participants.length]?.id ?? 'unknown',
      }));
      output = parsed.output ?? output;
    } catch {
      // Keep fallback
    }
  }

  return {
    taskPlan,
    results,
    output: {
      id: nanoid(),
      content: output,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── Main Route ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
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
