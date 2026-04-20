---
name: wittsrc-brain-resolver
version: 1.0.0
description: |
  WittSrc Brain Skill 路由表。告诉 agent 在什么情况下该调用哪个子技能。
  由 gbrain resolver 格式驱动，匹配 trigger 关键字到具体 skill。
---

# WittSrc Brain RESOLVER

## 路由规则

当用户的请求包含以下关键词时，调用对应技能：

| 触发词/模式 | 目标技能 | 说明 |
|------------|---------|------|
| `导入.*语料` / `import.*corpus` / `ingest` | `wittsrc-ingest` | 将外部语料文件摄入 Brain |
| `auto-link` / `抽取链接` / `手稿引用` / `引用关系` / `extract links` | `wittsrc-link` | 零 LLM 抽取实体引用生成图 |
| `查询` / `搜索` / `query` / `search` / `关于.*说了什么` | `wittsrc-query` | 混合搜索 + 图查询 |
| `图查询` / `graph` / `关系图` / `who.*connect` / `手稿.*演变` | `wittsrc-graph` | 知识图谱遍历 |
| `维护` / `maintain` / `检查.*brain` / `doctor` | `wittsrc-maintain` | 脑健康检查 |
| `enrich` / `富化` / `实体.*信息` | `wittsrc-enrich` | 实体页富化 |
| `时间线` / `timeline` / `演变` / `evolution` | `wittsrc-timeline` | 提取概念/人物时间线 |
| `soul.*audit` / `身份配置` / `who.*Wittgenstein` | `wittsrc-soul-audit` | WittSrc 身份配置 |

## 决策树

```
用户输入
  │
  ├─ 包含"导入"或"ingest"或"corpus" → wittsrc-ingest
  │
  ├─ 包含"链接"或"link"或"引用"或"graph"或"关系"
  │    ├─ 图结构查询（who→what, how→connect）→ wittsrc-graph
  │    └─ 批量抽取（从现有页面提取链接）→ wittsrc-link
  │
  ├─ 包含"查询"或"search"或"问"或"什么.*说"
  │    ├─ 关系型问题（who works at X, what did Y invest）→ wittsrc-graph
  │    └─ 内容型问题（关于 X 的观点）→ wittsrc-query
  │
  ├─ 包含"时间线"或"timeline"或"演变" → wittsrc-timeline
  │
  ├─ 包含"enrich"或"富化" → wittsrc-enrich
  │
  ├─ 包含"maintain"或"检查"或"doctor" → wittsrc-maintain
  │
  ├─ 包含"soul"或"身份"或"who am I" → wittsrc-soul-audit
  │
  └─ 不明确 → wittsrc-query（默认）
```

## 默认行为

如果无法确定技能，返回 `wittsrc-query` 并附注建议：
> "没有检测到具体操作，默认使用 query 技能。如需导入语料请说'导入维特根斯坦语料'，如需抽取链接请说'抽取手稿引用关系'。"
