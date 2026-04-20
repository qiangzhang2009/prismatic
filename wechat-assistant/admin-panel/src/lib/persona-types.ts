// ============================================
// Prismatic Persona 类型定义
// 来源: Prismatic /src/lib/personas.ts
// ============================================

export interface MentalModel {
  id: string;
  name: string;
  nameZh: string;
  oneLiner: string;
  evidence: Array<{
    quote: string;
    source: string;
    year?: number;
    page?: string;
  }>;
  crossDomain: string[];
  application: string;
  limitation: string;
  blindspot?: string;
  version: string;
  extractedAt: string;
}

export interface ExpressionDNA {
  sentencePattern: {
    type: 'short' | 'long' | 'mixed';
    shortSentenceRatio: number;
    avgSentenceLength: number;
    pauseFrequency: 'high' | 'medium' | 'low';
  };
  signatureWords: Array<{ word: string; frequency: number; context: string[] }>;
  signaturePhrases: Array<{ phrase: string; meaning: string; example: string }>;
  rhetoricalDevices: Array<{
    type:
      | 'rhetorical-question'
      | 'tricolon'
      | 'analogy'
      | 'dichotomy'
      | 'repetition'
      | 'exaggeration'
      | 'understatement';
    count: number;
    examples: string[];
  }>;
  emotionalTemperature: 'passionate' | 'calm' | 'humorous' | 'authoritative' | 'mixed';
  emotionalIndex: number;
  certaintyLevel: 'high' | 'medium' | 'low';
  absoluteWordRatio: number;
  uncertainWordRatio: number;
  tabooWords: string[];
  favoritePatterns: string[];
  version: string;
}

export interface Heuristic {
  id: string;
  situation: string;
  response: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Source {
  type: 'book' | 'speech' | 'interview' | 'article' | 'social';
  title: string;
  author?: string;
  year?: number;
  url?: string;
}

// ============================================
// 群管专属扩展字段
// ============================================

export interface ModerationConfig {
  allowTopics: string[];
  blockTopics: string[];
  responseLength: 'short' | 'medium' | 'long';
  triggerKeywords: string[];
  autoReplyDelay?: number; // ms, AI 回复延迟（模拟打字）
}

export interface FAQItem {
  question: string;
  keywords: string[];
  answer: string;
  confidence: number; // 低于此值走 AI 对话
}

export interface IdentityConfig {
  tagline: string;
  tone: string;
  constraints: string[];
  greeting?: string;
  farewell?: string;
}

// ============================================
// 完整 Wechat Persona 定义
// ============================================

export interface WechatPersona {
  id: string;
  name: string;
  slug: string;

  // Prismatic 认知资产
  identity: IdentityConfig;
  mentalModels: MentalModel[];
  decisionHeuristics: Heuristic[];
  expressionDNA: ExpressionDNA;
  sources: Source[];

  // 诚实边界
  honestBoundaries: string[];
  strengths: string[];
  blindspots: string[];

  // 群管专属
  moderation: ModerationConfig;
  faq: FAQItem[];

  // 元数据
  version: string;
  createdAt: string;
  updatedAt: string;
}
