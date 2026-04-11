/**
 * Prismatic Chat API
 * Multi-agent conversation endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { createLLMProvider } from '@/lib/llm';
import { PrismaticAgent } from '@/lib/prismatic-agent';
import { getPersonasByIds } from '@/lib/personas';
import type { Mode } from '@/lib/types';

// Read LLM provider from environment
function getLLMType(): 'deepseek' | 'openai' | 'anthropic' {
  const provider = process.env.LLM_PROVIDER;
  if (provider === 'openai') return 'openai';
  if (provider === 'anthropic') return 'anthropic';
  return 'deepseek'; // default to DeepSeek
}

// Use Node.js runtime (default) — compatible with Vercel environment variables

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, participantIds, message, conversationId } = body as {
      mode: Mode;
      participantIds: string[];
      message: string;
      conversationId?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!participantIds || participantIds.length === 0) {
      return NextResponse.json({ error: 'At least one participant is required' }, { status: 400 });
    }

    const personas = getPersonasByIds(participantIds);
    if (personas.length === 0) {
      return NextResponse.json({ error: 'No valid personas found' }, { status: 400 });
    }

    // Initialize LLM provider and agent
    const llm = createLLMProvider(getLLMType());
    const agent = new PrismaticAgent(llm);

    const convId = conversationId ?? nanoid();

    let result: any;

    switch (mode) {
      case 'solo':
        result = await agent.generateSolo(personas[0], message, []);
        return NextResponse.json({
          conversationId: convId,
          messages: [
            {
              id: nanoid(),
              personaId: personas[0].id,
              role: 'agent',
              content: result.response,
              confidence: result.confidence,
              timestamp: new Date().toISOString(),
            },
          ],
        });

      case 'prism':
        const prismResults = await agent.generatePrism(personas, message);
        return NextResponse.json({
          conversationId: convId,
          messages: prismResults.map((r, i) => ({
            id: nanoid(),
            personaId: r.personaId,
            role: 'agent',
            content: r.response,
            confidence: r.confidence,
            mentalModelUsed: r.mentalModelUsed,
            timestamp: new Date(Date.now() + i * 100).toISOString(),
          })),
        });

      case 'roundtable':
        const debate = await agent.runDebate(personas, message, 3);
        return NextResponse.json({
          conversationId: convId,
          debate: {
            rounds: debate.turns.map((t) => ({
              round: t.round,
              speakerId: t.speakerId,
              content: t.content,
              targets: t.targets,
              timestamp: t.timestamp.toISOString(),
            })),
            consensus: debate.consensus,
            summary: debate.summary,
          },
        });

      case 'mission':
        const tasks = await agent.runMission(personas, message);
        return NextResponse.json({
          conversationId: convId,
          tasks: tasks.map((t) => ({
            personaId: t.personaId,
            task: t.task,
            result: t.result,
            status: t.status,
          })),
        });

      default:
        return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
