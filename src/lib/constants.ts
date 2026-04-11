/**
 * Prismatic — Global Constants
 */

export const APP_NAME = '炼心阁';
export const APP_TAGLINE = '折射之光，让每一个卓越灵魂为你思考';
export const APP_DESCRIPTION = '汇聚人类最卓越思维的多智能体协作平台';

// Supported languages
export const LANGUAGES = {
  zh: '中文',
  en: 'English',
  auto: '自动',
} as const;

// Conversation modes
export const MODES = {
  solo: {
    id: 'solo',
    label: '单人对话',
    labelEn: 'Solo Chat',
    description: '选择一个思维伙伴，深入探讨',
    minParticipants: 1,
    maxParticipants: 1,
    icon: '👤',
  },
  prism: {
    id: 'prism',
    label: '折射视图',
    labelEn: 'Prism View',
    description: '2-3个视角同时分析，全面透视',
    minParticipants: 2,
    maxParticipants: 3,
    icon: '🔺',
  },
  roundtable: {
    id: 'roundtable',
    label: '圆桌辩论',
    labelEn: 'Round Table',
    description: '4+人物实时辩论，收敛共识',
    minParticipants: 4,
    maxParticipants: 8,
    icon: '🏛️',
  },
  mission: {
    id: 'mission',
    label: '任务模式',
    labelEn: 'Mission Mode',
    description: '多角色分工协作，完成复杂任务',
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
