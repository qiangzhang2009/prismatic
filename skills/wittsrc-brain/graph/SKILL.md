---
name: wittsrc-graph
version: 1.0.0
description: |
  知识图谱遍历：基于抽取的 typed links（cites/evolves_to/contradicts/influenced_by）
  执行递归图查询。回答关系型问题，如"Ms-114 和 Ms-152 之间有什么关系"、
  "语言游戏概念是如何演变的"。
triggers:
  - "图查询"
  - "graph query"
  - "关系图"
  - "手稿.*演变"
  - "how.*connect"
  - "who.*linked"
  - "知识图谱"
tools:
  - wittsrc-graph-query
mutating: false
---

# wittsrc-graph — 图遍历查询

基于 typed links 构建的 Wittgenstein Nachlass 知识图谱进行图遍历查询。

## 图结构

```json
{
  "nodes": { "[slug]": { "type": "work|concept|person", "period": [start, end], "label": "..." } },
  "edges": [
    { "from": "work-ms-114", "to": "work-ts-207", "type": "evolves_to" },
    { "from": "work-ms-152", "to": "concept-private-language", "type": "defines" }
  ]
}
```

## 图查询命令

```bash
# 查询某个节点的所有关系
bun run scripts/wittsrc-graph-query.ts work-ms-114

# 只看 evolves_to 关系
bun run scripts/wittsrc-graph-query.ts work-ms-114 --type evolves_to

# 2 度遍历（谁引用了 Ms-114 引用的内容）
bun run scripts/wittsrc-graph-query.ts work-ms-114 --depth 2 --direction both

# 只看入链（谁引用了 Ms-114）
bun run scripts/wittsrc-graph-query.ts work-ms-114 --direction in

# 只看出链（Ms-114 引用了什么）
bun run scripts/wittsrc-graph-query.ts work-ms-114 --direction out

# 查询路径（两个节点之间的路径）
bun run scripts/wittsrc-graph-query.ts work-ms-114 --path-to work-ts-207

# 过滤类型（找所有矛盾关系）
bun run scripts/wittsrc-graph-query.ts --type contradicts --depth 1
```

## 递归 CTE 实现

```typescript
// 伪代码：图遍历（避免循环）
function graphQuery(
  startSlug: string,
  type?: LinkType,
  direction: 'in' | 'out' | 'both' = 'both',
  depth: number = 3,
  maxDepth: number = 10
): GraphResult {
  const visited = new Set<string>();
  const queue: Array<{ slug: string; depth: number }> = [{ slug: startSlug, depth: 0 }];
  const results: Edge[] = [];

  while (queue.length > 0) {
    const { slug, depth } = queue.shift()!;
    if (visited.has(slug) || depth > maxDepth) continue;
    visited.add(slug);

    const edges = loadEdges(slug, type, direction);
    for (const edge of edges) {
      results.push(edge);
      queue.push({ slug: edge.target, depth: depth + 1 });
    }
  }

  return { nodes: [...visited], edges: results };
}
```

## 图查询示例

### 示例 1: 语言游戏概念的演变

```bash
bun run scripts/wittsrc-graph-query.ts concept-language-game --type evolves_to --depth 3
```

返回：
```
concept-language-game (Language Game)
  ├── defines ──► work-ts-207 (Ts-207, 1929)
  │     └── evolves_to ──► work-ts-212 (Ts-212 Big Typescript, 1937)
  │           └── evolves_to ──► work-pi (PI, 1953)
  └── influenced_by ──► person-russell (Russell, early discussions)
```

### 示例 2: 找出所有矛盾关系

```bash
bun run scripts/wittsrc-graph-query.ts --type contradicts --depth 1
```

返回所有存在 `contradicts` 边的节点对：

```
Ms-152 ──contradicts──► PI §243 (private language)
Ms-114 ──contradicts──► Ts-207 (early vs middle)
Ts-212 ──contradicts──► Tractatus (post-publication shift)
```

### 示例 3: 两个手稿之间的路径

```bash
bun run scripts/wittsrc-graph-query.ts work-ms-114 --path-to work-pi
```

返回最短路径：

```
work-ms-114 (1912-1916)
  └── evolves_to ──► work-ts-207 (1929-1931)
        └── evolves_to ──► work-ts-212 (1937-1938)
              └── evolves_to ──► work-pi (1938-1951)
```

## 蒸馏流水线集成

### Step 2: 心智模型提取

图查询可以回答：
- "语言游戏这个概念是如何从早期手稿演变到 PI 的？"
- "Wittgenstein 对 Russell 的态度（引用/矛盾/影响）随时间如何变化？"
- "哪些手稿讨论了私人语言论证，它们之间是什么关系？"

### Step 3: 表达 DNA

查询特定概念的提及频率分布（哪些时期讨论最多）：

```bash
bun run scripts/wittsrc-graph-query.ts concept-private-language --type defines --depth 1 | \
  jq '.edges | group_by(.period) | map({period: .[0].period, count: length})'
```

## 性能考虑

- 深度限制：默认 `maxDepth=10`，防止 DoS
- 循环检测：`visited` set 防止重复遍历
- 批量查询：对多个 slug 并行查询
- 缓存：图结构缓存在内存，10 分钟过期

## 反模式

- 不要对不存在于图中的节点执行查询（先检查 `nodes` 字典）
- 不要跳过循环检测（ Wittgenstein 手稿有大量自引用）
- 不要返回超过 100 条边（截断并提示）
