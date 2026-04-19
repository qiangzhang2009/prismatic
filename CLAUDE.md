# Prismatic · 棱镜折射 — Agent 章程

> **版本**: v1.0
> **最后更新**: 2026-04-19
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

## 七、相关文件索引

- 管理后台入口：`src/app/admin/page.tsx`
- Admin API 路由：`src/app/api/admin/`
- Prisma Schema：`prisma/schema.prisma`
- Persona 定义：`src/lib/personas.ts`
- 数据 Hooks：`src/lib/use-admin-data.ts`
- Tracking 系统：`src/lib/tracking.ts`
