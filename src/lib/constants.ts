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
// IMPORTANT: Mode IDs are stored in DB — do NOT change existing IDs.
// Only update labels, descriptions, and tags here.
// Deprecated modes (oracle, fiction) are kept in code for backward compat but hidden from UI.
export const MODES = {
  // ── 导师型 ────────────────────────────────────────────────────────
  solo: {
    id: 'solo',
    label: '导师对话',
    labelEn: 'Mentor Match',
    tagline: '找最懂你的大师，深入聊透',
    description: '选择一个思维伙伴，连续追问，挖掘深层思维——像真正的师徒对话',
    when: '想深入学透一个思想家的思维方式，或遇到困惑需要大师指点时',
    how: '问 → 答 → 追问 → 再答，系统自动推荐最匹配的人物',
    minParticipants: 1,
    maxParticipants: 1,
    icon: '👤',
    accent: '#6366f1',
  },
  prism: {
    id: 'prism',
    label: '折射视图',
    labelEn: 'Prism View',
    tagline: '多视角汇聚，认知升级',
    description: '2-3人并行分析，系统自动提炼共识、分歧与盲点，给你完整认知地图',
    when: '想快速全面了解一个问题，或需要一个综合判断时',
    how: '2-3人并行回答 → 系统综合共识与分歧 → 揭示共同盲点',
    minParticipants: 2,
    maxParticipants: 3,
    icon: '🔺',
    accent: '#8b5cf6',
  },

  // ── 辩论型 ────────────────────────────────────────────────────────
  roundtable: {
    id: 'roundtable',
    label: '圆桌辩论',
    labelEn: 'Round Table',
    tagline: '让思想真正碰撞，暴露你的思维盲点',
    description: '3-6位思想家真正来回碰撞，揭示你没想到的思维漏洞和盲点',
    when: '想被挑战、找到自己的思维漏洞时',
    how: 'A说 → B反驳 → A回应 → C补充 → 观点收敛 → 盲点显现',
    minParticipants: 3,
    maxParticipants: 6,
    icon: '🏛️',
    accent: '#0ea5e9',
  },
  epoch: {
    id: 'epoch',
    label: '关公战秦琼',
    labelEn: 'Cross-Era Clash',
    tagline: '跨越时空的正面对决',
    description: '两位不同时代的人物，就同一问题展开针锋相对的辩论——历史与未来的碰撞',
    when: '想看两种截然不同的世界观在同一问题上如何正面交锋',
    how: '正方 → 反方 → 正方回应 → 反方反驳 → 裁判总结胜负点',
    minParticipants: 2,
    maxParticipants: 2,
    icon: '⚔️',
    accent: '#ef4444',
  },

  // ── 产出型 ────────────────────────────────────────────────────────
  mission: {
    id: 'mission',
    label: '任务特攻队',
    labelEn: 'Task Force',
    tagline: '复杂任务，交给专家团队',
    description: '多角色分工协作：分解任务 → 各角色执行 → 整合输出完整可用的结构化成果',
    when: '需要一个完整可用的产出物（方案/计划/报告）时',
    how: '分解任务 → 各角色分工 → 执行 → 整合输出完整作品',
    minParticipants: 2,
    maxParticipants: 6,
    icon: '🎯',
    accent: '#10b981',
  },

  // ── 顾问型 ────────────────────────────────────────────────────────
  // council 模式在 API 层与 mission 共用 Task Force handler，
  // 但在 UI 中已隐藏，用户只能通过 mission 入口体验。
  council: {
    id: 'council',
    label: '顾问团',
    labelEn: 'Advisory Council',
    tagline: '群贤毕至，共谋大计',
    description: '各领域顾问给出专业建议，最终汇总成一套完整行动方案',
    when: '面对重大决策，需要多方专业意见时',
    how: '每人从各自专长出发给建议 → 交叉点评 → 形成共识行动方案',
    minParticipants: 2,
    maxParticipants: 4,
    icon: '🎩',
    accent: '#f59e0b',
  },

  // ── 洞察型 ────────────────────────────────────────────────────────
  // oracle 能力已融合进 Prism 模式（当问题含"未来/预测/趋势"关键词时自动触发）。
  // 独立模式保留用于 API 兼容，但不在 UI 中展示。
  oracle: {
    id: 'oracle',
    label: '预言家',
    labelEn: 'Oracle',
    tagline: '站在未来，回望现在',
    description: '思想家以未来视角，诊断现状并预测发展趋势',
    when: '需要战略预判或看清事物发展的深层逻辑时',
    how: '诊断现状 → 找关键变量 → 预测3-5年趋势 → 给出判断依据',
    minParticipants: 1,
    maxParticipants: 2,
    icon: '🔮',
    accent: '#a855f7',
  },

  // ── 创意型 ────────────────────────────────────────────────────────
  // fiction 模式已转为活动模板，不在日常 UI 中展示。
  fiction: {
    id: 'fiction',
    label: '共创故事',
    labelEn: 'Co-Create Fiction',
    tagline: '让伟人走进你的故事',
    description: '多个角色共同演绎一个故事，每个角色保持独特的语言风格',
    when: '想用故事形式理解思想，或纯粹享受沉浸式叙事时',
    how: '设定背景 → 人物出场 → 情节推进 → 每人说自己的话、做自己的决定',
    minParticipants: 2,
    maxParticipants: 3,
    icon: '📖',
    accent: '#ec4899',
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
  history: { label: '历史', labelEn: 'History' },
  literature: { label: '文学', labelEn: 'Literature' },
  business: { label: '商业', labelEn: 'Business' },
  economics: { label: '经济学', labelEn: 'Economics' },
  stoicism: { label: '斯多葛主义', labelEn: 'Stoicism' },
  psychology: { label: '心理学', labelEn: 'Psychology' },
  'zen-buddhism': { label: '禅宗', labelEn: 'Zen Buddhism' },
  spirituality: { label: '灵性', labelEn: 'Spirituality' },
  AI: { label: '人工智能', labelEn: 'AI' },
  engineering: { label: '工程', labelEn: 'Engineering' },
  ethics: { label: '伦理学', labelEn: 'Ethics' },
  fiction: { label: '文学创作', labelEn: 'Fiction' },
  medicine: { label: '医学', labelEn: 'Medicine' },
  semiconductor: { label: '半导体', labelEn: 'Semiconductor' },
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
  USER: 20,        // 普通用户每日对话上限
  GUARDIAN: 65,    // 值班人物每日互动上限（含主动辩论）
} as const;

// ─── Debate Arena — TCM Internationalization Topics (临时主题) ─────────────────────
// 2026-05-07 至 2026-05-13 一周围绕"中医出海"主题

export const DEBATE_TCM_INTERNATIONAL_TOPICS = [
  '中医国际化的最大障碍是文化差异还是科学验证？',
  '中医诊所出海：应该坚持传统辨证还是接受标准化改造？',
  '中药国际化：成分标准化会失去疗效，还是走向世界的必经之路？',
  '针灸的国际传播：是科学还是文化？',
  '中医教育输出：培养海外中医人才还是服务当地患者更重要？',
  '中医与西医合作：互补共进还是各守阵地？',
  '中医膳补产品出海：食品监管框架下的机遇与挑战',
  '中医出海：应该服务华人社区还是真正走进当地主流市场？',
] as const;

// 临时主题有效期：2026-05-07 00:00:00 至 2026-05-14 00:00:00
export function isTCMInternationalPeriod(): boolean {
  const now = new Date();
  const start = new Date('2026-05-07T00:00:00+08:00');
  const end = new Date('2026-05-14T00:00:00+08:00');
  return now >= start && now < end;
}

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
