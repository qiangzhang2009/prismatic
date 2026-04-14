# Prismatic · 棱镜之光

> **一个汇聚人类最卓越思维的系统。让乔布斯、马斯克、芒格、费曼同时为你思考。**

---

## 一、核心理念

### 1.1 名字

**Prismatic** — 棱镜。

白光穿过棱镜，折射出七彩光谱。每一个卓越灵魂就像一束白光穿过棱镜时的一道颜色——单独存在时是独特的光，汇聚在一起时，便是完整的光谱。

### 1.2 一句话定位

Prismatic 是一个 **多智能体思维协作平台** — 不是单个人物的角色扮演，而是多个蒸馏人物的实时协作辩论、联合分析与协同任务执行。

### 1.3 与女娲的区别

| 维度 | 女娲 | Prismatic |
|------|------|-----------|
| 交互模式 | 单人对话 | 多人实时协作 |
| 协作深度 | 无 | 辩论/分析/任务分工 |
| 知识图谱 | 无 | 动态可视化的跨人物认知地图 |
| 部署形态 | Claude Code Skill | 独立 Web 应用 |
| 用户门槛 | 需要会用 Claude Code | 任何人打开浏览器即用 |
| 商业化路径 | Skill 生态 | SaaS 订阅 / API 平台 |

---

## 二、系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    Prismatic Platform                    │
├─────────────────────────────────────────────────────────┤
│  Presentation Layer (Next.js 14, TypeScript, Tailwind)  │
│  ├── Chat Interface (Main)                               │
│  ├── Prism View (Multi-agent collaboration)             │
│  ├── Knowledge Graph (3D interactive visualization)      │
│  ├── Persona Library (Browse & activate)                 │
│  └── Settings & Personalization                          │
├─────────────────────────────────────────────────────────┤
│  Orchestration Layer (Agent Coordination Engine)         │
│  ├── Multi-Agent Router                                  │
│  ├── Debate Orchestrator                                │
│  ├── Task Decomposer & Delegator                        │
│  └── Consensus Analyzer                                  │
├─────────────────────────────────────────────────────────┤
│  Agent Execution Layer (Prismatic Agent Engine)           │
│  ├── Agent Factory (spawn agent instances)               │
│  ├── SKILL Executor (per-persona reasoning)             │
│  ├── Context Manager (shared + private memory)           │
│  └── Voice Calibrator (expression DNA enforcement)      │
├─────────────────────────────────────────────────────────┤
│  Knowledge Layer                                          │
│  ├── Persona Registry (15 pre-built personas)           │
│  ├── Mental Model Graph (cross-persona connections)      │
│  ├── Conversation Memory (persistent context)             │
│  └── Source Attribution Engine                           │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                          │
│  ├── LLM Gateway (OpenAI / Anthropic / local)          │
│  ├── Vector Database (Pinecone / Qdrant)                │
│  ├── Redis (session state & caching)                   │
│  └── S3 (conversation archives)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 三、核心功能

### 3.1 Prism Chat（主对话）

用户在主输入框提问，选择激活的人物数量（1-N个），系统自动路由：

- **1个人物**：标准单智能体对话，直接激活该人物
- **2-3个人物**：自动进入「折射视图」— 每个人物分别分析，然后系统生成综合视角
- **4+个人物**：进入「圆桌辩论」模式 — 每个人物依次发表观点，系统识别分歧点，推进辩论收敛

### 3.2 折射视图（Prism View）

三个人物视角的实时并行展示：

```
┌──────────────┬──────────────┬──────────────┐
│   Naval     │    Musk     │    Jobs     │
│  [视角标签]  │  [视角标签]  │  [视角标签]  │
├──────────────┼──────────────┼──────────────┤
│  分析内容    │  分析内容    │  分析内容    │
│  ...        │  ...        │  ...        │
├──────────────┴──────────────┴──────────────┤
│  ▸ 综合共识 · 分歧点识别 · 收敛建议        │
└─────────────────────────────────────────────┘
```

每个视角卡片有：
- 该人物的专属「视角标签」动画（色彩对应人物气质）
- 置信度指示（他们对这个问题有多少把握）
- 引用来源（从哪本书/访谈得出这个观点）

### 3.3 圆桌辩论（Round Table）

四个人物以上的深度协作场景：

1. **开场陈述**：每个人物用30秒发表开场观点
2. **交叉质询**：指定某人物向另一人物提问
3. **分歧收敛**：系统识别核心分歧，引导辩论聚焦
4. **共识输出**：生成三方/多方共识陈述
5. **行动建议**：给出具体可执行的建议清单

### 3.4 任务模式（Mission Mode）

不是聊天，是任务委托。选择人物组合 → 设定任务目标 → 系统自动分解执行。

**案例**：「用巴菲特和马斯克的视角，帮我评估这个创业方向」

系统自动分解：
- 巴菲特：财务护城河分析、长期价值评估
- 马斯克：第一性原理评估、渐近极限计算
- 系统综合：风险矩阵、决策建议

### 3.5 知识图谱（Knowledge Constellation）

三维交互式可视化，展示：

- **人物-概念连接**：乔布斯→「聚焦」→「端到端控制」→与芒格的「逆向思维」的连接
- **跨人物共识**：多个不同人物共同认可的思维模型
- **认知距离**：两个人物思维方式的最大分歧点
- **用户个性化图谱**：基于用户最常使用的人物，生成个人认知风格画像

### 3.6 人物档案馆（Persona Library）

完整的人物资料库，支持：
- 按领域筛选（商业/科技/投资/哲学/创意/政治）
- 按认知特质筛选（激进/审慎/直觉/数据驱动）
- 按合作兼容性筛选（谁和谁一起工作最好）
- 深度阅读每个人物的完整 SKILL 数据（心智模型 + 启发式 + 表达DNA + 诚实边界）

---

## 四、人物角色库（47个蒸馏人物）

| # | 人物 | 领域 | 核心价值 |
|---|------|------|---------|
| 1 | Steve Jobs | 产品/设计/战略 | 技术×人文交汇 |
| 2 | Elon Musk | 工程/成本/第一性原理 | 渐近极限思维 |
| 3 | Charlie Munger | 投资/多元思维 | 逆向分析框架 |
| 4 | Naval Ravikant | 财富/杠杆/人生哲学 | 重新定义问题 |
| 5 | Richard Feynman | 学习/科学思维 | 第一性简化 |
| 6 | Paul Graham | 创业/写作 | 深层类比能力 |
| 7 | Zhang Yiming | 产品/组织/全球化 | 理性+延迟满足 |
| 8 | Andrew Karpathy | AI/工程/教育 | 工程现实主义 |
| 9 | Nassim Taleb | 风险/反脆弱 | 尾部思维 |
| 10 | Zhang Xuefeng | 教育/职业规划 | ROI现实主义 |
| 11 | Donald Trump | 谈判/权力/传播 | 极端锚定+叙事 |
| 12 | MrBeast | 内容创作/增长 | 注意力工程 |
| 13 | Ilya Sutskever | AI安全/scaling | 深度学习直觉 |
| 14 | Sun Tzu (孙子) | 战略/战争 | 不战而胜框架 |
| 15 | Seneca (塞涅卡) | 斯多葛/领导力 | 时间即唯一资产 |

---

## 五、技术栈

### 前端
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand (client) + React Query (server)
- **Visualization**: React-Three-Fiber (知识图谱3D)
- **Animations**: Framer Motion

### 后端
- **Runtime**: Node.js 20 + Next.js API Routes
- **LLM Gateway**: Vercel AI SDK (OpenAI / Anthropic / Azure / Local)
- **Vector DB**: Pinecone 或 Qdrant (自托管)
- **Cache**: Redis (Upstash)
- **Session**: NextAuth.js

### 基础设施
- **Deployment**: Vercel (Frontend) + Railway/Render (Backend)
- **CI/CD**: GitHub Actions
- **Monitoring**: Axiom (日志) + Sentry (错误追踪)

---

## 六、数据模型

### Persona

```typescript
interface Persona {
  id: string;
  name: string;
  nameZh: string;
  slug: string;              // steve-jobs
  domain: string[];           // ["product", "design", "strategy"]
  avatar: string;
  accentColor: string;       // 视角卡片的强调色
  tagline: string;           // 一句话标签
  
  // 核心认知数据
  mentalModels: MentalModel[];    // 3-7个心智模型
  decisionHeuristics: Heuristic[]; // 5-10条决策启发式
  expressionDNA: ExpressionDNA;     // 表达DNA
  values: Value[];                 // 价值观排序
  antiPatterns: string[];           // 明确拒绝的行为
  tensions: Tension[];              // 内在张力
  
  // 诚实边界
  honestBoundaries: string[];      // 这个SKILL做不到的事
  strengths: string[];             // 擅长领域
  blindspots: string[];            // 已知盲区
  
  // 元数据
  sources: Source[];
  researchDate: string;
  version: string;
}
```

### MentalModel

```typescript
interface MentalModel {
  id: string;
  name: string;
  nameZh: string;
  oneLiner: string;         // 一句话描述
  evidence: Evidence[];      // 来源证据
  crossDomain: string[];    // 跨域验证的领域
  application: string;       // 应用场景
  limitation: string;       // 失效条件
  generationPower: string;  // 生成力描述
  exclusivity: string;       // 排他性描述
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  mode: 'solo' | 'prism' | 'roundtable' | 'mission';
  participants: string[];    // 激活的人物ID列表
  messages: Message[];
  consensus?: Consensus;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

interface Message {
  id: string;
  personaId: string;
  role: 'agent' | 'user' | 'system';
  content: string;
  timestamp: Date;
  modelUsed?: string;      // 使用了哪个心智模型
  confidence?: number;      // 置信度 0-1
  sources?: string[];       // 引用来源
}
```

### KnowledgeNode

```typescript
interface KnowledgeNode {
  id: string;
  type: 'concept' | 'mental_model' | 'heuristic' | 'value';
  label: string;
  labelZh: string;
  personaIds: string[];      // 关联的人物
  connections: Connection[];
  strength: number;         // 连接强度
}
```

---

## 七、部署架构

### 环境变量

```env
# LLM Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Vector Database
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
```

### Docker (本地开发)

```dockerfile
# 单容器设计，适合 Railway/Render 部署
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 八、设计语言

### 色彩系统

```css
/* 背景层次 */
--bg-base: #0a0a0f;           /* 深空背景 */
--bg-surface: #12121a;        /* 卡片背景 */
--bg-elevated: #1a1a25;       /* 悬浮层 */
--bg-overlay: #22222e;         /* 模态框 */

/* 主色调：折射棱镜 */
--prism-1: #ff6b6b;            /* 红 - Jobs */
--prism-2: #ffd93d;            /* 黄 - Naval */
--prism-3: #6bcb77;            /* 绿 - Musk */
--prism-4: #4d96ff;            /* 蓝 - Munger */
--prism-5: #c77dff;            /* 紫 - Feynman */
--prism-6: #ff9f43;            /* 橙 - Taleb */
--prism-neutral: #64748b;      /* 中性灰 */

/* 文字 */
--text-primary: #f1f5f9;
--text-secondary: #94a3b8;
--text-muted: #475569;
```

### 字体

- **标题**: Inter Tight (Google Fonts) — 几何感，现代
- **正文**: Inter — 高可读性
- **代码/引用**: JetBrains Mono — 清晰
- **中文回退**: Noto Sans SC

### 动效原则

- **折射入场**：人物视角卡片从中心向两侧展开，opacity 0→1，translateY 20→0，staggered 80ms
- **视角切换**：卡片切换时用 prism 色差滤镜动画（hue-rotate transition）
- **图谱节点**：3D 节点hover时发出棱镜光芒扩散效果
- **共识收敛**：当辩论收敛时，所有分歧的红色连接线渐变为绿色共识线

---

## 九、里程碑

| 阶段 | 内容 | 状态 |
|------|------|------|
| MVP | 单人对话 + 5个人物 + 基本UI | ✅ 已完成 |
| v1.0 | 折射视图(3人) + 知识图谱 + 15人物 | ✅ 已完成 |
| v1.5 | 圆桌辩论 + 任务模式 + 用户记忆 | ✅ 已完成 |
| v1.7 | 智辩场 + 守望者计划 + 评论系统 | ✅ 已完成 |
| v1.8 | 量化蒸馏 + Playtest + 表达DNA提取 | ✅ 已完成 |
| v2.0 | API平台 + 多租户 + 插件系统 | 🚧 规划中 |

## 十、核心文档

| 文档 | 用途 |
|------|------|
| `docs/PROJECT_EVALUATION.md` | 阶段性评估报告（工程/数据/设计） |
| `docs/SKILLS_TOOLBOX.md` | 已实现功能蒸馏的 15 个可复用工具箱 |

---

*Prismatic — 棱镜之光，让每一个卓越灵魂为你思考。*
