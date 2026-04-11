/**
 * Prismatic Agent Engine
 * Multi-agent orchestration for perspective synthesis
 */

import { OpenAIProvider, AnthropicProvider, type LLMProvider } from './llm';
import type { Persona, AgentMessage, Mode, ConsensusStatement } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentContext {
  persona: Persona;
  messages: AgentMessage[];
  sharedContext?: string;
  conversationHistory: AgentMessage[];
}

interface AgentResult {
  personaId: string;
  response: string;
  confidence: number;
  mentalModelUsed?: string;
  sources?: string[];
  tokensUsed: number;
}

interface DebateTurn {
  round: number;
  speakerId: string;
  content: string;
  targets?: string[];
  timestamp: Date;
}

interface DebateResult {
  turns: DebateTurn[];
  consensus?: ConsensusStatement;
  summary: string;
}

interface MissionTask {
  personaId: string;
  task: string;
  result: string;
  status: 'completed' | 'failed';
}

// ─── Core Agent Executor ───────────────────────────────────────────────────

export class PrismaticAgent {
  private llm: LLMProvider;
  private temperatureMap: Record<string, number>;

  constructor(llm: LLMProvider) {
    this.llm = llm;
    // Each persona has a characteristic temperature
    this.temperatureMap = {
      'steve-jobs': 0.7,
      'elon-musk': 0.8,
      'charlie-munger': 0.5,
      'naval-ravikant': 0.6,
      'richard-feynman': 0.9,
      'zhang-yiming': 0.5,
      'paul-graham': 0.6,
      'andrej-karpathy': 0.7,
      'nassim-taleb': 0.8,
      'zhang-xuefeng': 0.6,
      'donald-trump': 0.9,
      'mrbeast': 0.8,
      'ilya-sutskever': 0.5,
      'sun-tzu': 0.4,
      'seneca': 0.5,
    };
  }

  /**
   * Generate a response from a single persona
   */
  async generateSolo(
    persona: Persona,
    userMessage: string,
    conversationHistory: AgentMessage[] = []
  ): Promise<AgentResult> {
    const context = this.buildSoloContext(persona, userMessage, conversationHistory);

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: context,
      temperature: this.temperatureMap[persona.id] ?? 0.7,
      maxTokens: 1200,
    });

    return {
      personaId: persona.id,
      response: response.content,
      confidence: this.estimateConfidence(persona, userMessage),
      mentalModelUsed: this.suggestMentalModel(persona, userMessage),
      tokensUsed: response.usage?.totalTokens ?? 0,
    };
  }

  /**
   * Generate multiple perspectives in parallel (Prism mode)
   */
  async generatePrism(
    personas: Persona[],
    question: string,
    context?: string
  ): Promise<AgentResult[]> {
    // Run all personas in parallel
    const results = await Promise.all(
      personas.map(persona =>
        this.generatePersonaPerspective(persona, question, context)
      )
    );

    return results;
  }

  /**
   * Internal: generate perspective from one persona in prism mode
   */
  private async generatePersonaPerspective(
    persona: Persona,
    question: string,
    sharedContext?: string
  ): Promise<AgentResult> {
    const systemPrompt = this.buildPrismSystemPrompt(persona);
    const context: any[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (sharedContext) {
      context.push({
        role: 'system',
        content: `【共同背景】\n${sharedContext}`,
      });
    }

    context.push({
      role: 'user',
      content: question,
    });

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: context,
      temperature: this.temperatureMap[persona.id] ?? 0.7,
      maxTokens: 800,
    });

    return {
      personaId: persona.id,
      response: response.content,
      confidence: this.estimateConfidence(persona, question),
      mentalModelUsed: this.suggestMentalModel(persona, question),
      tokensUsed: response.usage?.totalTokens ?? 0,
    };
  }

  /**
   * Run a round-table debate with multiple personas
   */
  async runDebate(
    personas: Persona[],
    topic: string,
    rounds: number = 4,
    context?: string
  ): Promise<DebateResult> {
    const turns: DebateTurn[] = [];
    const topicAnalysis = await this.analyzeTopicForDebate(topic, personas);

    // Opening statements
    for (const persona of personas) {
      const opening = await this.generateDebateStatement(
        persona,
        `请发表开场陈述（150字以内）：「${topic}」\n\n你的开场应该：1) 给出你的核心立场 2) 提出1-2个你认为最重要的考量因素。`,
        context
      );

      turns.push({
        round: 0,
        speakerId: persona.id,
        content: opening.response,
        timestamp: new Date(),
      });
    }

    // Debate rounds
    for (let r = 1; r <= rounds; r++) {
      for (const speaker of personas) {
        // Pick 1-2 other personas to address
        const targets = personas
          .filter(p => p.id !== speaker.id)
          .slice(0, Math.floor(Math.random() * 2) + 1)
          .map(p => p.id);

        // Generate cross-examination
        const crossExamine = await this.generateCrossExamination(
          speaker,
          topic,
          turns.filter(t => t.speakerId !== speaker.id).slice(-2),
          targets,
          context
        );

        turns.push({
          round: r,
          speakerId: speaker.id,
          content: crossExamine.response,
          targets,
          timestamp: new Date(),
        });
      }
    }

    // Generate consensus
    const consensus = await this.generateDebateConsensus(personas, topic, turns);

    return {
      turns,
      consensus,
      summary: await this.summarizeDebate(personas, topic, turns, consensus),
    };
  }

  /**
   * Run mission mode: decompose and assign tasks
   */
  async runMission(
    personas: Persona[],
    mission: string,
    context?: string
  ): Promise<MissionTask[]> {
    // Decompose mission into tasks
    const decomposition = await this.decomposeMission(mission, personas);

    // Assign and execute each task
    const tasks: MissionTask[] = [];

    for (const task of decomposition.tasks) {
      const assignee = personas.find(p => p.id === task.assignedTo)!;

      const result = await this.executeMissionTask(
        assignee,
        task.description,
        context
      );

      tasks.push({
        personaId: assignee.id,
        task: task.description,
        result: result.response,
        status: 'completed',
      });
    }

    return tasks;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private buildSoloContext(
    persona: Persona,
    userMessage: string,
    history: AgentMessage[]
  ): any[] {
    const systemPrompt = this.buildSoloSystemPrompt(persona);

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    // Add recent conversation history for continuity
    const recentHistory = history
      .filter(m => m.personaId === persona.id || m.role === 'user')
      .slice(-6);

    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  private buildSoloSystemPrompt(persona: Persona): string {
    return `${persona.systemPromptTemplate}

IMPORTANT CONTEXT:
- Identity: ${persona.identityPrompt}
- Mental Models Available:
${persona.mentalModels.map(m => `  • ${m.nameZh} (${m.name}): ${m.oneLiner}`).join('\n')}
- Decision Heuristics:
${persona.decisionHeuristics.map(h => `  • ${h.nameZh}: ${h.description}`).join('\n')}
- Strengths: ${persona.strengths.join(', ')}
- Known Blindspots: ${persona.blindspots.join(', ')}
- Honest Boundaries: ${persona.honestBoundaries.map(b => b.textZh).join('; ')}

Remember: Use "I" not "this persona would...". Be authentic to their voice.`;
  }

  private buildPrismSystemPrompt(persona: Persona): string {
    return `You are channeling ${persona.nameZh} (${persona.nameEn}).
${persona.identityPrompt}

Your task: Give your unique perspective on the user's question.
- Be direct and opinionated — that's your value
- Use your characteristic voice and vocabulary
- Apply your mental models naturally
- Acknowledge uncertainty when it's genuine
- Keep your response to 150-300 words

Mental models you should draw from:
${persona.mentalModels.slice(0, 3).map(m => `• ${m.nameZh}: ${m.oneLiner}`).join('\n')}

Your response should feel like this person is thinking out loud, not a generic analysis.`;
  }

  private async generateDebateStatement(
    persona: Persona,
    prompt: string,
    context?: string
  ): Promise<AgentResult> {
    const systemPrompt = `${persona.systemPromptTemplate}

You are in a ROUND TABLE DEBATE. Your task is to give a concise opening statement (150 words max).
Be direct, use your characteristic voice, state your core position clearly.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: persona.identityPrompt },
    ];

    if (context) {
      messages.push({ role: 'system', content: `Debate context: ${context}` });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages,
      temperature: this.temperatureMap[persona.id] ?? 0.7,
      maxTokens: 400,
    });

    return {
      personaId: persona.id,
      response: response.content,
      confidence: 0.7,
      tokensUsed: response.usage?.totalTokens ?? 0,
    };
  }

  private async generateCrossExamination(
    speaker: Persona,
    topic: string,
    previousStatements: DebateTurn[],
    targets: string[],
    context?: string
  ): Promise<AgentResult> {
    const othersPerspectives = previousStatements
      .map(t => `[${t.speakerId}]: ${t.content}`)
      .join('\n\n');

    const prompt = `针对之前的观点提出你的质疑或补充：

${othersPerspectives}

你的立场：「${topic}」
回应时：
1. 先承认对方有价值的观点
2. 然后提出你的质疑或补充
3. 最后给出你的核心立场

控制在150字内，用${speaker.nameZh}的视角和语气。`;

    const systemPrompt = `${speaker.systemPromptTemplate}

You are cross-examining other perspectives. Challenge them intellectually, but fairly.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: speaker.identityPrompt },
    ];

    if (context) {
      messages.push({ role: 'system', content: `Debate context: ${context}` });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages,
      temperature: this.temperatureMap[speaker.id] ?? 0.7,
      maxTokens: 400,
    });

    return {
      personaId: speaker.id,
      response: response.content,
      confidence: 0.6,
      tokensUsed: response.usage?.totalTokens ?? 0,
    };
  }

  private async generateDebateConsensus(
    personas: Persona[],
    topic: string,
    turns: DebateTurn[]
  ): Promise<ConsensusStatement | undefined> {
    const turnSummary = turns
      .map(t => `[${t.speakerId}]: ${t.content}`)
      .join('\n---\n');

    const consensusPrompt = `Based on this debate, identify:
1. Points of agreement (共识)
2. Key disagreements (分歧)
3. A unified synthesis (综合)

Format your response as:
## 共识
[What everyone agrees on]

## 分歧
[Where perspectives diverge]

## 综合
[A nuanced synthesis that integrates the strongest insights]

Topic: ${topic}

Debate transcript:
${turnSummary}`;

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a debate synthesizer. Extract consensus, divergences, and provide a unified synthesis.' },
        { role: 'user', content: consensusPrompt },
      ],
      temperature: 0.4,
      maxTokens: 800,
    });

    const content = response.content;

    // Parse consensus from response
    const agreedBy = personas.map(p => p.id);

    return {
      text: content,
      textZh: content,
      agreedBy,
      strength: 0.7,
    };
  }

  private async analyzeTopicForDebate(
    topic: string,
    personas: Persona[]
  ): Promise<{ angles: string[]; keyTensions: string[] }> {
    const personaSummaries = personas
      .map(p => `${p.nameZh}: ${p.strengths.join(', ')}`)
      .join('; ');

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Analyze a debate topic and suggest angles and tensions.',
        },
        {
          role: 'user',
          content: `Topic: ${topic}\nParticipants: ${personaSummaries}\n\nWhat angles should each participant focus on? What are the key tensions?`,
        },
      ],
      temperature: 0.5,
      maxTokens: 400,
    });

    return { angles: [], keyTensions: [] };
  }

  private async summarizeDebate(
    personas: Persona[],
    topic: string,
    turns: DebateTurn[],
    consensus?: ConsensusStatement
  ): Promise<string> {
    const personaNames = personas.map(p => p.nameZh).join('、');

    const summaryPrompt = `Summarize this debate in 200 words:
- Topic: ${topic}
- Participants: ${personaNames}
- ${turns.length} rounds of dialogue
- Consensus reached: ${consensus ? 'Yes' : 'No'}

Provide a concise summary highlighting the key insights and conclusions.`;

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are summarizing a debate. Be concise and insightful.' },
        { role: 'user', content: summaryPrompt },
      ],
      temperature: 0.3,
      maxTokens: 400,
    });

    return response.content;
  }

  private async decomposeMission(
    mission: string,
    personas: Persona[]
  ): Promise<{
    tasks: { description: string; assignedTo: string; rationale: string }[];
  }> {
    const personaDescriptions = personas
      .map(p => `${p.id}: ${p.nameZh} - ${p.strengths.join(', ')}`)
      .join('\n');

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Decompose a complex mission into tasks assignable to specific personas.
Output in JSON format:
{
  "tasks": [
    { "description": "...", "assignedTo": "persona-id", "rationale": "..." }
  ]
}`,
        },
        {
          role: 'user',
          content: `Mission: ${mission}\n\nAvailable personas:\n${personaDescriptions}\n\nBreak down this mission into tasks, each assigned to the most appropriate persona.`,
        },
      ],
      temperature: 0.5,
      maxTokens: 600,
    });

    try {
      const parsed = JSON.parse(response.content);
      return parsed;
    } catch {
      // Fallback: simple task assignment
      return {
        tasks: personas.map(p => ({
          description: mission,
          assignedTo: p.id,
          rationale: `Primary analysis by ${p.nameZh}`,
        })),
      };
    }
  }

  private async executeMissionTask(
    persona: Persona,
    task: string,
    context?: string
  ): Promise<AgentResult> {
    const prompt = `MISSION TASK: ${task}
${context ? `\nContext: ${context}` : ''}

Complete this task using your unique perspective and expertise.`;

    const messages: any[] = [
      { role: 'system', content: this.buildSoloSystemPrompt(persona) },
      { role: 'user', content: prompt },
    ];

    const response = await this.llm.chat({
      model: 'gpt-4o',
      messages,
      temperature: this.temperatureMap[persona.id] ?? 0.7,
      maxTokens: 600,
    });

    return {
      personaId: persona.id,
      response: response.content,
      confidence: 0.75,
      tokensUsed: response.usage?.totalTokens ?? 0,
    };
  }

  private estimateConfidence(persona: Persona, question: string): number {
    // Simple heuristic: confidence is higher if question matches persona's strengths
    const questionLower = question.toLowerCase();
    let score = 0.5;

    for (const strength of persona.strengths) {
      if (questionLower.includes(strength.toLowerCase())) {
        score += 0.15;
      }
    }

    for (const blindspot of persona.blindspots) {
      if (questionLower.includes(blindspot.toLowerCase())) {
        score -= 0.2;
      }
    }

    return Math.max(0.3, Math.min(0.95, score));
  }

  private suggestMentalModel(persona: Persona, question: string): string {
    const questionLower = question.toLowerCase();

    for (const model of persona.mentalModels) {
      const modelTerms = [...model.crossDomain, model.name, model.nameZh];
      for (const term of modelTerms) {
        if (questionLower.includes(term.toLowerCase())) {
          return `${model.nameZh}: ${model.oneLiner}`;
        }
      }
    }

    // Return the primary mental model
    return persona.mentalModels[0]
      ? `${persona.mentalModels[0].nameZh}: ${persona.mentalModels[0].oneLiner}`
      : '';
  }
}

// ─── Conversation Manager ───────────────────────────────────────────────────

export class ConversationManager {
  private conversations: Map<string, any> = new Map();
  private agent: PrismaticAgent;

  constructor(llm: LLMProvider) {
    this.agent = new PrismaticAgent(llm);
  }

  async handleMessage(
    conversationId: string,
    mode: Mode,
    participantIds: string[],
    userMessage: string
  ): Promise<{
    conversationId: string;
    responses: AgentResult[];
    consensus?: ConsensusStatement;
  }> {
    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      conversation = {
        id: conversationId,
        mode,
        participants: participantIds,
        messages: [],
        createdAt: new Date(),
      };
      this.conversations.set(conversationId, conversation);
    }

    switch (mode) {
      case 'solo':
        return this.handleSolo(conversation, participantIds[0], userMessage);

      case 'prism':
        return this.handlePrism(conversation, participantIds, userMessage);

      case 'roundtable':
        return this.handleRoundtable(conversation, participantIds, userMessage);

      case 'mission':
        return this.handleMission(conversation, participantIds, userMessage);

      default:
        throw new Error(`Unknown mode: ${mode}`);
    }
  }

  private async handleSolo(
    conversation: any,
    personaId: string,
    userMessage: string
  ): Promise<any> {
    const { getPersona } = await import('./personas');
    const persona = getPersona(personaId);

    if (!persona) throw new Error(`Persona not found: ${personaId}`);

    conversation.messages.push({
      id: crypto.randomUUID(),
      personaId: 'user',
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const result = await this.agent.generateSolo(
      persona,
      userMessage,
      conversation.messages
    );

    conversation.messages.push({
      id: crypto.randomUUID(),
      personaId,
      role: 'agent',
      content: result.response,
      confidence: result.confidence,
      timestamp: new Date(),
    });

    return {
      conversationId: conversation.id,
      responses: [result],
    };
  }

  private async handlePrism(
    conversation: any,
    personaIds: string[],
    userMessage: string
  ): Promise<any> {
    const { getPersonasByIds } = await import('./personas');
    const personas = getPersonasByIds(personaIds);

    conversation.messages.push({
      id: crypto.randomUUID(),
      personaId: 'user',
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    const results = await this.agent.generatePrism(personas, userMessage);

    for (const result of results) {
      conversation.messages.push({
        id: crypto.randomUUID(),
        personaId: result.personaId,
        role: 'agent',
        content: result.response,
        confidence: result.confidence,
        mentalModelUsed: result.mentalModelUsed,
        timestamp: new Date(),
      });
    }

    // Generate cross-persona synthesis
    const synthesis = await this.generateSynthesis(personas, results);

    return {
      conversationId: conversation.id,
      responses: results,
      synthesis,
    };
  }

  private async handleRoundtable(
    conversation: any,
    personaIds: string[],
    topic: string
  ): Promise<any> {
    const { getPersonasByIds } = await import('./personas');
    const personas = getPersonasByIds(personaIds);

    const debate = await this.agent.runDebate(personas, topic, 3);

    for (const turn of debate.turns) {
      conversation.messages.push({
        id: crypto.randomUUID(),
        personaId: turn.speakerId,
        role: 'agent',
        content: turn.content,
        timestamp: turn.timestamp,
        round: turn.round,
      });
    }

    return {
      conversationId: conversation.id,
      debate,
    };
  }

  private async handleMission(
    conversation: any,
    personaIds: string[],
    mission: string
  ): Promise<any> {
    const { getPersonasByIds } = await import('./personas');
    const personas = getPersonasByIds(personaIds);

    const tasks = await this.agent.runMission(personas, mission);

    return {
      conversationId: conversation.id,
      tasks,
    };
  }

  private async generateSynthesis(
    personas: Persona[],
    results: AgentResult[]
  ): Promise<string> {
    const perspectiveTexts = results
      .map(r => `[${personas.find(p => p.id === r.personaId)?.nameZh}]: ${r.response}`)
      .join('\n\n');

    const synthesisPrompt = `Analyze these perspectives and generate a synthesis:

${perspectiveTexts}

Provide:
1. Points of agreement across perspectives
2. Key tensions or divergences
3. A unified synthesis that integrates the strongest insights

Keep it concise (200 words max).`;

    const { createLLMProvider } = await import('./llm');
    const llm = createLLMProvider('openai');
    const response = await llm.chat({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are synthesizing multiple expert perspectives into a coherent analysis.' },
        { role: 'user', content: synthesisPrompt },
      ],
      temperature: 0.4,
      maxTokens: 600,
    });

    return response.content;
  }

  getConversation(id: string) {
    return this.conversations.get(id);
  }

  archiveConversation(id: string) {
    const conv = this.conversations.get(id);
    if (conv) {
      conv.archived = true;
      conv.updatedAt = new Date();
    }
  }
}
