// ─── Core Domain Types ──────────────────────────────────────────────────────

export type Domain =
  | 'product'
  | 'design'
  | 'strategy'
  | 'investment'
  | 'philosophy'
  | 'technology'
  | 'engineering'
  | 'leadership'
  | 'creativity'
  | 'education'
  | 'negotiation'
  | 'science'
  | 'risk'
  | 'ethics'
  | 'psychology'
  | 'spirituality';

export type Mode = 'solo' | 'prism' | 'roundtable' | 'mission';

// ─── Persona ──────────────────────────────────────────────────────────────────

export interface Source {
  type: 'primary' | 'secondary' | 'book' | 'interview' | 'lecture' | 'weibo';
  title: string;
  url?: string;
  description?: string;
  source?: string;
  priority?: string;
  count?: string;
  sample?: string[];
}

export interface Evidence {
  quote: string;
  source: string;
  year?: number;
}

export interface MentalModel {
  id: string;
  name: string;
  nameZh: string;
  oneLiner: string;
  evidence: Evidence[];
  crossDomain: string[];
  application: string;
  limitation: string;
}

export interface DecisionHeuristic {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  application: string;
  example?: string;
}

export interface ExpressionDNA {
  sentenceStyle: string[];
  vocabulary: string[];
  forbiddenWords: string[];
  rhythm: string;
  humorStyle: string;
  certaintyLevel: 'high' | 'medium' | 'low';
  rhetoricalHabit: string;
  quotePatterns: string[];
  chineseAdaptation: string;
  verbalMarkers?: string[];
  speakingStyle?: string;
}

export interface Tension {
  dimension: string;
  tensionZh: string;
  description: string;
  descriptionZh: string;
}

export interface Value {
  name: string;
  nameZh: string;
  priority: number;
  description?: string;
}

export interface HonestBoundary {
  text: string;
  textZh: string;
}

export interface PersonaResearchDim {
  dimension: string;
  dimensionZh: string;
  focus: string[];
}

export interface Persona {
  id: string;
  slug: string;
  name: string;
  nameZh: string;
  nameEn: string;
  domain: Domain[];
  tagline: string;
  taglineZh: string;
  avatar: string;
  accentColor: string;
  gradientFrom: string;
  gradientTo: string;
  brief: string;
  briefZh: string;

  // Core cognitive data
  mentalModels: MentalModel[];
  decisionHeuristics: DecisionHeuristic[];
  expressionDNA: ExpressionDNA;
  values: Value[];
  antiPatterns: string[];
  tensions: Tension[];

  // Boundaries
  honestBoundaries: HonestBoundary[];
  strengths: string[];
  blindspots: string[];

  // Research
  sources: Source[];
  researchDate: string;
  version: string;

  // Agent routing hints
  researchDimensions: PersonaResearchDim[];

  // System prompts
  systemPromptTemplate: string;
  identityPrompt: string;

  // Extended fields (optional, used by specific personas)
  lifePhilosophy?: {
    core: string;
    threeLevels?: {
      person: string;
      becoming: string;
      ultimate: string;
    };
    threeValues?: {
      immediate: string;
      longterm: string;
      ultimate: string;
    };
  };
  threeLevelSystem?: {
    overview: string;
    fiveElements: { name: string; description: string }[];
    threeLevels: { name: string; focus: string; topics: string[]; goal: string }[];
  };
  signatureQuotes?: {
    onSuffering?: string[];
    onMind?: string[];
    onLiberation?: string[];
    onPractice?: string[];
    onBusiness?: string[];
    onBuddhismMisconceptions?: string[];
  };
  qaStyle?: {
    characteristics: string[];
    typicalResponses?: {
      opening: string[];
      transition: string[];
      closing: string[];
    };
  };
  biographicalDetails?: {
    born?: string;
    family?: string;
    earlyLife?: string;
    ordination?: string;
    education?: string;
    earlyTraining?: { place: string; years: string; style: string; note: string }[];
    threeMasters?: Record<string, string>;
    careerMilestones?: { year: string; event: string }[];
    currentBase?: string;
    writing?: string;
  };
}

// ─── Conversation ─────────────────────────────────────────────────────────────

export interface SourceAttribution {
  personaId: string;
  quote: string;
  source: string;
}

export interface AgentMessage {
  id: string;
  personaId: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  timestamp: Date;
  modelUsed?: string;
  confidence?: number; // 0-1
  sources?: SourceAttribution[];
  tokenUsage?: number;
}

export interface ConsensusStatement {
  text: string;
  textZh: string;
  agreedBy: string[];
  strength: number; // 0-1
}

export interface DebateRound {
  round: number;
  statements: {
    personaId: string;
    content: string;
    targets?: string[]; // persona IDs being addressed
  }[];
  consensus?: ConsensusStatement;
}

export interface Conversation {
  id: string;
  mode: Mode;
  title?: string;
  participants: string[]; // persona IDs
  messages: AgentMessage[];
  debateRounds?: DebateRound[];
  consensus?: ConsensusStatement[];
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

// ─── Knowledge Graph ──────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: 'persona' | 'concept' | 'mental_model' | 'value' | 'heuristic';
  label: string;
  labelZh: string;
  personaId?: string; // if persona node
  x?: number;
  y?: number;
  z?: number;
  size: number;
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'inspired_by' | 'opposes' | 'shares' | 'complements' | 'derives_from';
  strength: number; // 0-1
  label?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface UserPreferences {
  defaultMode: Mode;
  favoritePersonas: string[];
  language: 'zh' | 'en' | 'auto';
  theme: 'dark' | 'light';
}

export interface UserSession {
  id: string;
  userId?: string;
  conversations: string[]; // conversation IDs
  preferences: UserPreferences;
  createdAt: Date;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ChatRequest {
  mode: Mode;
  participantIds: string[];
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  conversationId: string;
  messages: AgentMessage[];
  consensus?: ConsensusStatement[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface PrismRequest {
  participantIds: string[];
  question: string;
  context?: string;
}

export interface PrismResponse {
  perspectives: {
    personaId: string;
    perspective: string;
    confidence: number;
    mentalModelUsed?: string;
    sources: SourceAttribution[];
  }[];
  consensus: ConsensusStatement;
  divergences: {
    personaIds: [string, string];
    point: string;
    resolution?: string;
  }[];
}

export interface DebateRequest {
  participantIds: string[];
  topic: string;
  rounds?: number;
  context?: string;
}

export interface DebateResponse {
  conversationId: string;
  rounds: DebateRound[];
  finalConsensus?: ConsensusStatement[];
  summary: string;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface MissionTask {
  id: string;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  assignedPersonaId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: string;
  resultZh?: string;
}

export interface MissionPlan {
  id: string;
  title: string;
  titleZh: string;
  tasks: MissionTask[];
  status: 'planning' | 'executing' | 'completed';
}
