# Prismatic Persona Distillation — 蒸馏工程完整指南

> **版本**: v2.0 (integrated with WittSrc Brain + gbrain)
> **适用**: Prismatic 项目蒸馏流水线操作人员
> **最后更新**: 2026-04-20

---

## 一、体系总览

### 1.1 蒸馏流水线（6步法）

```
Step 1 ──→ Step 2 ──→ Step 3 ──→ Step 4 ──→ Step 5 ──→ Step 6
深度研究   心智模型   表达DNA    Prompt      盲测评估    迭代优化
  ↓          ↓          ↓         ↓           ↓          ↓
自动化      半自动      半自动     高自动       人工为主     半自动
采集管道     提取        建模      工程         评估        反馈
```

**质量门槛**: 60/100（低于此值触发 auto-fix 循环，最多 3 轮）

**蒸馏类型权重**（自适应）:

| 人物类型 | VoiceFidelity | KnowledgeDepth | ReasoningPattern | SafetyCompliance |
|---------|---------------|--------------|----------------|----------------|
| Philosopher | 25% | 20% | 40% | 15% |
| Spiritual | 40% | 20% | 25% | 15% |
| Business | 20% | 40% | 25% | 15% |
| Scientist | 15% | 35% | 35% | 15% |
| Political | 20% | 20% | 20% | 40% |
| Default | 30% | 30% | 25% | 15% |

### 1.2 人物优先级

| 优先级 | 人物 | 语料主要来源 |
|-------|------|------------|
| **P0** | nassim-taleb | Twitter + Incerto 书籍 |
| **P0** | ilya-sutskever | Twitter + 学术论文 |
| **P0** | zhang-xuefeng | B站视频字幕 + 知乎 |
| **P0** | andrej-karpathy | Twitter + 博客 + YouTube |
| **P0** | wittgenstein | Project Gutenberg + WittSrc 语料 |
| **P1** | elon-musk | Twitter + 财报会议 |
| **P1** | paul-graham | Twitter + Essays |
| **P1** | charlie-munger | 股东大会 + Poor Charlie's Almanack |
| **P2** | warren-buffett | 股东信 + Berkshire 年会 |
| **P2** | richard-feynman | Caltech 讲座 + 书籍 |
| **P2** | steve-jobs | Walter Isaacson 传记 + All Things D |
| **P2** | zhang-yiming | 全员会 + 采访 |
| **P2** | jensen-huang | GTC 大会字幕 |

---

## 二、人物库与存储架构

### 2.1 双层人物系统

Prismatic 使用**两层人物系统**，两条路径并行、透明共存：

```
代码人物层 (src/lib/personas.ts)
  └─ 15 个预置人物 (PERSONAS 常量)
  └─ 直接供 Chat API 使用
  └─ 无需数据库

数据库人物层 (prisma.distilled_personas)
  └─ 蒸馏流水线生成的人物
  └─ 供人物库页面 (persona-library) 使用
  └─ 需手动注册到代码层以接入 Chat

web 应用路由 (/api/persona-library)
  └─ GET: 优先查 DB → fallback 到代码人物
  └─ 每个 slug 有专属页面 (/personas/[slug])
```

**连接方式**: 数据库人物需要将 slug 注册到 `src/lib/personas.ts` 才可在 Chat 中使用。

### 2.2 数据库 Schema

核心表:

```prisma
model DistillSession {
  id            String   @id @default(cuid())
  personaName   String
  personaId     String
  status        String   // pending | running | completed | failed
  result        Json?    // FullDistillationResult
  totalCost     Float
  totalTokens   Int
  corpus        DistillCorpusItem[]
  savedPersona  DistilledPersona?
  createdAt     DateTime @default(now())
  completedAt   DateTime?
}

model DistillCorpusItem {
  id             String   @id @default(cuid())
  sessionId      String
  collectorType  String   // twitter | blog | weibo | video | podcast | book
  source         String
  sourceName     String?
  content        String   // 完整文本内容
  author         String?
  publishedAt    DateTime?
  url            String?
  wordCount      Int
  language       String   // zh | en | mixed
}

model DistilledPersona {
  id               String   @id @default(cuid())
  sessionId        String   @unique
  slug             String   @unique
  name / nameZh / nameEn
  domain           String
  avatar / accentColor / gradientFrom / gradientTo
  tagline / taglineZh / brief / briefZh
  mentalModels     Json     // MentalModel[]
  decisionHeuristics Json
  expressionDNA    Json     // ExpressionDNA
  values / tensions / antiPatterns / strengths / blindspots
  honestBoundaries Json
  systemPromptTemplate / identityPrompt
  reasoningStyle / decisionFramework / keyQuotes / lifePhilosophy
  finalScore       Float   @default(0)
  qualityGrade     String  @default("F")
  thresholdPassed  Boolean @default(false)
  corpusItemCount  Int     @default(0)
  corpusTotalWords Int     @default(0)
  distillVersion   String  @default("0.1.0")
  distillDate      DateTime @default(now())
  isActive         Boolean @default(true)
  isPublished      Boolean @default(false)  // 发布到人物库
  createdAt        DateTime @default(now())
}
```

---

## 三、蒸馏执行手册

### 3.1 标准蒸馏命令

**推荐方式 — SSE 流式（可实时查看进度）:**

```bash
# 基本命令
curl -X POST http://localhost:3000/api/distill/full \
  -H "Content-Type: application/json" \
  -d '{
    "personaName": "Nassim Taleb",
    "options": {
      "qualityThreshold": 60,
      "iterations": 3,
      "autoApprove": false,
      "maxCost": 10,
      "stream": true
    }
  }'

# 从 Next.js 项目目录运行
# 方式1: 使用项目中的脚本
bun run scripts/distill-persona.ts nassim-taleb

# 方式2: 直接调用 API (需要先启动 dev server)
# 在 http://localhost:3000/api/distill/full 端点调用
```

**查看蒸馏状态:**

```bash
# 列出所有运行中的蒸馏会话
curl http://localhost:3000/api/distill/full?stats=true

# 查看特定会话状态
curl "http://localhost:3000/api/distill/full?planId=XXXXXXXX"
```

**通过 Admin 界面蒸馏:**

访问 `/admin` → 进入 Prismatic 部分 → 找到蒸馏面板 → 输入人物名称 → 选择配置 → 启动

### 3.2 批量蒸馏

按优先级顺序执行：

```bash
# P0 人物（最重要）
# 1. nassim-taleb
# 2. ilya-sutskever
# 3. zhang-xuefeng
# 4. andrej-karpathy
# 5. wittgenstein

# P1 人物
# 6. elon-musk
# 7. paul-graham
# 8. charlie-munger

# P2 人物
# 9.  warren-buffett
# 10. richard-feynman
# 11. steve-jobs
# 12. zhang-yiming
# 13. jensen-huang
```

**串行执行策略**: 每批次完成后检查 `finalScore`：
- ≥ 80: 直接发布
- 60-79: 人工审核后发布
- < 60: 分析失败原因，补充语料后重试

### 3.3 质量评分标准

```
DistillationScore = Σ(dimension_weight × dimension_score)

Grade Mapping:
  A+  ≥ 95  → 立即发布
  A   ≥ 85  → 发布
  B+  ≥ 75  → 审核后发布
  B   ≥ 65  → 修复问题后发布
  C   ≥ 55  → 需补充语料
  F   < 55  → 需重新评估人物可行性
```

---

## 四、人物上线流程（蒸馏 → 发布 → 注册）

### 4.1 流程图

```
蒸馏完成
    ↓
验证 finalScore ≥ 60
    ↓
发布到数据库 isPublished = true
    ↓
创建代码人物条目 (src/lib/personas.ts)
    ↓
提交 PR / 部署
    ↓
验证 Chat API 可以使用该人物
    ↓
完成
```

### 4.2 发布到数据库

蒸馏完成后，`DistilledPersona` 记录已自动创建于数据库中。设置发布状态：

```sql
UPDATE distilled_personas
SET isPublished = true, isActive = true
WHERE slug = 'nassim-taleb';
```

或通过 Admin 界面操作。

### 4.3 注册到代码人物层

蒸馏完成后，需要将 `DistilledPersona` 中的核心字段提取并注册到 `src/lib/personas.ts`，使其能被 Chat API 识别。

**关键字段映射:**

| 数据库字段 | 代码人物字段 |
|-----------|------------|
| `slug` | `id` |
| `name` | `name` |
| `nameZh` | `nameZh` |
| `nameEn` | `nameEn` |
| `domain` | `domain[]` |
| `tagline` / `taglineZh` | `tagline` / `taglineZh` |
| `brief` / `briefZh` | `brief` / `briefZh` |
| `mentalModels` | `mentalModels` |
| `expressionDNA` | `expressionDNA` |
| `systemPromptTemplate` | `systemPromptTemplate` |
| `identityPrompt` | `identityPrompt` |
| `honestBoundaries` | `honestBoundaries` |
| `values` | `values` |
| `tensions` | `tensions` |
| `antiPatterns` | `antiPatterns` |
| `strengths` | `strengths` |
| `blindspots` | `blindspots` |
| `finalScore` | 无直接映射（存储在 DB） |

### 4.4 验证上线

蒸馏发布后，验证以下内容：

1. **人物库页面**: `/personas/[slug]` 正常显示
2. **Chat 对话**: 在对话中选择该人物，验证回复风格符合预期
3. **Admin 面板**: 蒸馏记录出现在蒸馏历史中
4. **质量评分**: 在 `/api/persona-library/[slug]` 中可以看到 `finalScore`

---

## 五、WittSrc Brain 集成（维特根斯坦专用）

Wittgenstein 人物使用特殊的 gbrain 架构：

### 5.1 WittSrc Brain 架构

```
corpus/wittgenstain/brain/
  works/           # 手稿/著作 Brain Pages
  concepts/        # 哲学概念 Brain Pages
  people/          # 相关哲学家
  timelines/        # 时间线数据
  .links/          # 知识图谱链接
  identity/        # 身份配置（SOUL.md, PERIOD_*.md）
```

### 5.2 WittSrc 专用命令

```bash
# 1. 导入语料到 Brain
bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstain/texts/

# 2. 抽取知识图谱链接（零 LLM）
bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstain/brain/

# 3. 生成身份配置（哲学分期）
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein

# 4. 混合搜索
bun run scripts/wittsrc-query.ts "private language argument"

# 5. 图查询
bun run scripts/wittsrc-graph-query.ts work-ms-114 --type evolves_to --depth 3

# 6. 健康检查
bun run scripts/wittsrc-maintain.ts --check

# 7. 时间线提取
bun run scripts/wittsrc-timeline.ts

# 8. 定时任务
bun run scripts/wittsrc-minions.ts --list
```

### 5.3 哲学分期

| 分期 | 年代 | 核心著作 | 特征 |
|-----|------|---------|------|
| 早期 | 1912-1918 | Ms-114/Ms-115/Tractatus | 逻辑图像论、世界=事实的总和 |
| 过渡期 | 1929-1936 | Ms-152/Ts-207/PR | 规则悖论浮现、语言批判开始 |
| 后期 | 1937-1951 | Ts-212/PI/Zettel | 语言游戏、家族相似性、形式生活 |

### 5.4 链接类型

- `cites`: 引用某手稿/著作
- `evolves_to`: 概念/立场的演进
- `contradicts`: 与早期观点矛盾
- `influenced_by`: 受某哲学家影响
- `defines`: 定义某概念
- `revisits`: 重新审视某议题

---

## 六、蒸馏配置（DISTILLATION_CONFIG）

每个人物在 `src/lib/distillation-config.ts` 中有独立配置：

```typescript
DISTILLATION_CONFIG['nassim-taleb'] = {
  personaId: 'nassim-taleb',
  priority: 'P0',
  collectorTargets: [
    { collectorType: 'twitter', source: '@nntaleb', priority: 1, estimatedItems: 50000 },
    { collectorType: 'book', source: '书籍', url: '', priority: 2, estimatedItems: 5 },
    { collectorType: 'blog', source: 'Medium', url: 'https://medium.com/@nntaleb', priority: 3, estimatedItems: 500 },
  ],
  skillSet: ['second-order', 'common-fallacy', 'probabilistic', 'inversion'],
  defaultTestCategories: ['philosophy', 'probability', 'ethics', 'risk'],
  playtestCaseCount: 15,
  minCorpusSize: 500000,
};
```

---

## 七、问题排查

| 问题 | 原因 | 解决方案 |
|-----|------|---------|
| 蒸馏返回 500 | orchestrator 初始化失败 | 检查 LLM API 配置 |
| finalScore = 0 | corpus 为空 | 确认采集器正常工作 |
| 人物库页面 404 | slug 不存在或未发布 | 确认 DB 中 `isPublished=true` |
| Chat 无法使用人物 | 未注册到代码层 | 添加到 `src/lib/personas.ts` |
| Twitter 采集失败 | API 限制 | 等待或使用代理 |
| 语料太少 | 采集器配置不对 | 检查 collectorTargets |
| 评分过低 | 语料质量/数量不足 | 补充语料，增加 iterations |

---

## 八、相关文件索引

| 文件 | 用途 |
|-----|------|
| `src/lib/distillation-config.ts` | 人物蒸馏配置（采集计划） |
| `src/lib/distillation-orchestrator.ts` | 蒸馏编排器（Wave-based） |
| `src/lib/distillation-metrics.ts` | 四维质量评分体系 |
| `src/lib/distillation-events.ts` | SSE 事件系统 |
| `src/app/api/distill/full/route.ts` | 全自动蒸馏 API |
| `src/lib/personas.ts` | 代码人物定义（Chat 用） |
| `src/app/api/persona-library/route.ts` | 人物库 API |
| `prisma/schema.prisma` | 数据库 Schema |
| `skills/persona-distillation/` | 人物蒸馏技能（待补充） |
| `skills/wittsrc-brain/` | WittSrc Brain 技能包 |
| `scripts/wittsrc-*.ts` | WittSrc 专用脚本 |
| `OPTIMIZATION_PLAN.md` | 蒸馏优化计划文档 |
| `CLAUDE.md` | 项目 AI Agent 章程 |
