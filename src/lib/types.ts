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
  | 'spirituality'
  | 'stoicism'
  | 'zen-buddhism'
  | 'AI'
  | 'semiconductor'
  | 'e-commerce'
  | 'space'
  | 'economics'
  | 'startup'
  | 'technology'
  | 'investing'
  | 'innovation'
  | 'principles';

export type Mode = 'solo' | 'prism' | 'roundtable' | 'mission';

// ─── Persona ──────────────────────────────────────────────────────────────────

export interface Source {
  type: 'primary' | 'secondary' | 'book' | 'interview' | 'lecture' | 'weibo' | 'speech' | 'tweet' | 'archive' | 'blog' | 'essay' | 'podcast' | 'classical_text' | 'video' | 'shareholder-letter' | 'ceo-quotes' | 'earnings' | 'gtc' | 'YC';
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

  // Training corpus tracking (2026-04-12)
  trainingCorpusPath?: string;
  trainingCorpusStats?: {
    tweets?: number;
    topTweets?: number;
    essays?: number;
    files?: number;
    estimatedWords?: number;
    tweets_pre?: number;
    tweets_office?: number;
    truth_social?: number;
    campaign_speeches?: string;
    sources?: string;
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

// ─── Distillation Pipeline ─────────────────────────────────────────────────────

export type PipelineStage = 'discover' | 'collect' | 'extract' | 'build' | 'test';
export type PipelineStatus = 'pending' | 'running' | 'completed' | 'failed';
export type PipelineWave = 1 | 2 | 3 | 4;

export interface PipelineTaskDependency {
  taskId: string;
  dependsOn: string[];
}

export interface PipelineTask {
  id: string;
  personaId: string;
  stage: PipelineStage;
  description: string;
  descriptionZh: string;
  status: PipelineStatus;
  dependencies: string[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
  cost?: number;
  tokensUsed?: number;
}

export interface PipelinePlan {
  id: string;
  personaId: string;
  tasks: PipelineTask[];
  waves: PipelineTask[][];
  status: PipelineStatus;
  currentWave: PipelineWave;
  totalCost: number;
  totalTokens: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface PipelineWaveResult {
  wave: PipelineWave;
  tasks: PipelineTask[];
  duration: number;
  cost: number;
  success: boolean;
  error?: string;
}

// ─── Distillation Scoring (AgentShield-style) ──────────────────────────────────

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingCategory = 'voice' | 'knowledge' | 'reasoning' | 'safety';

export interface ScoreBreakdown {
  voiceFidelity: number;       // 表达DNA还原度
  knowledgeDepth: number;      // 知识覆盖深度
  reasoningPattern: number;     // 思维模式一致性
  safetyCompliance: number;     // 安全合规性
}

export interface ScoreFinding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  description: string;
  location?: string;
  fixSuggestion: string;
  autoFixable: boolean;
}

export interface DistillationScore {
  overall: number;            // 0-100
  grade: ScoreGrade;
  breakdown: ScoreBreakdown;
  findings: ScoreFinding[];
  starRating: 1 | 2 | 3 | 4 | 5;
  thresholdPassed: boolean;
  timestamp: Date;
  modelUsed: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface VoiceFidelityMetrics {
  vocabularyMatch: number;
  sentencePatternMatch: number;
  toneTrajectoryMatch: number;
  forbiddenWordAvoidance: number;
  rhetoricalHabitMatch: number;
}

export interface KnowledgeDepthMetrics {
  mentalModelCoverage: number;
  heuristicCoverage: number;
  sourceCoverage: number;
  timeSpanCoverage: number;
  crossDomainLinks: number;
}

export interface ReasoningPatternMetrics {
  valueConsistency: number;
  tensionRecognition: number;
  antiPatternAvoidance: number;
  decisionFrameworkCoherence: number;
}

export interface SafetyComplianceMetrics {
  harmfulContentDetection: number;
  sensitivePersonExclusion: number;
  politicalNeutrality: number;
  factualAccuracy: number;
}

// ─── Persona Skills (ecc-style) ────────────────────────────────────────────────

export type SkillCapability = 'analysis' | 'synthesis' | 'critique' | 'teaching' | 'storytelling' | 'negotiation' | 'questioning';

export interface PersonaSkill {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  triggerKeywords: string[];
  capability: SkillCapability;
  examples: string[];
  promptTemplate?: string;
  cooldown?: number;
}

export interface PersonaSkillSet {
  personaId: string;
  skills: string[];
  defaultSkill?: string;
  skillOverrides?: Record<string, string>;
}

// ─── Expression Calibration ────────────────────────────────────────────────────

export interface VocabularyFingerprint {
  topWords: string[];
  bigrams: string[];
  trigrams: string[];
  signaturePhrases: string[];
  forbiddenWords: string[];
}

export interface SyntacticPattern {
  pattern: string;
  frequency: number;
  example: string;
}

export interface ToneTrajectory {
  trajectory: ('formal' | 'casual' | 'passionate' | 'detached' | 'humorous')[];
  dominantTone: string;
  toneShifts: number;
  humorFrequency: number;
  certaintyLevel: 'high' | 'medium' | 'low';
}

export interface ExpressionDNAProfile {
  vocabularyFingerprint: VocabularyFingerprint;
  syntacticPatterns: SyntacticPattern[];
  toneTrajectory: ToneTrajectory;
  rhetoricalHabits: string[];
  quotePatterns: string[];
  similarityToTarget?: number;
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

export type CollectorType = 'twitter' | 'blog' | 'video' | 'podcast' | 'book' | 'interview' | 'weibo' | 'forum';
export type CollectorStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface ScrapingTarget {
  id: string;
  personaId: string;
  collectorType: CollectorType;
  source: string;
  url?: string;
  type: Source['type'];
  status: CollectorStatus;
  itemsCollected: number;
  estimatedTotal?: number;
  retryCount: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ScrapingProgress {
  targetId: string;
  status: string;
  itemsCollected: number;
  estimatedTotal: number;
  rate: number;
  errors: number;
  elapsedMs: number;
  currentUrl?: string;
}

export interface CollectorConfig {
  parallelLimit: number;
  retryCount: number;
  retryDelay: number;
  timeout: number;
  userAgent: string;
  respectRobotsTxt: boolean;
}

export interface CollectedItem {
  id: string;
  source: string;
  sourceType: CollectorType;
  content: string;
  author?: string;
  publishedAt?: string;
  url?: string;
  metadata?: Record<string, string>;
  wordCount: number;
  language: 'zh' | 'en' | 'mixed';
  quality?: number;
}

// ─── Playtest ─────────────────────────────────────────────────────────────────

export type PlaytestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'partial';

export interface PlaytestCase {
  id: string;
  personaId: string;
  topic: string;
  topicCategory: string;
  prompt: string;
  expectedTraits: string[];
  avoidedTraits: string[];
  contextHint?: string;
}

export interface PlaytestResult {
  caseId: string;
  personaId: string;
  response: string;
  traitScores: Record<string, number>;
  avoidedScore: number;
  voiceScore: number;
  overallScore: number;
  notes?: string;
  timestamp: Date;
}

export interface PlaytestReport {
  personaId: string;
  date: Date;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  averageScore: number;
  grade: ScoreGrade;
  results: PlaytestResult[];
  improvements: ScoreFinding[];
  nextSteps: string[];
}

export interface ImprovementReport {
  priority: 'critical' | 'high' | 'medium';
  area: FindingCategory;
  finding: string;
  currentState: string;
  suggestedFix: string;
  estimatedImpact: number;
}

// ─── Distillation Session ──────────────────────────────────────────────────────

export interface DistillationSession {
  id: string;
  personaId: string;
  planId: string;
  status: PipelineStatus;
  currentStage: PipelineStage;
  currentWave: PipelineWave;
  startedAt: Date;
  completedAt?: Date;
  totalCost: number;
  totalTokens: number;
  score?: DistillationScore;
  playtestReport?: PlaytestReport;
  artifacts: DistillationArtifact[];
  errors: DistillationError[];
}

export interface DistillationArtifact {
  type: 'corpus' | 'dna-profile' | 'system-prompt' | 'playtest-log' | 'score-report' | 'skill-set';
  name: string;
  path: string;
  size: number;
  createdAt: Date;
}

export interface DistillationError {
  stage: PipelineStage;
  taskId: string;
  message: string;
  stack?: string;
  timestamp: Date;
  recoverable: boolean;
}

// ─── Scraper Coordinator ───────────────────────────────────────────────────────

export interface CoordinatorEvent {
  type: 'target_started' | 'target_progress' | 'target_completed' | 'target_failed' | 'wave_completed';
  targetId?: string;
  wave?: PipelineWave;
  progress?: ScrapingProgress;
  result?: CollectedItem[];
  error?: string;
  timestamp: Date;
}

export interface CollectionResult {
  personaId: string;
  totalItems: number;
  totalWords: number;
  itemsByType: Record<CollectorType, number>;
  quality: number;
  duration: number;
  errors: number;
  artifacts: CollectedItem[];
}
