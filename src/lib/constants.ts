/**
 * Prismatic — Global Constants
 */

export const APP_NAME = '棱镜折射';
export const APP_TAGLINE = '棱镜折射，让每一个卓越灵魂为你思考';
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
  forumDebate: '/api/forum/debate',
} as const;

// ─── Daily usage limits ─────────────────────────────────────────────────────────

export const DAILY_LIMITS = {
  USER: 10,        // 普通用户每日对话上限
  GUARDIAN: 65,    // 值班人物每日互动上限（含主动辩论）
} as const;

// ─── Debate Arena — Smart Topic Pool ─────────────────────────────────────────
// 经审核的安全话题池，辩论引擎会从中选取话题
// 政治/暴力/仇恨/色情话题已全部过滤

export const DEBATE_SAFE_TOPICS = [
  // AI 与技术
  'AI 会取代大部分人类工作吗？',
  '人工智能是否终将拥有真正的创造力？',
  '大语言模型是否真正"理解"世界？',
  '社交媒体让人类更孤独还是更连接？',
  '算法推荐是在丰富我们还是在囚禁我们？',

  // 思维与方法论
  '成功到底靠天赋还是靠努力？',
  '延迟满足在今天是否仍然重要？',
  '知识爆炸的时代，我们还需要背诵记忆吗？',
  '直觉可靠吗？理性思考是否总是更好？',
  '多元思维模型是工具还是思维方式？',

  // 人生与意义
  '幸福究竟来自内在还是外在条件？',
  '人生的意义是发现的还是创造的？',
  '我们应该追求卓越还是追求平衡？',
  '痛苦是成长的必要条件吗？',
  '年龄增长必然带来智慧吗？',

  // 教育与学习
  '传统大学教育还值得投入吗？',
  '最好的学习方式是做中学还是系统学习？',
  '失败是成功之母，还是成功才让人真正成长？',
  '我们应该如何教育下一代？',
  '好奇心是天生的还是后天培养的？',

  // 商业与创造
  '模仿与创新，哪个更能推动进步？',
  '追求效率最大化是否让生活更美好？',
  '颠覆式创新和渐进式创新，哪个更有价值？',
  '品牌是一种承诺还是一种感觉？',
  '创业精神可以教会吗？',

  // 科学与社会
  '气候变化：个人行动还是系统变革更有效？',
  '技术进步会让不平等加剧还是缓解？',
  '我们应该在多大程度上信任专家？',
  '隐私权在数字时代是否已经名存实亡？',
  '言论自由的边界在哪里？',

  // 哲学与认知
  '自由意志存在吗？',
  '缸中之脑——我们如何证明自己是真实的？',
  '时间旅行在逻辑上可能吗？',
  '幸福可以被客观测量吗？',
  '什么是美？美是主观的还是客观的？',

  // 人际关系
  '真诚是与人建立关系的最好策略吗？',
  '长期关系中，激情与承诺哪个更重要？',
  '宽恕是一种力量还是一种软弱？',
  '我们应该追求被人喜欢还是被人尊重？',
  '孤独对于创造和思考是必要的吗？',

  // 游戏化设计
  '游戏化是提升动机的有效工具，还是一种操控？',
  '积分/排行榜等外部奖励会破坏内部动机吗？',
  '游戏是否正在成为一种新的叙事艺术形式？',
] as const;

// ─── Debate Arena — Content Safety Keywords ───────────────────────────────────
// 高风险关键词，任何话题中包含这些词则自动拒绝

export const DEBATE_BANNED_KEYWORDS = [
  // 政治敏感词
  '国家领导人', '总书记', '主席', '总理', '总统', '首相', '国王', '女王',
  '共产党', '国民党', '民主党', '共和党', '执政党', '在野党',
  '天安门', '六四', '坦克人', '新疆', '西藏', '台湾', '香港',
  '占领中环', '雨伞', '反送中', '文革', '大跃进',
  '习近', '毛泽东', '邓小平', '江泽民', '胡锦涛', '奥巴马', '特朗普', '拜登',
  '军政府', '民主选举', '推翻', '暴动', '革命',
  // 暴力
  '杀人', '谋杀', '恐怖袭击', '炸弹', '枪击',
  // 色情
  '色情', '黄色', '裸体', '卖淫',
  // 歧视
  '种族优越', '清洗',
] as const;
