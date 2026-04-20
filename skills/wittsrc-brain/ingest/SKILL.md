---
name: wittsrc-ingest
version: 1.0.0
description: |
  将 Wittgenstein 语料（WittSrc/Clarino/Gutenberg）导入 Brain Pages。
  识别文件类型，按规则路由到 brain/ 目录（works/concepts/people/timelines），
  执行 chunking、embedding 和去重。
triggers:
  - "导入维特根斯坦语料"
  - "导入语料"
  - "ingest wittgenstein"
  - "import corpus"
  - "摄入"
tools:
  - wittsrc-import
mutating: true
---

# wittsrc-ingest — 语料摄入技能

将外部语料文件转化为 Brain Pages，写入 `corpus/wittgenstein/brain/`。

## 输入识别规则

| 文件名模式 | 目标目录 | 类型 |
|-----------|---------|------|
| `*_Clarino-CC.txt` | `brain/works/` | 手稿正文 |
| `*_WittSrc*.txt` | `brain/works/` | 手稿正文 |
| `wab_xml/*.xml` | `brain/works/` | TEI XML 手稿 |
| `wittsrg/*.txt` | `brain/works/` | 手稿正文 |
| `sep-*.txt` | `brain/concepts/` | SEP 百科条目 |
| `iep-*.txt` | `brain/concepts/` | IEP 百科条目 |
| `wittgenstein-tractatus.txt` | `brain/works/` | 公版著作 |
| `wittgenstein-philosophical-investigations.txt` | `brain/works/` | 公版著作 |
| `wittgenstein-*.txt` (其他) | `brain/concepts/` | 混合内容 |

## 处理流程

### 1. 文件扫描

```bash
bun run scripts/wittsrc-brain-import.ts \
  --corpus corpus/wittgenstein/texts/ \
  --output corpus/wittgenstein/brain/ \
  --dry-run
```

### 2. 路由规则执行

- 识别文件类型（手稿 / 百科 / 公版著作）
- 分配 slug（基于文件名和内容 hash）
- 检查是否已存在（内容 hash 去重）

### 3. Chunking 策略

```typescript
const CHUNK_SIZE = 512;       // tokens per chunk
const CHUNK_OVERLAP = 64;    // overlap tokens
const STRATEGY = 'semantic'; // 或 'recursive' 或 'fixed'
```

### 4. Metadata 提取

```yaml
---
type: work            # work | concept | person | timeline
title: Ms-114
titleFull: "Notebooks 1914-1916"
slug: work-ms-114
source: WittSrc BNE
sourceUrl: "http://www.wittgensteinsource.org/"
collection: manuscripts
period: [1912, 1916]
wordCount: 500860
encoding: Clarino-CC | WittSrc-Normalized | Gutenberg
---
```

### 5. 错误处理

- **文件不存在**: 跳过，记录警告
- **编码错误**: 尝试 `utf-8` → `latin-1` → `cp1252`
- **重复内容**: 比较 hash，已存在则跳过（idempotent）
- **空文件**: 跳过并记录

## 产出

```
corpus/wittgenstein/brain/
  works/
    work-ms-114.md         (compiled truth + timeline)
    work-ms-114.md.meta    (embedding metadata)
    work-tractatus.md
  concepts/
    concept-language-game.md
    concept-private-language.md
  people/
    person-russell.md
  timelines/
    timeline-language-game.md  (演变时间线)
```

## 防呆检查

- [ ] 至少 80% 的 WITTSRC 文件被路由到 `works/`
- [ ] 所有 `_Clarino-CC.txt` 文件都被识别
- [ ] chunk 总数合理（每 500 tokens 一个 chunk）
- [ ] 没有文件被重复写入（hash dedup 生效）

## 反模式

- 不要对已存在的文件重复导入（用 `--dry-run` 先检查）
- 不要把 SEP/IEP 百科文件导入 `works/`（它们是二手文献）
- 不要跳过 metadata 提取（后续检索需要 `period` 字段）
