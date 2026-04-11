/**
 * Prismatic — Global Constants
 */

export const APP_NAME = 'Prismatic · 折射之光';
export const APP_TAGLINE = '折射之光，让每一个卓越灵魂为你思考';
export const APP_DESCRIPTION = '汇聚人类最卓越思维的多智能体协作平台';

// ─── Demo / Experience Accounts ───────────────────────────────────────────────
// Shared between auth.ts and sign-in page (no DB required)
// DO NOT display prominently on the UI. Share privately with clients.

export const DEMO_ACCOUNTS = [
  { email: 'demo1@prismatic.app', password: 'Prismatic2024!', label: '演示账号 1' },
  { email: 'demo2@prismatic.app', password: 'Prismatic2024!', label: '演示账号 2' },
  { email: 'demo3@prismatic.app', password: 'Prismatic2024!', label: '演示账号 3' },
  { email: 'demo4@prismatic.app', password: 'Prismatic2024!', label: '演示账号 4' },
  { email: 'demo5@prismatic.app', password: 'Prismatic2024!', label: '演示账号 5' },
] as const;

// Supported languages
export const LANGUAGES = {
  zh: '中文',
  en: 'English',
  auto: '自动',
} as const;

// Conversation modes — each has a distinct user intent
export const MODES = {
  solo: {
    id: 'solo',
    label: '单人对话',
    labelEn: 'Solo Chat',
    description: '选择一个思维伙伴，连续追问，挖掘深层思维',
    when: '想深入学透一个思想家的思维方式时',
    how: '问 → 答 → 追问 → 再答，像真正的师徒对话',
    minParticipants: 1,
    maxParticipants: 1,
    icon: '👤',
  },
  prism: {
    id: 'prism',
    label: '折射视图',
    labelEn: 'Multi-Perspective',
    description: '多视角全面分析，系统自动输出综合结论',
    when: '想快速全面了解一个问题时',
    how: '2-3人并行回答 → 系统综合共识与分歧 → 你获得完整认知地图',
    minParticipants: 2,
    maxParticipants: 3,
    icon: '🔺',
  },
  roundtable: {
    id: 'roundtable',
    label: '圆桌辩论',
    labelEn: 'Round Table',
    description: '多个思想家真正来回碰撞，发现你没想到的盲点',
    when: '想被挑战、找到思维漏洞时',
    how: 'A说 → B反驳 → A回应 → C补充 → 观点碰撞收敛 → 盲点显现',
    minParticipants: 3,
    maxParticipants: 6,
    icon: '🏛️',
  },
  mission: {
    id: 'mission',
    label: '任务模式',
    labelEn: 'Mission Mode',
    description: '多角色分工协作，产出完整可用的结构化成果',
    when: '需要一个完整可用的产出物时',
    how: '分解任务 → 各角色执行 → 整合输出完整作品（计划/大纲/方案）',
    minParticipants: 2,
    maxParticipants: 6,
    icon: '🎯',
  },
} as const;

// Domain labels
export const DOMAINS = {
  product: { label: '产品', labelEn: 'Product' },
  design: { label: '设计', labelEn: 'Design' },
  strategy: { label: '战略', labelEn: 'Strategy' },
  investment: { label: '投资', labelEn: 'Investment' },
  philosophy: { label: '哲学', labelEn: 'Philosophy' },
  technology: { label: '科技', labelEn: 'Technology' },
  leadership: { label: '领导力', labelEn: 'Leadership' },
  creativity: { label: '创意', labelEn: 'Creativity' },
  education: { label: '教育', labelEn: 'Education' },
  negotiation: { label: '谈判', labelEn: 'Negotiation' },
  science: { label: '科学', labelEn: 'Science' },
  risk: { label: '风险管理', labelEn: 'Risk' },
} as const;

// Color palette for personas
export const PERSONA_COLORS = {
  jobs: { accent: '#ff6b6b', from: '#ff6b6b', to: '#ff9f43' },
  musk: { accent: '#6bcb77', from: '#6bcb77', to: '#4d96ff' },
  munger: { accent: '#4d96ff', from: '#4d96ff', to: '#c77dff' },
  naval: { accent: '#ffd93d', from: '#ffd93d', to: '#ff9f43' },
  feynman: { accent: '#c77dff', from: '#c77dff', to: '#ff6b9d' },
  graham: { accent: '#67e8f9', from: '#67e8f9', to: '#6bcb77' },
  yiming: { accent: '#ff9f43', from: '#ff9f43', to: '#ff6b6b' },
  karpathy: { accent: '#6bcb77', from: '#6bcb77', to: '#ffd93d' },
  taleb: { accent: '#ff6b9d', from: '#ff6b9d', to: '#c77dff' },
  xuefeng: { accent: '#ffd93d', from: '#ffd93d', to: '#ff9f43' },
  trump: { accent: '#ff6b6b', from: '#ff6b6b', to: '#ff6b9d' },
  mrbeast: { accent: '#6bcb77', from: '#6bcb77', to: '#ffd93d' },
  ilya: { accent: '#4d96ff', from: '#4d96ff', to: '#67e8f9' },
  sunzi: { accent: '#c77dff', from: '#c77dff', to: '#4d96ff' },
  seneca: { accent: '#94a3b8', from: '#94a3b8', to: '#c77dff' },
} as const;

// Animation durations
export const ANIMATION = {
  fast: 150,
  normal: 300,
  slow: 500,
  stagger: 80,
} as const;

// API endpoints
export const API = {
  chat: '/api/chat',
  personas: '/api/personas',
  conversation: '/api/conversation',
  graph: '/api/graph',
} as const;
