---
name: Prismatic Pro 从零构建
overview: 基于对现有棱镜折射 v1.8 的全面审视，从零开始构建 Prismatic Pro。整合 hermes-agent（自进化机制）、LLM Wiki v2（四层记忆架构）、gstack（Sprint Pipeline）三大参考项目的最佳实践。解决规划/实现断层、流式输出缺失、真实多智能体协作缺失、数据沉睡、游戏化缺失五大核心问题。2.7GB 原始语料仅作为**离线蒸馏燃料**，运行时加载 ~10-50KB/人的紧凑 Persona 核心 JSON，无向量检索。内置完整后台管理系统（角色权限/点数/订阅）、用户行为采集管道（事件+对话+画像）和多层次可扩展性设计。

**计费模式：User-Pays（用户自备 API Key）。开发者零基础设施成本，彻底绕过支付牌照、AI 备案、税务等监管障碍。**
todos:
  - id: init
    content: 项目初始化：Next.js 14 + TypeScript + Tailwind + Prisma + ESLint
    status: pending
  - id: design-system
    content: 设计系统：CSS变量 + 色彩系统 + 排版 + 基础组件
    status: pending
  - id: llm-gateway
    content: LLM 网关：Provider抽象 + SSE流式 + Persona核心注入
    status: pending
  - id: database
    content: 数据库：Prisma schema + Neon连接
    status: pending
  - id: persona-data
    content: Persona 数据层：注册表 + 种子数据 + 工具函数
    status: pending
  - id: memory-system
    content: 四层记忆系统：Tiers + Decay + Supersession + Crystallization（LLM Wiki v2）
    status: pending
  - id: orchestrator
    content: 多智能体编排器：Agent基类 + PersonaAgent + Synthesizer + Orchestrator
    status: pending
  - id: chat-ui
    content: 对话 UI：流式渲染 + 折射卡片 + 置信度条 + 模式面板
    status: pending
  - id: knowledge-graph
    content: 知识星图：D3力导向图 + 节点/边渲染
    status: pending
  - id: gamification
    content: 游戏化系统：掌握度 + 成就 + 每日挑战 + 解锁
    status: pending
  - id: arena
    content: 智辩场：辩论引擎 + 守望者轮值 + 投票
    status: pending
  - id: distillation-studio
    content: 蒸馏平台：SSE进度流 + Playtest + 评分报告
    status: pending
  - id: studio-ui
    content: Persona Studio 管理界面
    status: pending
  - id: admin-panel
    content: 后台管理：角色权限 + 点数系统 + 订阅管理 + 用户管理
    status: pending
  - id: analytics
    content: 用户行为采集：事件埋点 + 对话归档 + 用户画像 + 数据利用
    status: pending
isProject: false
---

# Prismatic Pro · 从零构建规划

## 一、顶层设计决策

### 1.1 产品定位（清晰化）
**锚定"严肃智识工具"而非"娱乐对话"**。
- 目标用户：追求深度思考、决策辅助、认知升级的知识工作者
- 核心价值主张：**"借卓越灵魂之力，做更明智的决策"**
- personas 分层：核心 personas（20个深度精选）+ 探索 personas（按需解锁）
- 禁用娱乐化 personas（如 Trump、MrBeast）进入核心体验

### 1.2 技术架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Prismatic Pro                                  │
├───────────────────────────────────────────────────────────────────┤
│  前端：Next.js 14 (App Router) · TypeScript 5 · Tailwind        │
│        Framer Motion + React-Spring 动效                          │
│        Recharts + D3 知识图谱                                      │
│        Zustand 状态 · TanStack Query 服务                         │
├───────────────────────────────────────────────────────────────────┤
│  记忆层：四层记忆系统 (LLM Wiki v2 启发)                           │
│        ShortTerm · WorkingMemory · LongTerm · Crystallized        │
│        Decay · Supersession · Confidence                          │
├───────────────────────────────────────────────────────────────────┤
│  编排层：真正的 Multi-Agent Orchestrator (gstack Sprint 启发)      │
│        Agent间通信 · 共享工作记忆 · 迭代收敛                        │
│        Think→Plan→Build→Review→Test→Ship                         │
│        自进化机制 · Skills系统                                     │
├───────────────────────────────────────────────────────────────────┤
│  LLM 网关：DeepSeek (默认) · OpenAI · Anthropic                   │
│        Persona 核心 JSON 直接注入 Prompt                            │
│        【User-Pays】用户自备 Key → 加密存储 → 优先路由              │
│        Redis 会话缓存 · S3 对话存档                                │
├───────────────────────────────────────────────────────────────────┤
│  数据库：Neon Serverless PostgreSQL                               │
│        用户管理 · 会话 · 游戏化 · 行为事件 · 订阅                  │
│        【新增】User.apiKeyEncrypted (AES-256-GCM 加密)             │
├───────────────────────────────────────────────────────────────────┤
│  分析层：【新】行为采集 + 用户画像 + 对话归档                       │
│        ClickHouse /pg_analytics 实时分析                           │
│        S3 对话历史归档 · 用户事件流 · 漏斗分析                     │
├───────────────────────────────────────────────────────────────────┤
│  后台管理：【新】角色权限 · 点数系统 · 订阅管理 · 运营看板         │
│        Admin Dashboard · RBAC · 审计日志                           │
│        【改动】点数系统仅用于 Pro 功能解锁，不含 AI 消耗             │
├───────────────────────────────────────────────────────────────────┤
│  蒸馏平台：SSE 进度流 · Playtest · 量化评分                        │
│        Persona Studio · 离线蒸馏 Pipeline                           │
│        【改动】蒸馏调用由用户自己的 API Key 驱动                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、项目结构

```
prismatic-pro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # 首页（Hero + 语料可视化 + 模式入口）
│   │   ├── (main)/
│   │   │   ├── chat/page.tsx   # 主对话（流式输出）
│   │   │   ├── graph/page.tsx  # 知识星图（D3 可交互）
│   │   │   ├── arena/page.tsx  # 智辩场
│   │   │   └── studio/         # Persona Studio（蒸馏管理）
│   │   ├── personas/
│   │   │   ├── page.tsx        # 人物档案馆（解锁制）
│   │   │   └── [id]/page.tsx   # 人物详情
│   │   ├── auth/               # 认证
│   │   ├── admin/              # 【新】后台管理
│   │   │   ├── dashboard/      # 运营看板
│   │   │   ├── users/          # 用户管理
│   │   │   ├── roles/          # 角色权限
│   │   │   ├── points/         # 点数系统
│   │   │   ├── subscriptions/  # 订阅管理
│   │   │   └── audit/          # 审计日志
│   │   ├── api/
│   │   │   ├── chat/route.ts   # 对话 API（流式 SSE）【User-Pays: 优先用户 Key】
│   │   │   ├── agents/route.ts # 多智能体编排
│   │   │   ├── debate/route.ts # 辩论引擎
│   │   │   ├── graph/route.ts  # 知识图谱查询
│   │   │   ├── distill/        # 蒸馏流水线
│   │   │   ├── analytics/      # 【新】行为事件上报
│   │   │   ├── admin/          # 【新】后台管理 API
│   │   │   ├── user/           # 【新增】用户计费管理
│   │   │   │   └── api-key/    # User API Key CRUD + 验证
│   │   │   │       └── route.ts
│   │   │   └── webhooks/       # 【新】外部 Webhook
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── chat/
│   │   ├── graph/
│   │   ├── arena/
│   │   ├── game/
│   │   ├── admin/              # 【新】后台管理组件
│   │   │   ├── user-table.tsx       # 用户列表 + 搜索/筛选
│   │   │   ├── role-editor.tsx      # 角色权限编辑器
│   │   │   ├── points-manager.tsx    # 点数充值/消耗记录
│   │   │   ├── subscription-panel.tsx # 订阅状态管理
│   │   │   ├── cost-dashboard.tsx  # 【新增】成本测算 Dashboard
│   │   │   └── audit-log.tsx        # 操作审计日志
│   │   ├── analytics/          # 【新】数据分析组件
│   │   │   ├── funnel-chart.tsx      # 转化漏斗
│   │   │   ├── retention-heatmap.tsx # 留存热力图
│   │   │   └── persona-usage.tsx    # Persona 使用排行
│   │   ├── billing/            # 【新增】User-Pays 计费系统
│   │   │   ├── api-key-modal.tsx    # API Key 设置弹窗（核心入口）
│   │   │   ├── api-key-card.tsx    # Key 状态展示卡片
│   │   │   ├── usage-indicator.tsx  # 当前用量指示器
│   │   │   └── key-guide.tsx       # 设置引导 + DeepSeek 购买指引
│   │   └── ui/                   # 共享 UI 组件
│   │
│   ├── lib/
│   │   ├── personas/             # 【复用现有数据 + 蒸馏输出】
│   │   ├── llm/                  # LLM 网关
│   │   ├── knowledge/            # 【新】知识图谱
│   │   ├── game/                 # 【新】游戏化系统
│   │   ├── analytics/            # 【新】行为采集管道
│   │   │   ├── tracker.ts        # 前端事件埋点 SDK
│   │   │   ├── pipeline.ts       # 事件流处理
│   │   │   ├── user-profile.ts   # 用户画像构建
│   │   │   └── conversation-archiver.ts # 对话归档
│   │   ├── admin/               # 【新】后台管理
│   │   │   ├── rbac.ts           # 角色权限抽象
│   │   │   ├── points.ts         # 点数引擎
│   │   │   └── subscription.ts   # 订阅管理
│   │   │   ├── registry.ts       # getPersona 等工具函数
│   │   │   ├── index.ts          # 统一导出
│   │   │   ├── seed/             # 种子 personas（20个精选）
│   │   │   └── distillation/     # 离线蒸馏输出（~10-50KB/人）
│   │   │       ├── elon-musk.json
│   │   │       ├── confucius.json
│   │   │       └── ...           # 每个人物一个紧凑的核心数据文件
│   │   │
│   │   ├── memory/               # 【新】四层记忆系统 (LLM Wiki v2)
│   │   │   ├── tiers.ts          # 记忆层级抽象
│   │   │   ├── short-term.ts     # ShortTerm: 当前会话上下文
│   │   │   ├── working-memory.ts # WorkingMemory: 活跃知识聚合
│   │   │   ├── long-term.ts      # LongTerm: 持久化知识存储
│   │   │   ├── crystallized.ts    # Crystallized: 高置信度沉淀
│   │   │   ├── decay.ts          # 遗忘/衰减机制
│   │   │   ├── supersession.ts   # 知识覆盖更新
│   │   │   ├── consolidation.ts   # 记忆整合调度
│   │   │   └── confidence.ts     # 置信度评分引擎
│   │   │
│   │   ├── orchestrator/          # 【新】真正的多智能体编排
│   │   │   ├── agent.ts          # Agent 基类
│   │   │   ├── persona-agent.ts  # 人物 Agent（注入蒸馏核心）
│   │   │   ├── synthesizer.ts     # 综合 Agent
│   │   │   ├── moderator.ts      # 裁判 Agent
│   │   │   ├── orchestrator.ts   # 主编排器
│   │   │   ├── skills.ts         # Skills 系统 (hermes-agent 启发)
│   │   │   └── self-evolution.ts # 自进化机制
│   │   │
│   │   ├── llm/                  # 【增强】LLM 网关
│   │   │   ├── providers/
│   │   │   │   ├── deepseek.ts
│   │   │   │   ├── openai.ts
│   │   │   │   └── anthropic.ts
│   │   │   └── stream.ts         # SSE 流式工具
│   │                          # 【无 RAG】Persona 核心 JSON 直接注入 Prompt
│   │   │
│   │   ├── billing/              # 【新增】User-Pays 计费系统
│   │   │   ├── encryption.ts     # AES-256-GCM 加密工具（Node crypto）
│   │   │   ├── key-manager.ts    # API Key CRUD + 验证 + 回退逻辑
│   │   │   └── validators/       # 多 LLM Provider 的 Key 验证
│   │   │       ├── deepseek.ts
│   │   │       ├── openai.ts
│   │   │       └── anthropic.ts
│   │   │
│   │   ├── knowledge/            # 【新】知识图谱
│   │   │   ├── graph-store.ts    # 图谱数据存储
│   │   │   ├── query.ts          # 图谱查询
│   │   │   └── visualization.ts   # 可视化数据生成
│   │   │
│   │   ├── game/                 # 【新】游戏化系统
│   │   │   ├── mastery.ts         # 掌握度计算
│   │   │   ├── achievements.ts   # 成就系统
│   │   │   ├── quests.ts         # 每日任务
│   │   │   └── unlocks.ts        # 解锁系统
│   │   │
│   │   ├── distillation/          # 【复用并完善】
│   │   │   ├── orchestrator.ts
│   │   │   ├── metrics.ts
│   │   │   ├── events.ts
│   │   │   └── config.ts
│   │   │
│   │   ├── db/                   # 【新】数据库
│   │   │   ├── schema.prisma    # 【含 User.apiKey* 字段 — User-Pays 核心】
│   │   │   └── client.ts
│   │   │
│   │   ├── auth/                 # 【复用并简化】
│   │   ├── constants.ts
│   │   └── types.ts              # 【重写】统一类型
│   │
│   └── styles/
│       └── globals.css           # 设计系统变量
│
├── prisma/
│   └── schema.prisma             # 数据库 schema（精简版）
│
├── public/
│   └── avatars/                  # AI 生成的头像
│
├── tests/
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## 三、核心模块建设顺序

### 阶段一：基础设施（1-2天）
1. **项目初始化**：Next.js 14 + TypeScript + Tailwind + Prisma + ESLint
2. **设计系统**：CSS 变量 · 色彩系统 · 排版 · 组件基类
3. **LLM 网关**：Provider 抽象 · SSE 流式工具 · RAG 接口
4. **数据库**：Prisma schema · Neon 连接 · 基础 CRUD

### 阶段二：记忆与 Persona 核心（2天）
5. **四层记忆系统** (LLM Wiki v2 启发)：
   - `ShortTerm`：当前会话上下文，最大 4K tokens，按轮次衰减
   - `WorkingMemory`：活跃知识聚合，与对话上下文动态交换
   - `LongTerm`：PostgreSQL 持久化，BM25 全文检索
   - `Crystallized`：高置信度(>0.9)沉淀知识，零衰减
   - `Decay`：置信度低于阈值自动降级/遗忘
   - `Supersession`：新知识覆盖旧知识时保留版本历史
   - `Consolidation`：定时任务将 WorkingMemory 整合至 LongTerm
   - **运行时数据来自蒸馏输出，不访问原始语料库**

6. **Persona 核心数据结构**：
   - 每个人物预蒸馏为 ~10-50KB 的紧凑 JSON（mental_models、beliefs、heuristics、expressionDNA、knowledge_graph 快照）
   - 运行时直接注入 PersonaAgent Prompt，无向量检索
   - Skills 系统：hermes-agent 风格的可扩展技能注册表

### 阶段三：多智能体编排（2-3天）
7. **编排器** (gstack Sprint Pipeline 启发)：
   - `PersonaAgent`：真正的独立 Agent，支持工具调用
   - `Synthesizer`：综合多个视角，生成共识与分歧
   - `Orchestrator`：管理 Agent 生命周期、共享记忆、迭代收敛
   - **Sprint Pipeline**：Think(思考) → Plan(计划) → Build(构建) → Review(评审) → Test(测试) → Ship(交付) 六阶段循环
   - 自进化机制：根据用户反馈自动调整 Agent 行为权重
   - 流式输出：SSE + chunked response

8. **对话 UI**：
   - 流式文本渲染（逐字显示 + typing indicator）
   - 折射视角卡片（每个人物独立光效）
   - 置信度可视化条
   - 模式选择面板

### 阶段四：知识星图（2天）
9. **D3 力导向图**：
   - 人物-思维模型-概念三层连接
   - 点击节点展开关联
   - 按领域/时间/相似度筛选
   - 流式节点加载动画

### 阶段五：游戏化（2天）
10. **掌握度系统**：
    - 每个 persona 有 0-100 掌握度
    - 对话 → 置信度提升 → 掌握度增长
    - 掌握度解锁新 personas 和能力
11. **成就系统**：首次对话 · 多元碰撞 · 关公战秦琼 · 每日探索
12. **每日挑战**：守望者话题 + 限定任务 + 积分奖励

### 阶段六：智辩场（1-2天）
13. **辩论引擎**：真实三轮迭代 · 裁判总结 · 投票
14. **守望者计划**：轮值可视化 · 今日嘉宾 · 围观互动

### 阶段七：蒸馏平台（2天）
15. **Persona Studio**：蒸馏流水线 UI · SSE 进度流 · 评分报告
16. **Playtest 界面**：测试用例管理 · 批量测试 · 改进建议

### 阶段八：后台管理（2天）
17. **后台管理面板**：
    - 用户管理：列表/搜索/封禁/删除/导出
    - RBAC 角色权限：Admin / Operator / Analyst / Support 四级
    - 点数系统：功能解锁（高级 Personas / 高级对话模式 / 蒸馏 Studio），无 AI 消耗
    - 订阅管理：免费/Pro/Pro+ 三档，升降级/取消，Stripe 集成
    - **成本测算 Dashboard**：财务总览（MRR/ARR/净利润/利润率）+ 订阅收入趋势（12个月）+ 平台成本拆解（Vercel/Neon/R2/Stripe）+ 用户 API Key 渗透率（匿名）+ ROI 预测 + 成本预警
    - 审计日志：所有敏感操作记录（登录/封禁/充值/数据导出）
    - **支付**：订阅收费通过 Stripe，开发者不碰 AI 成本（User-Pays）

### 阶段九：行为采集与画像（1-2天）
18. **用户行为采集管道**：
    - 事件埋点 SDK：页面浏览/对话发起/模式选择/解锁/订阅等
    - 对话归档：每轮对话完整写入 S3，冷热分层存储
    - 用户画像：基于行为构建标签（领域偏好/活跃度/付费意向）
    - 漏斗分析：注册→首次对话→解锁→付费转化率追踪
    - 留存分析：次日/7日/30日留存，DAU/MAU 监控

---

## 四、可扩展性设计

### 4.0 可扩展性原则

```
模块独立性：每个功能域（编排/记忆/游戏/分析）独立部署，不相互依赖
事件驱动架构：域间通信通过 Event Bus，不做同步直接调用
插件化 Persona：新增人物只需上传 distillation/xxx.json，不改代码
多租户支持：TenantID 贯穿所有表，支持 white-label 部署
API 版本化：/api/v1/ → /api/v2/ 平滑迁移策略
LLM Provider 抽象：新增 Provider 只需实现接口，不影响编排器
```


## 五、关键设计决策

### 5.1 四层记忆系统 (LLM Wiki v2 启发)

```typescript
// 记忆层级
enum MemoryTier {
  SHORT_TERM = 'short_term',       // 当前会话，< 4K tokens
  WORKING = 'working_memory',      // 活跃知识，动态交换
  LONG_TERM = 'long_term',        // 持久存储，BM25 全文检索
  CRYSTALLIZED = 'crystallized',  // 高置信度沉淀，零衰减
}

// 记忆条目
interface MemoryEntry {
  id: string;
  content: string;
  tier: MemoryTier;
  confidence: number;          // 0-1
  createdAt: Date;
  updatedAt: Date;
  supersededBy?: string;       // 被哪条新知识覆盖
  supersedes?: string[];      // 覆盖了哪些旧知识
  tags: string[];
  source?: string;             // 语料来源
}

// 衰减配置
const DECAY_CONFIG = {
  [MemoryTier.SHORT_TERM]: { halfLife: '1h', minConfidence: 0.3 },
  [MemoryTier.WORKING]: { halfLife: '7d', minConfidence: 0.5 },
  [MemoryTier.LONG_TERM]: { halfLife: '30d', minConfidence: 0.7 },
  [MemoryTier.CRYSTALLIZED]: { halfLife: Infinity, minConfidence: 0.9 },
};
```

**流转规则**：
- 对话轮次 → WorkingMemory（高置信度条目）
- 高频访问 + 置信度>0.9 → Crystallized
- 置信度低于阈值 → 降级或遗忘
- 新知识覆盖旧知识 → Supersession（保留版本历史）
- 定时 Consolidation 任务 → 清理+整合记忆

### 5.2 运行时架构（无向量检索）

```
用户输入 → Orchestrator → PersonaAgent (加载 .json 核心文件)
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
              ShortTerm    WorkingMemory   Crystallized
                    └────────────┬────────────┘
                                 ↓
                        LLM Prompt (蒸馏核心 + 记忆)
                                 ↓
                         SSE Stream → 前端渲染
```

**核心设计原则**：运行时只加载蒸馏好的 Persona 核心 JSON，记忆数据存在本地/数据库，不访问原始 2.7GB 语料库。LLM Wiki v2 的四层记忆用于**对话过程中的知识管理**，而非检索。

**对话与消息数据模型（User-Pays 计费核心）**：

```prisma
// 对话会话
model Conversation {
  id           String   @id @default(cuid())
  userId       String
  mode         String   // solo | prism | roundtable | epoch | ...
  personaIds   String[]
  messageCount Int      @default(0)
  totalTokens  Int      @default(0)
  archived     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  messages     Message[]
}

// 消息记录
model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user | assistant
  content        String
  personaId      String?
  tokensUsed     Int?
  latencyMs      Int?
  providerUsed   String?  // deepseek | openai | anthropic（匿名统计）
  modelUsed      String?
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}
```

**关键说明**：User-Pays 模式下，`Message.providerUsed` 仅用于**匿名聚合统计**（如「本月 DeepSeek 使用占比 60%」），不关联任何可识别用户身份的信息。平台不在数据库中存储任何 AI 调用成本。

### 5.3 Sprint Pipeline (gstack 启发)

```
Think(思考) → Plan(计划) → Build(构建) → Review(评审) → Test(测试) → Ship(交付)
    │           │            │            │            │            │
  问题理解   任务分解    Agent响应    质量评估     置信度检测    流式输出
```

- 每个模式对应不同的 Pipeline 配置
- Review 阶段可触发 Supersession 更新
- Self-Evolution 根据 Review 反馈调整 Agent 权重

### 5.4 流式输出架构
```
用户请求 → Orchestrator → Agent 1 ─┐
                                  ├→ Synthesizer → SSE Stream → 前端逐字渲染
        Agent 2 ───────────────────┤
                                  │
        Agent 3 ───────────────────┘
```
每个 Agent 的输出通过 SSE 单独流式传输，前端并行显示多个视角卡片。

### 5.5 知识图谱数据结构
```typescript
// 节点
interface GraphNode {
  id: string;
  type: 'persona' | 'mental_model' | 'concept' | 'value';
  label: string;
  personaId?: string;     // 如果是 persona 节点
  modelId?: string;       // 如果是 mental_model 节点
  size: number;           // 掌握度 / 重要性
  color: string;          // 领域色
}

// 边
interface GraphEdge {
  source: string;
  target: string;
  type: 'inspired_by' | 'opposes' | 'shares' | 'derives_from' | 'uses';
  strength: number;        // 0-1
  label?: string;
}
```

### 5.6 掌握度系统
```typescript
// 对话结束后计算
const masteryGain = baseGain * depthMultiplier * modeBonus;
// Solo: base=2, depth=对话轮数, mode=1.0
// Prism: base=1, mode=1.5（多视角）
// Epoch: base=3, mode=2.0（辩论挑战）
// 最高掌握度=100，超过后转为"精通"徽章
```

### 5.7 Personas 分层解锁
```
Level 0（免费）：5个 personas（乔布斯/马斯克/芒格/费曼/孔子）
Level 1（免费用户）：+5个（阳明/苏格拉底/塞涅卡/格雷厄姆/芒格）
Level 2（Pro用户）：+10个
Level 3（Pro+）：全部 personas
```
通过掌握度里程碑解锁，而非一次性开放全部48个。

### 5.8 后台管理 - 角色权限体系

```typescript
enum Role {
  SUPER_ADMIN = 'super_admin',   // 超级管理员，全部权限
  ADMIN     = 'admin',           // 管理员，用户+内容管理
  OPERATOR  = 'operator',        // 运营，内容+活动管理
  ANALYST   = 'analyst',         // 分析师，数据报表只读
  SUPPORT   = 'support',         // 客服，用户支持只读
}

interface RBAC {
  [Role.SUPER_ADMIN]: ['*'],                            // 全部权限
  [Role.ADMIN]:      ['users:read', 'users:write', 'personas:read', 'stats:read', 'audit:read'],
  [Role.OPERATOR]:   ['personas:read', 'campaigns:write', 'stats:read'],
  [Role.ANALYST]:    ['stats:read', 'export:read'],
  [Role.SUPPORT]:    ['users:read', 'tickets:write'],
}
```

**点数系统（User-Pays 后的新定位）**：
- 免费用户：每日可体验 10 次（无 API Key 限制为体验版，有 Key 无限制）
- Pro 用户：解锁所有对话模式 + 高级 Personas
- Pro+ 用户：解锁蒸馏 Studio + 优先队列 + 全部 Personas
- **点数不再消耗 AI token**，改为：解锁高级 Personas / 解锁高级对话模式 / 解锁知识星图高级功能 / 解锁蒸馏 Studio
- 原 AI 消耗（Solo=1/条等）**已废弃**，由用户自己的 API Key 承担

**订阅数据模型**：

```prisma
model Subscription {
  id                String             @id @default(cuid())
  userId            String             @unique
  plan              SubscriptionPlan   @default(FREE)
  status            SubscriptionStatus @default(ACTIVE)
  startedAt         DateTime           @default(now())
  expiresAt         DateTime?
  stripeCustomerId  String?
  stripeSubId       String?
  stripePriceId     String?
  cancelAtPeriodEnd Boolean            @default(false)
  updatedAt         DateTime           @updatedAt
}

enum SubscriptionPlan {
  FREE
  PRO       // ¥30/月
  PRO_PLUS  // ¥80/月
}

enum SubscriptionStatus {
  ACTIVE
  CANCELLED
  EXPIRED
  PAST_DUE
}
```

### 5.9 用户行为采集与数据利用

```typescript
// 事件类型
type AnalyticsEvent =
  | { type: 'page_view';       page: string; referrer?: string }
  | { type: 'chat_start';      mode: Mode; personas: string[] }
  | { type: 'chat_message';    tokens_used: number; latency_ms: number }
  | { type: 'persona_unlock';  persona_id: string; trigger: 'mastery' | 'purchase' | 'admin' }
  | { type: 'subscription';    plan: 'pro' | 'pro_plus'; source: string }
  | { type: 'retention';       day: 1 | 7 | 30; returned: boolean };

// 对话归档（写入 S3）
interface ConversationArchive {
  userId: string;
  conversationId: string;
  mode: Mode;
  messages: Message[];
  metadata: { tokens: number; duration_ms: number; personas: string[] };
  archivedAt: Date;
  storageTier: 'hot' | 'cold';  // 6个月内=hot，之后转cold
}

// 用户画像标签
interface UserProfile {
  userId: string;
  tags: string[];               // 哲学/科技/商业/历史/...
  engagement: 'casual' | 'regular' | 'power';
 付费意向: 'free' | 'trial' | 'paid';
  topPersonas: string[];        // 使用最多的3个人物
  lastActive: Date;
  updatedAt: Date;
}
```

**数据利用**：
- 对话历史：支持用户查看/导出，数据主权归用户
- 行为数据：用于产品优化、 Persona 调优、精准推送
- 分析看板：DAU/MAU、转化漏斗、 Persona 使用排行、留存曲线
- 合规：GDPR/中国网络安全法，数据脱敏，审计日志

### 5.10 User-Pays 计费体系（全新设计）

**核心理念**：开发者零基础设施成本，用户自备 API Key，直接向 LLM Provider 付费。彻底绕过支付牌照、AI 备案、税务等监管障碍。

#### 5.10.1 架构设计

```
用户浏览器
    │
    ├── 输入 DeepSeek/OpenAI/Anthropic API Key
    ├── → 加密存储到 User.apiKeyEncrypted
    │
    ▼
POST /api/chat
    │
    ▼
LLM Orchestrator
    │
    ├── 读取用户加密 Key
    ├── 解密后传给 LLM Provider
    │
    ▼
DeepSeek / OpenAI / Anthropic API（费用由 Key 持有人直接承担）
```

**关键原则**：钱不经平台手。平台只做编排，不做清算。

#### 5.10.2 数据库 Schema（User Model 扩展）

```prisma
model User {
  // ... 现有字段 ...

  // ── User-Pays API Key ──────────────────────────────
  // 永远不明文存储，永远不返回原文
  apiKeyEncrypted  String?   // AES-256-GCM 加密后的 Key
  apiKeyIv         String?   // 加密向量（16 bytes）
  apiKeyHash       String?   // 前 8 位 hash，用于显示脱敏格式
  apiKeySetAt      DateTime? // 设置时间
  apiKeyProvider   String?   @default("deepseek") // deepseek | openai | anthropic
  apiKeyStatus     String?   @default("inactive")  // inactive | valid | invalid | expired
}
```

#### 5.10.3 加密工具（`src/lib/billing/encryption.ts`）

```typescript
// AES-256-GCM 加密，密钥存环境变量，永不暴露客户端
export function encryptApiKey(key: string): { encrypted: string; iv: string }
export function decryptApiKey(encrypted: string, iv: string): string
export function maskApiKey(key: string): string  // "sk-xxxx...xxxx" 脱敏显示
export function hashApiKey(key: string): string   // SHA-256 前 8 位
```

**关键环境变量**：`ENCRYPTION_KEY` — 服务端环境变量，不参与前端，不写入日志。

#### 5.10.4 Key 管理 API（`src/app/api/user/api-key/route.ts`）

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/user/api-key` | 验证 Key 有效性 → 加密存储 → 返回脱敏版本 |
| GET | `/api/user/api-key` | 返回脱敏版本（sk-xxxx...xxxx）、设置时间、状态 |
| DELETE | `/api/user/api-key` | 清除用户 Key |

**验证流程**：
1. 接收用户 Key 原文
2. 向对应 Provider 发起测试请求（`max_tokens=5`）
3. 有效 → AES-256-GCM 加密 → 存入 `apiKeyEncrypted`
4. 返回 `sk-xxxx...${last4chars}` 给用户确认

#### 5.10.5 LLM Provider Key 路由

```typescript
// orchestrator/llm-gateway.ts — 路由逻辑
async function getLLMProvider(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (user?.apiKeyEncrypted && user.apiKeyStatus === 'valid') {
    const key = decryptApiKey(user.apiKeyEncrypted, user.apiKeyIv!);
    return createProvider(user.apiKeyProvider!, key); // 用户 Key
  }

  // 无用户 Key → 引导设置
  throw new Error('API_KEY_REQUIRED');
}
```

**回退模式（可选）**：当平台配置了 `PLATFORM_DEEPSEEK_KEY` 时，无 Key 用户可使用平台 Key 体验，但限制调用量（防止滥用）。

#### 5.10.6 监管分析

| 问题 | 方案 | 依据 |
|------|------|------|
| 支付牌照 | 无需 | 钱不经平台，用户直接付给 LLM Provider |
| AI 内容监管 | 主张「工具提供方」 | 平台仅编排，内容流经 Provider 基础设施 |
| 税务 | 无营业收入 | 平台不收取任何费用 |
| 数据合规 | Key 服务端加密 | API Key 不明文暴露，不存储在日志中 |

#### 5.10.7 点数系统重新定位

**改动**：原设计中点数用于 AI 消耗，现改为**仅用于 Pro 功能解锁**。

```
点数（Points）新用途：
├── 解锁高级 Personas（Level 2+）
├── 解锁高级对话模式（Epoch/Oracle 等）
├── 解锁知识星图高级功能
└── 解锁蒸馏 Studio（自定义 Persona）

不再用于：AI API 消耗（用户自备 Key）
```

#### 5.10.8 订阅体系重新定位

```
订阅等级（新定位）：
├── FREE（免费）：5 个基础 Personas，每日 10 次对话（需设置 API Key）
├── PRO（¥30/月）：20 个 Personas，所有对话模式，无限制
└── PRO+（¥80/月）：全部 Personas + 蒸馏 Studio + 优先队列
```

**订阅价值**：从「AI 调用量」变为「Persona 丰富度 + 功能解锁」，完全规避 AI 成本风险。

#### 5.10.9 安全措施

| 措施 | 实现 |
|------|------|
| AES-256-GCM 加密 | 加密向量随机，防篡改 |
| 环境变量密钥 | `ENCRYPTION_KEY` 不进入前端代码 |
| 不返回原文 | GET 只返回脱敏格式 |
| 不打印日志 | API Key 内容不进入任何 console.log |
| 独立验证 | 保存前向 Provider 发起真实请求 |
| HTTPS only | 全站强制 TLS |

### 5.11 运营成本测算 Dashboard

**定位**：Admin Dashboard 专属页，供运营者一眼看清平台财务健康度。User-Pays 模式下，平台无 AI 成本，核心财务指标简化为：**订阅收入 − 固定平台成本 = 净利润**。

#### 5.11.1 数据模型

```prisma
// 平台月度成本快照（每月自动/手动记录）
model PlatformCostSnapshot {
  id              String   @id @default(cuid())
  statMonth       DateTime @unique  // 月初时间戳
  // 固定平台成本
  vercelCost      Decimal  @default(0)
  neonCost        Decimal  @default(0)
  r2Cost          Decimal  @default(0)
  stripeCost      Decimal  @default(0)  // Stripe 手续费
  totalCost       Decimal  @default(0)
  // 订阅收入
  mrr             Decimal  @default(0)  // 月度经常性收入
  arr             Decimal  @default(0)  // MRR × 12
  activeSubs      Int      @default(0)
  proSubs         Int      @default(0)
  proPlusSubs     Int      @default(0)
  churnedSubs     Int      @default(0)
  // 用户 API Key 使用匿名聚合
  totalMessages   Int      @default(0)
  avgTokensPerMsg Int      @default(0)
  keyUsersCount   Int      @default(0)  // 设置了 API Key 的用户数
  noKeyUsersCount Int      @default(0)  // 使用体验版（无 Key）的用户数
  providerBreakdown Json    @default("{}")  // {"deepseek":60,"openai":30,"anthropic":10}
  createdAt       DateTime @default(now())
}

// 用户 API Key 使用日聚合（匿名，不含用户身份）
model UserApiKeyUsageAggregate {
  id          String   @id @default(cuid())
  statDate    DateTime @db.Date
  provider    String   // deepseek | openai | anthropic
  totalCalls  Int      @default(0)
  totalTokens Int      @default(0)
  @@unique([statDate, provider])
}
```

#### 5.11.2 Dashboard 组件设计

`src/components/admin/cost-dashboard.tsx` — 成本测算 Dashboard 页面，包含：

**1. 财务总览卡片组（4 cards）**
- MRR：本月经常性收入，及其 ARR 换算（× 12）
- 月度净利润 = MRR − 平台月成本
- 利润率 = 净利润 / MRR × 100%
- 活跃订阅数（PRO + PRO_PLUS）

**2. 订阅收入趋势图（Recharts AreaChart）**
- 过去 12 个月 MRR 曲线
- PRO / PRO_PLUS 分组堆叠
- 自然增长 + 流失事件标注

**3. 平台成本拆解图（Recharts PieChart / BarChart）**
- Vercel / Neon / R2 / Stripe 四项占比
- 固定成本 vs 变动成本分类标注
- 月度环比变化

**4. 用户 API Key 渗透率（匿名统计）**
- Provider 分布：DeepSeek vs OpenAI vs Anthropic 占比
- 日均消息数趋势（不含用户身份）
- 平均 Token 消耗/消息
- **关键指标**：Key 渗透率 = 有 Key 用户 / 总活跃用户（越高说明越多用户已自备 Key）

**5. ROI 预测模块**
- 盈亏平衡点：当 MRR > 月固定成本时盈利（标注于趋势图）
- 6 个月 ARR 预测（基于月环比增长率外推）
- LTV / CAC 比值（接入 Stripe 数据后可用）

**6. 成本预警机制**
- 平台月成本超阈值 → 钉钉/邮件告警（通过 Vercel Cron 或外部调度）
- Key 渗透率低于 30% → Admin 提示「引导更多用户体验」

#### 5.11.3 API 路由

```
GET /api/admin/cost-dashboard
  → 返回当月 PlatformCostSnapshot + 过去 12 个月历史趋势

POST /api/admin/cost-snapshot
  → 月末触发（Cron Job）：写入当月快照
  → 调用 Stripe API 获取 MRR 和订阅数据
  → 调用 Vercel API 获取当月用量成本

GET /api/admin/api-usage-aggregate
  → 返回匿名聚合的日 API 使用数据
  → 按 Provider 分组，按日期排序
```

### 5.12 认证与授权设计

**认证方式**：魔法链接（Magic Link）为主，GitHub OAuth 为辅，微信 OAuth 可选。

```typescript
// 认证 Provider 优先级
enum AuthProvider {
  EMAIL_MAGIC_LINK = 'email_magic_link',  // 首选：无密码邮箱魔法链接
  GITHUB_OAUTH    = 'github_oauth',       // 次选：GitHub OAuth
  WECHAT_OAUTH    = 'wechat_oauth',       // 可选：微信 OAuth（适合国内用户）
}

// 认证流程
// 1. 用户输入邮箱 → 发送魔法链接邮件 → 点击链接完成登录（无密码）
// 2. 或使用 GitHub OAuth（适合技术背景用户）
// 3. 首次登录自动创建 User 记录，同步 Subscription 记录（plan=FREE）

// API 路由
// POST /api/auth/magic-link    → 发送魔法链接邮件（Resend API）
// GET  /api/auth/verify?token= → 验证 token，跳转 /chat
// GET  /api/auth/session       → 获取当前用户会话
// POST /api/auth/logout        → 登出

// Next.js Middleware (middleware.ts)
// → 保护 /api/*、/(main)/*、/admin/* 所有路由
// → 未登录用户 → 重定向 /auth/signin
// → 无效会话 → 重定向 /auth/signin
```

**为什么选择魔法链接而非密码**：
- 零密码泄露风险
- 降低注册摩擦：输入邮箱即可体验，与 User-Pays 模式天然契合
- 不强制绑定支付即可体验完整功能（付费可后续解锁高级 Personas）

**会话管理**：
- 使用 NextAuth v5（App Router 适配版）
- JWT 会话，存储于 HTTP-only Cookie
- 30 天有效期，自动续期

---

## 六、可复用资产清单（含 2.7GB 原始语料库）

### 6.1 代码资产

| 资产 | 路径 | 复用方式 |
|------|------|---------|
| personas.ts（~6900行核心数据） | `src/lib/personas.ts` | 复制核心数据文件 |
| confidence.ts | `src/lib/confidence/` | 置信度评分复用 |
| distillation-orchestrator.ts | `src/lib/distillation/` | 流水线框架复用 |
| distillation-metrics.ts | `src/lib/distillation/` | 评分体系复用 |
| distillation-events.ts | `src/lib/distillation/` | SSE 事件类型复用 |
| distillation-config.ts | `src/lib/distillation/` | 人物采集配置复用 |
| debate-arena-engine.ts | `src/lib/` | 辩论逻辑参考 |
| prismatic-agent.ts | `src/lib/` | Agent 类设计参考 |
| globals.css 设计系统 | `src/app/globals.css` | CSS 变量和动画复用 |
| Prisma schema | `prisma/schema.prisma` | 数据模型参考 |
| spark-src/ | `spark-src/` | 3D Gaussian Splatting 渲染引擎（可选集成） |

### 6.2 参考项目最佳实践

| 项目 | 来源 | 核心启发 | 落地模块 |
|------|------|---------|---------|
| **hermes-agent** | `github.com/NousResearch/hermes-agent` | 自进化机制 + Skills系统 + Trajectory压缩 + 用户建模 | `lib/orchestrator/self-evolution.ts`、`lib/orchestrator/skills.ts` |
| **LLM Wiki v2** | `llm-wiki.md` | 四层记忆架构 + Decay + Supersession + Consolidation + 结晶化 | `lib/memory/` 全模块 |
| **gstack** | `github.com/garrytan/gstack` | Sprint Pipeline（Think→Plan→Build→Review→Test→Ship） + 智能路由 | `lib/orchestrator/` Pipeline 流程 |

### 6.3 原始语料库（2.7GB+，按人物分类）

```
scrapers/
├── training_data/raw/               # 原始语料 1.5GB
│   ├── lex-fridman/                # 504MB — 300+期播客字幕（JSON格式）
│   │   ├── lex_fridman_all.json   # 合并全量（按时间戳分句）
│   │   ├── lex_fridman_by_guest.json
│   │   ├── {guest}.json          # 每期独立文件
│   │   └── lex_fridman_podcast.csv
│   ├── chinese-philosophy/         # 398MB — 四库全书结构
│   │   ├── 经/ · 史/ · 子/ · 集/
│   │   └── format.json
│   ├── canonical-greekLit/         # 367MB — 古希腊哲学原典
│   ├── richard-feynman/           # 131MB
│   ├── jeff-bezos/                # 39MB — 股东信/财报会议
│   ├── peter-thiel/               # 32MB
│   ├── zhang-xuefeng/             # 13MB
│   ├── elon-musk/                # 17MB（与personae/elon-musk互为补充）
│   ├── confucius/                # 2.9MB — 传习录/周易/孟子/礼记/论语
│   ├── charlie-munger/            # 1.8MB — 股东会/年会/专访
│   ├── zhuangzi/                  # 1.0MB
│   ├── marcus-aurelius/           # 1.0MB
│   ├── epictetus/                 # 1.6MB
│   ├── seneca/                    # 1.1MB
│   ├── kant/                      # 1.8MB
│   ├── donald-trump/              # 1.9MB
│   ├── naval-ravikant/            # 4.2MB
│   ├── tesla/                     # 368KB
│   ├── einstein/                  # 316KB
│   └── laozi/                     # 260KB
│
├── personae/                       # 采集人物专项语料 1.7GB
│   ├── elon-musk/                 # 467MB
│   │   ├── tweets.txt             # 87,921条推文
│   │   ├── retweets.txt
│   │   ├── elon_likes.txt        # Musk点赞记录
│   │   ├── birdwatch/             # Birdwatch社区标注
│   │   └── misc/
│   ├── trump-truth-social/        # 727MB
│   │   └── data/truth_archive.json
│   ├── trump-campaign/            # 58MB
│   │   └── trump_campaign_corpus.json
│   ├── ctext-scraper/             # 449MB — 全唐诗/全宋词等
│   ├── charlie-munger/            # 2.5MB — 年会/专访转录
│   └── paul-graham/              # 8.6MB
│
├── 济群法师微博/                   # 241MB
│   └── 济群法师_微博全量/
│       ├── 济群法师_微博_全量.json   # 6.5MB
│       └── 济群法师_微博_全量.txt
│
└── distilled/                     # 已蒸馏 Persona TS文件
    ├── peter-thiel.ts             # 16KB
    ├── jeff-bezos.ts             # 16KB
    ├── sam-altman.ts             # 12KB
    ├── ray-dalio.ts              # 12KB
    └── jensen-huang.ts           # 12KB
```

**语料格式说明**：
- **Lex Fridman 播客**：结构化 JSON — `[{guest, title, text, start, end}]`，每期按句子时间戳分句，可直接用于 RAG 分块
- **古典哲学**：JSON 结构 — `{name, author, chapters: [{name, paragraphs: [{paragraph, zhushu}]}]}`
- **推特/微博**：纯文本行格式，每行一条
- **Elon Musk 专项**：分年份文件（2009-2026）+ 互动数据

### 6.4 蒸馏管道（离线，2.7GB → ~10-50KB/人）

```
原始语料库 (2.7GB)
    │
    ├── Lex Fridman 播客 (504MB) → LLM 蒸馏 → PersonaCore.json (mental_models + key_positions)
    ├── 推特/微博语料 → ExpressionDNA 提取 → vocabulary/句式/节奏量化
    ├── 古典哲学原典 → 思维框架抽取 → belief + heuristics
    ├── 年会/专访转录 → 决策模式提炼 → decision_heuristics
    └── 知识图谱构建 → persona-concept-relation 三元组

运行时：只加载 PersonaCore.json（约 20 个核心人物 × 20KB = 400KB 总计）
```

### 6.5 spark-src 技术资产

`spark-src/`` 是一个基于 **Rust + WASM + WebGPU** 的 3D Gaussian Splatting 渲染引擎，9000+ 文件，**已编译二进制**。可用于知识星图的高质量 3D 可视化。

---

## 七、技术栈清单

| 层 | 技术 | 理由 |
|----|------|------|
| 框架 | Next.js 14 App Router | SSR + API Routes + React Server Components |
| 语言 | TypeScript 5 | 类型安全 |
| 样式 | Tailwind CSS | 快速迭代 |
| 动效 | Framer Motion + React-Spring | 叙事性动画 |
| 图表 | Recharts + D3.js | 知识图谱 |
| 状态 | Zustand + TanStack Query | 轻量+高效 |
| LLM | Vercel AI SDK | 流式支持 |
| 缓存 | Redis（Upstash） | 会话缓存 |
| DB | Neon PostgreSQL | Serverless，分析查询 |
| 对象存储 | S3 / Cloudflare R2 | 对话归档，冷热分层 |
| 分析 | PostgreSQL + 聚合索引 | 行为事件实时分析（pg_analytics / 物化视图） |
| 部署 | Vercel | 边缘加速 |
| CI/CD | GitHub Actions | 自动化测试 + 部署 |
| 监控 | Sentry + Vercel Analytics | 错误追踪 + 性能监控 |
| 安全密钥 | `ENCRYPTION_KEY` 环境变量 | AES-256-GCM 加密用户 API Key，存 Vercel ENV |
| 邮件 | Resend | 魔法链接邮件发送，与 Devin/Linear 同款 |
| 认证 | NextAuth v5 | App Router 适配，服务端 JWT 会话管理 |
| 支付 | Stripe | 订阅管理：免费/Pro/Pro+ 三档自动计费 |

**注**：运行时无需向量数据库，Persona 核心数据直接 JSON 注入。计费采用 User-Pays 模型，平台零 AI 成本。

## 八、关键原则

1. **流式优先**：所有 AI 输出必须是流式的，没有白屏等待
2. **真实多智能体**：Agent 间有独立通信，不是单次 prompt 拼接
3. **蒸馏核心驱动**：2.7GB 语料离线蒸馏为紧凑 JSON，运行时直接加载，无向量检索
4. **数据可视化无处不在**：置信度、掌握度、来源、图谱——所有深度数据都要让用户感知到
5. **游戏化作为留存机制**：不是加分项，是核心留存引擎
6. **分层解锁制造稀缺**：按掌握度里程碑解锁 personas，而非一次性开放
7. **代码即文档**：所有非平凡逻辑必须有类型注解和 JSDoc

---

## 九、风险与缓解

| 风险 | 缓解 |
|------|------|
| 2.7GB 语料蒸馏耗时长 | 分批处理 + 后台任务队列 |
| 蒸馏质量不稳定 | Playtest 多维评分 + 人工审核 |
| 多 Agent 延迟高 | 并行初始化 + 预热 + 流式首字优化 |
| D3 图谱性能 | 按领域懒加载节点 + canvas 渲染模式 |
| 流式 SSE 断连 | 前端自动重连 + 状态恢复 |
| persona 数据迁移 | 编写自动化迁移脚本 |
| spark-src WASM 复杂度 | 先用 D3 2D 实现，后续再集成 3D |
| 四层记忆系统复杂度 | 先实现 ShortTerm+WorkingMemory，LTM 后续迭代 |
| 自进化机制失控 | 设定权重上限 + Review 阶段人工审核 |
| ExpressionDNA 量化失真 | 保留原始语料引用，关键时刻降级到原文注入 |