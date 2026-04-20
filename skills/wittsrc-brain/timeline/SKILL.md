---
name: wittsrc-timeline
version: 1.0.0
description: |
  从 Brain Pages 中提取时间线数据，生成概念演变/人物活动时间/手稿写作历史的时间线视图。
  用于蒸馏 Step 2 心智模型中的"版本"和"演变"字段。
triggers:
  - "时间线"
  - "timeline"
  - "演变"
  - "evolution"
  - "什么时候"
  - "when did"
  - "手稿写作历史"
tools:
  - wittsrc-timeline
mutating: false
---

# wittsrc-timeline — 时间线提取技能

从 Brain Pages 的 timeline 区域（`---` 分隔线后）提取结构化时间线，
为概念演变分析和 Persona 版本管理提供数据支撑。

## 时间线格式约定

Brain Page 中的 timeline 区域遵循固定格式：

```markdown
---
type: concept
title: Language Game
period: [1930, 1951]
---

... compiled truth above ...

---

## Timeline

- 1930-01: First occurrence in Ms-112, used tentatively
- 1933-01: Fully developed in Ms-152
- 1937-01: Appears in Ts-212 (Big Typescript)
- 1945-01: Last revision before death
- 1953-01: Published posthumously in PI §1-7
```

## 提取算法

```typescript
// 时间线条目正则
const TIMELINE_ENTRY = /^-\s*(\d{4}(?:-\d{2})?(?:-\d{2})?):\s*(.+)$/gm;

// 支持格式：
// - 1930-01: Event description
// - 1930: Event description
// - 1930-01-15: Event description
```

## 时间线类型

| 类型 | 来源 | 示例 |
|------|------|------|
| `work-timeline` | 手稿写作时间 | Ms-114 写于 1912-1916 |
| `concept-timeline` | 概念演变 | 语言游戏 1930→1953 |
| `person-timeline` | 人物活动时间 | Russell 1912 访剑桥 |
| `period-timeline` | 哲学时期 | 早期/过渡/后期分界 |

## 命令

```bash
# 生成单个概念的时间线
bun run scripts/wittsrc-timeline.ts concept-language-game

# 生成所有概念的时间线
bun run scripts/wittsrc-timeline.ts --all --type concept

# 生成手稿写作时间线
bun run scripts/wittsrc-timeline.ts --all --type work

# 生成哲学时期分界时间线
bun run scripts/wittsrc-timeline.ts --periods

# 比较两个概念的时间线重叠
bun run scripts/wittsrc-timeline.ts concept-language-game concept-private-language --compare
```

## 输出格式

```json
{
  "slug": "concept-language-game",
  "title": "Language Game",
  "type": "concept",
  "span": [1930, 1953],
  "entries": [
    { "date": "1930-01", "event": "First occurrence in Ms-112", "slug": "work-ms-112", "confidence": 0.95 },
    { "date": "1933-01", "event": "Fully developed in Ms-152", "slug": "work-ms-152", "confidence": 0.90 },
    { "date": "1937-01", "event": "Appears in Ts-212", "slug": "work-ts-212", "confidence": 0.92 },
    { "date": "1953-01", "event": "Published in PI §1-7", "slug": "work-pi", "confidence": 1.0 }
  ],
  "gaps": [
    { "start": "1933-01", "end": "1937-01", "duration": "4 years" }
  ]
}
```

## 蒸馏流水线集成

### Step 2: 心智模型提取

每个心智模型的 `evidence` 字段需要按时间排序：

```typescript
interface MentalModel {
  // ...
  timeline: Array<{
    year: number;
    quote: string;
    source: string;
    interpretation: string;
  }>;
}
```

时间线工具帮助填充这个字段：
- 按年份排序所有引用
- 标注演变节点（引用密度突然增加/减少）
- 发现空白期（某个时期未讨论该概念）

### Step 6: 迭代优化

时间线也用于跟踪 Persona 自身的版本演化：

```
## WittSrc Brain 更新时间线

- 2026-04-20: 初始导入 WittSrc 140 手稿
- 2026-04-21: 抽取首批链接，生成引用图
- 2026-05-01: 集成 SEP/IEP 百科富化
- 2026-05-15: 完成所有 162 份 Nachlass 覆盖
```

## 反模式

- 不要把 timeline 区域的注释当作事件（"# 注释" 不计入时间线）
- 不要对没有 timeline 区域的页面报错（生成空时间线 + 警告）
- 不要跳过日期解析错误（记录并跳过，continue）
