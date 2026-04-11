/**
 * Prismatic Agent Engine
 * Multi-agent orchestration for perspective synthesis
 *
 * Note: chat API (src/app/api/chat/route.ts) uses direct LLM calls for speed.
 * This file is kept for future server-side ConversationManager usage.
 */

import type { Persona, AgentMessage, Mode, ConsensusStatement } from './types';

export interface AgentResult {
  personaId: string;
  response: string;
  confidence: number;
  mentalModelUsed?: string;
  tokensUsed: number;
}

export interface DebateTurn {
  round: number;
  speakerId: string;
  content: string;
  targets?: string[];
  timestamp: Date;
}

export interface DebateResult {
  turns: DebateTurn[];
  consensus?: ConsensusStatement;
  summary: string;
}

export interface MissionTask {
  personaId: string;
  task: string;
  result: string;
  status: 'completed' | 'failed';
}

const TEMPERATURE_MAP: Record<string, number> = {
  'steve-jobs': 0.7, 'elon-musk': 0.8, 'charlie-munger': 0.5,
  'naval-ravikant': 0.6, 'richard-feynman': 0.9, 'zhang-yiming': 0.5,
  'paul-graham': 0.6, 'andrej-karpathy': 0.7, 'nassim-taleb': 0.8,
  'zhang-xuefeng': 0.6, 'donald-trump': 0.9, 'mrbeast': 0.8,
  'ilya-sutskever': 0.5, 'sun-tzu': 0.4, 'seneca': 0.5,
  'confucius': 0.4, 'lao-zi': 0.3, 'hui-neng': 0.4, 'jiqun': 0.4,
  'kant': 0.5, 'nietszsche': 0.6, 'einstein': 0.8, 'tesla': 0.7,
  'qian-xuesen': 0.5, 'carnegie': 0.5,
};

function getTemperature(personaId: string): number {
  return TEMPERATURE_MAP[personaId] ?? 0.7;
}

/**
 * Quick single-call response generation
 * Use this for simple solo mode when the chat API isn't available
 */
export function buildSoloPrompt(persona: Persona, userMessage: string): string {
  return `${persona.systemPromptTemplate}

Identity: ${persona.identityPrompt}
Strengths: ${persona.strengths.join(', ')}
Blindspots: ${persona.blindspots.join(', ')}

Use "I" not "this persona would...". Keep response under 300 words.`;
}

export function buildPrismPrompt(persona: Persona, question: string): string {
  return `${persona.systemPromptTemplate}
Identity: ${persona.identityPrompt}

Give your unique perspective on: ${question}
Be direct and opinionated, 150-200 words, use "I".

Mental models: ${persona.mentalModels.slice(0, 2).map(m => `${m.nameZh}: ${m.oneLiner}`).join(', ')}`;
}

export function buildDebateOpeningPrompt(persona: Persona, topic: string): string {
  return `${persona.systemPromptTemplate}
Identity: ${persona.identityPrompt}

「${topic}」
发表开场陈述，100字以内，直接说你的核心立场。`;
}

export function buildDebateResponsePrompt(
  speaker: Persona,
  topic: string,
  priorTurns: DebateTurn[]
): string {
  const othersContent = priorTurns
    .filter(t => t.speakerId !== speaker.id)
    .map(t => `[${t.speakerId}]: ${t.content}`)
    .join('\n\n');

  return `「${topic}」\n回应其他人：\n${othersContent}\n\n你的质疑或补充（100字内）：`;
}

export function estimateConfidence(persona: Persona, question: string): number {
  const q = question.toLowerCase();
  let score = 0.5;
  for (const s of persona.strengths) {
    if (q.includes(s.toLowerCase())) score += 0.15;
  }
  for (const b of persona.blindspots) {
    if (q.includes(b.toLowerCase())) score -= 0.2;
  }
  return Math.max(0.3, Math.min(0.95, score));
}

export function suggestMentalModel(persona: Persona, question: string): string {
  const q = question.toLowerCase();
  for (const model of persona.mentalModels) {
    const terms = [...model.crossDomain, model.name, model.nameZh];
    if (terms.some(t => q.includes(t.toLowerCase()))) {
      return `${model.nameZh}: ${model.oneLiner}`;
    }
  }
  return persona.mentalModels[0]
    ? `${persona.mentalModels[0].nameZh}: ${persona.mentalModels[0].oneLiner}`
    : '';
}

// ─── Conversation Manager (for future multi-turn conversations) ─────────────────────

export class ConversationManager {
  private conversations = new Map<string, any>();

  getConversation(id: string) { return this.conversations.get(id); }

  createConversation(id: string, mode: Mode, participants: string[]) {
    const conv = { id, mode, participants, messages: [], createdAt: new Date() };
    this.conversations.set(id, conv);
    return conv;
  }

  archiveConversation(id: string) {
    const conv = this.conversations.get(id);
    if (conv) { conv.archived = true; conv.updatedAt = new Date(); }
  }
}
