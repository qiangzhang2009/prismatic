# Prismatic · 棱镜折射 — Agent 章程

> **版本**: v1.4
> **最后更新**: 2026-04-26
> **适用范围**: 所有 AI Agent 对 Prismatic 项目的所有修改

---

## 一、核心原则

### 1.1 管理后台数据三原则（最高优先级）

管理后台（`/admin`）展示的所有数据必须严格遵循：

| 原则 | 含义 | 违规示例 |
|------|------|---------|
| **真实** | 数据必须来自数据库实时查询，禁止伪造、硬编码、返回空数组掩饰错误 | 返回 `[]` 而不说明"无数据" |
| **准确** | 计算逻辑必须正确，字段含义必须与数据库 schema 一致，禁止假设默认值 | 将 `participants` 当作 `personaId` 使用 |
| **及时** | 数据必须反映当前数据库状态，禁止缓存超过 5 分钟的静态数据 | 用 hardcoded 常量代替实时查询 |

**任何违反此原则的代码都是 P0 bug，必须立即修复。**

---

## 二、管理后台数据源规范

### 2.1 唯一可信数据源

所有管理后台数据必须直接查询 **Prisma/Neon PostgreSQL**，禁止：

- 返回空数组时假设"真的没有数据"（应检查查询是否正确）
- 使用第三方 API（如 `prismatic_events` 表）作为主要数据源（该表可能不存在或数据不完整）
- 缓存超过 `staleTime: 1000 * 60 * 5`（5分钟）
- 在 API 层 catch 异常后静默返回 `[]`，而不记录日志

### 2.2 数据源优先级

```
Prisma → messages 表      (最准确，反映真实使用)
Prisma → conversations 表  (对话元数据，含 participants/personaIds)
Prisma → users 表          (用户信息)
Prisma → sessions/events 表 (行为分析)
Tracking tables (prismatic_events, page_events) → 仅作补充参考，不作主要来源
```

### 2.3 Persona 数据源

**人物数据必须从 `conversations.participants` 或 `conversations.personaIds` 读取**，而非依赖：
- `messages.personaId`（数据可能不完整）
- `prismatic_events` 表（该表可能不存在）
- 代码中的常量定义（无法反映真实使用情况）

当无法从数据库获取 persona 名称时，使用 `src/lib/personas.ts` 中的常量作为 fallback，但必须在 UI 上标注"名称来自代码定义，可能与实际不符"。

---

## 三、API 路由规范

### 3.1 必须遵守

- 所有 `/api/admin/*` 路由必须调用 `authenticateAdminRequest()` 校验权限
- 所有查询必须使用 `prisma` singleton（`@/lib/prisma`），禁止创建新实例
- 所有返回 JSON 必须包含 `period` 字段（说明数据时间范围）
- 所有错误必须 `console.error` 记录，并返回有意义的错误信息

### 3.2 禁止

- 在 API 层吞掉错误返回 `[]`（会导致前端误以为"真的没数据"）
- 在 API 层做复杂的计算逻辑（应在前端做，或明确标注计算方式）
- 在 API 层返回硬编码的假数据用于"测试"

---

## 四、前端展示规范

### 4.1 数据展示原则

- **所有数字**必须用 `Number()` 包装后再调用 `.toFixed()` / `.toLocaleString()`（防止 `undefined.toFixed` 报错）
- **空数据状态**：必须区分"正在加载"、"无数据"、"查询出错"三种状态
- **指标说明**：每个分析维度必须有简短的数据来源说明（1-2句话），帮助管理员理解数据含义
- **时间显示**：禁止在 JSX 中直接写 `new Date().toLocaleTimeString()`（会导致 SSR 水合错误），必须用 `useEffect` 延迟渲染

### 4.2 指标解读

每个数据分析维度（总览/Token成本/话题聚类/人物互动/用户分群）必须包含：
1. **数据来源**：说明数据来自哪张表或哪个 API
2. **指标含义**：解释每个数字代表什么
3. **异常识别**：能识别数据异常（如人物只有 1 个、消息数为 0 但成本不为 0）

---

## 五、数据准确性自查清单

每次修改管理后台代码前，必须确认：

- [ ] 数据来自哪个 Prisma 模型/表？
- [ ] 这个表的 schema 是什么？字段类型是否匹配？
- [ ] 查询条件（where）是否正确？
- [ ] 聚合函数（groupBy/sum/count）是否在正确的字段上？
- [ ] 数据是实时的还是缓存的？缓存时间是否合理？
- [ ] 空结果：是"真的没有数据"还是"查询条件不对"？
- [ ] 所有 `toFixed` / `toLocaleString` 是否用 `Number()` 包装？

---

## 六、违规处理

| 违规类型 | 处理方式 |
|---------|---------|
| 数据硬编码/假数据 | 回滚 + 立即修复 |
| 数据源选错（如用 prismatic_events 作为主要来源） | 重写 API，使用正确数据源 |
| 静默吞错误返回 `[]` | 添加错误日志 + 返回错误状态码 |
| 数字计算未处理 null/undefined | 全局搜索 `toFixed` 并加 `Number()` 包装 |
| 未添加指标说明 | 补充 description 文本 |

---

## 七、WittSrc Brain（gbrain 集成）

### 快速参考

```bash
# 导入语料到 Brain
bun run scripts/wittsrc-brain-import.ts --corpus corpus/wittgenstain/texts/

# 抽取知识图谱链接（零 LLM）
bun run scripts/wittsrc-auto-link.ts --source corpus/wittgenstain/brain/

# 混合搜索查询
bun run scripts/wittsrc-query.ts "What is Wittgenstein's language game concept?"

# 图遍历查询
bun run scripts/wittsrc-graph-query.ts work-ms-114 --type evolves_to --depth 3

# 健康检查
bun run scripts/wittsrc-maintain.ts --check

# 身份配置生成
bun run scripts/wittsrc-soul-audit.ts --persona wittgenstein

# Minions 任务列表
bun run scripts/wittsrc-minions.ts --list
```

### 核心技能文件

| 技能 | 用途 |
|------|------|
| `skills/wittsrc-brain/SKILL.md` | 主入口，架构概览 |
| `skills/wittsrc-brain/RESOLVER.md` | 意图路由表 |
| `skills/wittsrc-brain/ingest/` | 语料摄入 |
| `skills/wittsrc-brain/link/` | 零 LLM 实体链接抽取 |
| `skills/wittsrc-brain/query/` | 混合搜索 |
| `skills/wittsrc-brain/graph/` | 图遍历查询 |
| `skills/wittsrc-brain/timeline/` | 时间线提取 |
| `skills/wittsrc-brain/enrich/` | 分级实体富化 |
| `skills/wittsrc-brain/maintain/` | 脑健康检查 |
| `skills/wittsrc-brain/soul-audit/` | WittSrc 身份配置 |
| `skills/wittsrc-brain/conventions/` | 链接类型和哲学分期约定 |

### 哲学分期约定

- **早期** (1912-1918): Ms-114/Ms-115/Tractatus — 逻辑图像论
- **过渡期** (1929-1936): Ms-152/Ts-207/PR — 规则悖论浮现
- **后期** (1937-1951): Ts-212/PI/Zettel — 语言游戏、家族相似性

### 链接类型

`cites` / `evolves_to` / `contradicts` / `influenced_by` / `defines` / `revisits`

---

## 八、数据库安全规程（最高优先级）

> **违规操作 = 数据永久丢失。禁止任何绕过。**

### 8.1 绝对禁止的命令

```bash
# ❌ 任何环境都禁止
prisma migrate reset              # 删除所有数据
prisma db push --force           # 强制覆盖，可能丢失数据
prisma db push --accept-data-loss # 明确接受数据丢失
npx prisma migrate deploy --accept-data-loss

# ❌ 生产环境禁止
prisma migrate dev               # 仅限本地开发
npx prisma db push              # 仅限本地开发

# ❌ 直接在 main 分支操作
git push origin main             # 直接 push schema 变更
```

### 8.2 凭证管理

| 凭证 | 用途 | 存放位置 |
|---|---|---|
| `DATABASE_URL` (读写) | 迁移脚本、本地开发 | 本地 `.env.local` + GitHub Secrets |
| `DATABASE_URL` (只读) | Vercel 应用代码 | Vercel 环境变量 |
| `DATABASE_URL_RW` | CI 迁移安全闸 | GitHub Secrets（不在 Vercel） |

**Vercel 应用代码只使用只读凭证，即使代码有 bug 也无法破坏数据。**

### 8.3 安全操作流程

```
本地开发：
  npm run db:backup    → 检查最新备份
  npm run db:status    → 查看迁移状态
  npm run db:migrate:safe  → 安全迁移

生产变更：
  1. 创建功能分支 → 修改 schema
  2. PR 自动触发 database-migration-gate.yml
  3. 危险变更 → 需要人工审批
  4. 合入 main → Vercel 自动部署（只读）
  5. 迁移通过 CI 执行（通过 GitHub Actions）
```

### 8.4 迁移分类

| 级别 | 示例 | 处理方式 |
|---|---|---|
| 🔴 CRITICAL | DROP TABLE / TRUNCATE / 无 WHERE 的 DELETE | 人工审批 + 确认备份 |
| 🟡 HIGH | 修改主键/唯一约束 / 列类型变更 | 检查影响 |
| 🟢 SAFE | 添加 nullable 字段 / 添加新表 | 自动通过 |

### 8.5 数据丢失应急

```
立即行动：
1. 停止所有数据库写入
2. 不要执行任何 migration
3. 检查 GitHub Actions 运行记录
4. 从最近的备份恢复: npm run db:backup

参考文档: docs/DATABASE_SAFETY.md
```

### 8.6 防火墙规则

生产环境的 Prisma 查询受到 `src/lib/database-firewall.ts` 保护：
- 拦截 TRUNCATE/DROP TABLE
- 拦截无 WHERE 的 DELETE/UPDATE
- 所有写操作自动审计
- 危险操作直接抛出错误

---

## 九、相关文件索引

- 管理后台入口：`src/app/admin/page.tsx`
- Admin API 路由：`src/app/api/admin/`
- Prisma Schema：`prisma/schema.prisma`
- Persona 定义：`src/lib/personas.ts`
- 数据 Hooks：`src/lib/use-admin-data.ts`
- Tracking 系统：`src/lib/tracking.ts`
- 数据库安全：`docs/DATABASE_SAFETY.md`
- Neon 保护设置：`docs/NEON_BRANCH_PROTECTION_SETUP.md`
- 数据库防火墙：`src/lib/database-firewall.ts`
- 备份脚本：`scripts/backup-workflow.js`
- 迁移安全闸：`.github/workflows/database-migration-gate.yml`
- 自动备份：`.github/workflows/database-backup.yml`
- 预迁移检查：`scripts/pre-migration-hook.ts`
- RLS 设置：`scripts/setup-rls.ts`
- 部署规范（第十章）：`CLAUDE.md` 第十节
- 语料与人物系统：`docs/CORPUS_AND_PERSONA_SYSTEM.md`
- 语料采集计划：`docs/corpus-collection-plan.md`
- 语料污染复盘：`docs/corpus-pollution-post-mortem.md`

---



---

## 十一、运行时知识边界系统（Runtime Knowledge Gap System）

### 11.1 问题背景

人物库中有些 persona 代表仍在世的人（如现代企业家、学者、公众人物）。用户若询问这些人物最近的动态，而蒸馏知识库中没有收录，就会产生**知识空白（Knowledge Gap）**。

### 11.2 解决方案架构

```
User Question
     ↓
  L1: Metadata Enricher    — 提取 persona 的 corpusMetadata（cutoffDate、confidenceScore、gapSignals）
     ↓
  L2: Gap Detector         — 检测问题是否涉及知识空白（时间信号、近期事件词、蒸馏边界词）
     ↓
  L3: Graceful Router      — 决定降级策略（normal / extrapolate / honest_boundary / refer_sources / hybrid）
     ↓
  L3: Gap Handler         — 根据策略生成响应（前缀声明、推演内容、来源引用）
     ↓
 Enriched Response + _gap metadata
```

### 11.3 降级策略（DegradationMode）

| 策略 | 触发条件 | 处理方式 |
|------|---------|---------|
| `normal` | 无知识空白 | 正常 LLM 回复 |
| `extrapolate` | 有价值观/思维模式支撑 | 标注"推演声明"，基于价值观推演 |
| `honest_boundary` | 近期事件超出知识范围 | 标注"知识边界"，诚实说明超出范围 |
| `refer_sources` | 有引用来源可用 | 标注"来源引用"，引用已蒸馏来源 |
| `hybrid` | 混合场景 | 部分推演 + 部分事实 + 混合声明 |

### 11.4 关键文件

| 文件 | 职责 |
|------|------|
| `src/lib/distillation-runtime-orchestrator.ts` | 统一入口，协调 L1/L2/L3 |
| `src/lib/distillation-v2-gap-detector.ts` | 运行时知识空白检测 |
| `src/lib/distillation-graceful-router.ts` | 降级路由决策 |
| `src/lib/distillation-knowledge-gap-handler.ts` | 降级内容生成 |
| `src/lib/distillation-v4-types.ts` | 类型定义（CorpusMetadata、DegradationMode 等） |
| `src/app/api/chat/route.ts` | 集成入口（handleSolo、handlePrism、handleRoundtable、handleOracle、handleFiction） |

### 11.5 Persona 元数据要求

活人 persona（`isAlive: true`）必须在 corpusMetadata 中提供：

```typescript
{
  isAlive: true,
  corpusMetadata: {
    cutoffDate: '2025-06-01',          // 知识截止日期
    confidenceScore: 0.85,              // 置信度
    knowledgeGapSignals: [               // 知识空白信号
      '2024年公开演讲',
      '2025年最新著作',
    ],
    knowledgeGapStrategy: 'honest_boundary',  // 默认策略
    sensitiveTopics: ['个人生活'],       // 敏感话题
    extrapolationBoundaries: {          // 推演边界
      avoidTopics: ['未公开的私人决定'],
      confidenceThreshold: 0.6,
    },
  }
}
```

### 11.6 前端响应字段

每个 AI 回复消息包含 `_gap` 字段供前端渲染警告标签：

```typescript
{
  _gap: {
    isGapAware: true,
    degradationMode: 'honest_boundary',
    warningLabel: '【知识边界】以下内容超出蒸馏知识范围',
    corpusCutoffDate: '2025-06-01',
    gapSignals: ['2024年公开演讲', '2025年最新著作'],
    confidence: 0.85,
  }
}
```

### 11.7 运行时管道（Runtime Pipeline）

多角色模式下（prism/roundtable/oracle/fiction），每个 persona 的 prompt 中会自动注入知识截止期提示：

```typescript
// 自动注入到各模式 systemPrompt 中
const livingPersonas = speakers.filter(p => p.isAlive !== false && p.corpusMetadata?.cutoffDate);
// 如果有活人 persona，prompt 末尾追加：
// 【知识截止期提示】xxx 的知识截止到 yyy。
// 如果话题涉及截止期之后的事件，应标注为"推演"而非"事实"。
```

---

## 十、Vercel 部署规范

### 10.1 部署前必查清单

每次 `vercel --yes` 前，必须确认：

- [ ] `.vercelignore` 是否已排除所有大文件目录？
- [ ] 所有根目录 `*.js` 配置文件是否使用 ESM（`export default`）而非 CommonJS（`module.exports`）？
- [ ] `package.json` 是否有 `"type": "module"`？若有，所有配置文件必须匹配
- [ ] 是否有 Prisma schema 变更需要同步到 Neon 数据库？

### 10.2 文件数量超限（> 15,000 个）

Vercel 限制每个部署最多 15,000 个文件。常见原因和修复：

```bash
# 检查磁盘上各目录文件数
find . -maxdepth 1 -type d | while read d; do echo "$d"; find "$d" -type f 2>/dev/null | wc -l; done | sort -rn
```

必须在 `.vercelignore` 中排除的大目录（2026-04-25 实测）：

```
# ─── Data & Research（占 ~178,000 个文件中的 ~120,000 个）───
scrapers/          # 32,777 个文件
corpus/           # 25,254 个文件
.venv-ocr/       # 17,717 个文件
newsnow-local/    # 44,254 个文件

# ─── Build & Cache ───────────────────────────────────────────
.next/
node_modules/     # 虽然 Vercel 默认忽略，但显式写更安全
.vercel/         # 部署产物缓存，220+ 文件
.cache/

# ─── Environment ───────────────────────────────────────────
.env
.env.*

# ─── Docs & Temp ────────────────────────────────────────────
docs/
tmp_ocr/
backups/
reports/
development/
tmp/
*.log
```

### 10.3 ESM / CommonJS 混用报错

`package.json` 有 `"type": "module"` 时，所有根目录 `*.js` 配置文件必须使用 ESM。

| 文件 | CommonJS（报错） | ESM（正确） |
|------|-----------------|-------------|
| `next.config.js` | `module.exports = {...}` | `export default {...}` |
| `postcss.config.js` | `module.exports = {...}` | `export default {...}` |
| `tailwind.config.ts` | `require('@tailwindcss/typography')` | `import typography from '@tailwindcss/typography'` |

### 10.4 Next.js 14 构建错误

**`useSearchParams` 缺少 Suspense：**

Next.js 14 在静态生成（`generateStaticParams`）时要求 `useSearchParams` 必须包裹在 `<Suspense>` 中。

```tsx
// ❌ 错误
export default function Page() {
  const searchParams = useSearchParams(); // build error
  ...
}

// ✅ 正确：拆分 + Suspense 包装
function PageInner() {
  const searchParams = useSearchParams();
  ...
}

export default function Page() {
  return (
    <Suspense fallback={<div>加载中...</div>}>
      <PageInner />
    </Suspense>
  );
}
```

### 10.5 数据库 Schema 变更流程

1. **本地开发**：修改 `prisma/schema.prisma` 后，本地用 `npx prisma migrate dev` 或直接 `npx prisma generate`
2. **Neon 数据库同步**（无需迁移文件）：
   ```bash
   # 用 psql 直连 Neon（从 .env.local 获取 DATABASE_URL）
   export PGPASSWORD='your_password'
   psql "postgresql://user:pass@host/db?sslmode=require" \
     -c "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..."
   ```
   或调用 `POST /api/migrate`（需要 admin token）
3. **部署**：schema 变更后，`prisma generate` 会在 `npm run build` 中自动运行

### 10.6 完整部署命令

```bash
# 1. 数据库迁移（如需要）
#    a) psql 直连（推荐，无需登录 Vercel）
#    b) 或 POST /api/migrate（需 admin token）

# 2. 本地构建验证
npm run build

# 3. 预览部署
vercel --yes

# 4. 正式发布
vercel --prod --yes
```

### 10.7 常见部署错误

| 错误信息 | 原因 | 修复 |
|---------|------|------|
| `module is not defined in ES module scope` | 配置文件用了 CommonJS | 改 `module.exports` → `export default` |
| `too many files (15,595)` | `.vercelignore` 缺少排除目录 | 添加 `scrapers/` `corpus/` 等 |
| `useSearchParams() should be wrapped in suspense` | SSR 使用了 `useSearchParams` | 包裹 `<Suspense>` |
| `DATABASE_URL not set` | Prisma 在构建时访问了数据库 | Vercel 构建时禁止 Prisma 连接，仅运行时连接 |
| `prisma generate` 失败 | schema 有语法错误 | `npx prisma validate` 检查 |
