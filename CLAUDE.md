# Prismatic · 棱镜折射 — Agent 章程

> **版本**: v1.1
> **最后更新**: 2026-04-20
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

## 十、部署流程

### 10.1 唯一正确的部署方式：GitHub Actions CI/CD

**禁止使用本地 `vercel --prod` 部署。** 原因：本地部署会尝试上传所有文件（包括 corpus、node_modules 等），超过 Vercel 15000 文件上限导致部署失败。

所有代码变更必须通过 GitHub 推送到 `main` 分支，CI/CD 自动完成构建和部署：

```
git add <changed-files>
git commit -m "<描述>"
git push origin main
```

推送后约 6 分钟内完成：Quality Check → Unit Tests → Build → Deploy Production。

CI/CD 配置：`.github/workflows/ci-cd.yml`

### 10.2 CI/CD 流水线说明

| Job | 触发条件 | 说明 |
|-----|---------|------|
| Quality Check | push/PR | `npm run type-check` + `npm run lint` |
| Unit Tests | push/PR | `npm test` |
| Build | quality + test 通过后 | `npm run build`，需要 `OPENAI_API_KEY` |
| Deploy Preview | 仅 PR | 自动部署预览链接 |
| Deploy Production | 仅 push 到 main | `vercel deploy . --prod` |

### 10.3 GitHub Secrets 依赖

部署 production 需要以下 Secrets（在 GitHub 仓库 Settings → Secrets 配置）：

| Secret | 用途 |
|--------|------|
| `VERCEL_TOKEN` | Vercel API 访问令牌 |
| `VERCEL_ORG_ID` | Vercel 组织 ID |
| `VERCEL_PROJECT_ID` | Vercel 项目 ID |
| `OPENAI_API_KEY` | 构建时使用（可选，build job 需要） |

项目 ID 位于 `.vercel/project.json`，或通过 `vercel project ls` 查看。

### 10.4 部署前置检查

推送前在本地执行，确保 CI 不会因 lint/build 失败而阻断：

```bash
npm run type-check   # TypeScript 编译检查
npm run lint         # ESLint 检查（Error 会导致 CI 失败，Warning 不会）
npm run build        # Next.js 构建测试
```

**常见 CI 失败原因：**
- `react/no-unescaped-entities` — JSX 中的 `"` `'` 等字符未转义为 `&ldquo;` `&#39;` 等实体
- TypeScript 编译错误
- Build 失败（通常依赖缺失或环境变量问题）

### 10.5 查看部署状态

```bash
# GitHub Actions 状态
gh run list --workflow=ci-cd.yml --limit 3

# 查看失败日志
gh run view <run-id> --log-failed

# Vercel 部署列表
vercel list

# 跟踪特定 run
gh run watch <run-id>
```

### 10.6 .vercelignore 说明

`.vercelignore` 已配置排除以下目录，不会上传到 Vercel：
- `corpus/` — 语料文件（几千个文件）
- `scrapers/` — 爬虫脚本
- `scripts/` — 本地工具脚本
- `docs/` — 文档
- `skills/` — 技能定义文件
- `node_modules/` — 依赖（Vercel 自动安装）

---

## 十、相关文件索引

> 下移为第十章，部署流程见第九章。

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
- CI/CD 配置：`.github/workflows/ci-cd.yml`
- CI/CD 部署日志：GitHub → Actions → CI/CD run
- Vercel 项目配置：`.vercel/project.json`
- Vercel 忽略规则：`.vercelignore`
