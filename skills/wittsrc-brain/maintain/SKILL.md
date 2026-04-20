---
name: wittsrc-maintain
version: 1.0.0
description: |
  维护 Brain 健康状态：检查孤儿页（无入链）、死链接（目标不存在）、
  过期页（90天未更新）、引用审计和标签一致性。
triggers:
  - "维护"
  - "maintain"
  - "brain health"
  - "检查 brain"
  - "doctor"
  - "健康检查"
tools:
  - wittsrc-maintain
mutating: false
---

# wittsrc-maintain — Brain 维护技能

定期检查 Brain Pages 的健康状态，修复孤儿页、死链接和过期内容。

## 检查项

### 1. 孤儿页检测（Orphan Pages）

没有入链（inbound links）的页面：

```bash
bun run scripts/wittsrc-maintain.ts check-orphans
```

- **正常孤立**：SEP/IEP 百科页（仅被 query 访问，不被其他 page 引用）
- **异常孤立**：手稿页/概念页应该被大量引用

### 2. 死链接检测（Dead Links）

指向不存在的目标 slug：

```bash
bun run scripts/wittsrc-maintain.ts check-links
```

- 提取所有 `[[slug]]` 或 `[[title|slug]]` 格式的 wiki 链接
- 检查目标文件是否存在
- 报告悬空引用

### 3. 过期页检测（Stale Pages）

90 天内未更新的页面：

```bash
bun run scripts/wittsrc-maintain.ts check-stale --days 90
```

### 4. 引用审计（Citation Audit）

检查 frontmatter 中的 `sources` 字段是否有效：

```bash
bun run scripts/wittsrc-maintain.ts check-citations
```

- WittSrc URL 是否可访问
- Gutenberg ID 是否有效
- CLARINO URL 是否可访问

### 5. 标签一致性（Tag Consistency）

检查标签格式和重复：

```bash
bun run scripts/wittsrc-maintain.ts check-tags
```

- 标签应为小写、中划线分隔
- 禁止 `period` 标签（用 frontmatter `period` 字段代替）
- 检查同义词合并（如 `language-game` ≈ `language_game`）

## 完整健康检查

```bash
bun run scripts/wittsrc-maintain.ts --check --json
```

输出：

```json
{
  "checkedAt": "2026-04-20T12:00:00Z",
  "totalPages": 162,
  "orphans": {
    "count": 3,
    "pages": ["sep-rule-following", "iep-wittgenstein", "sep-wittgenstein-main"],
    "severity": "warning"
  },
  "deadLinks": {
    "count": 0,
    "severity": "ok"
  },
  "stalePages": {
    "count": 1,
    "pages": ["work-ms-162a"],
    "severity": "info"
  },
  "brokenCitations": {
    "count": 0,
    "severity": "ok"
  },
  "tagIssues": {
    "count": 2,
    "pages": ["concept-family-resemblance"],
    "severity": "warning"
  },
  "overall": "healthy"
}
```

## 自动修复

```bash
# 修复死链接（将悬空引用转为外部 URL）
bun run scripts/wittsrc-maintain.ts --fix dead-links

# 修复标签格式
bun run scripts/wittsrc-maintain.ts --fix tags

# 生成维护报告
bun run scripts/wittsrc-maintain.ts --report --since 2026-04-01
```

## 定期维护计划（Minions Cron）

```yaml
# 每周一次完整检查
cron: "0 2 * * 0"  # 每周日凌晨 2:00

# 每日一次死链接检查
cron: "0 3 * * *"  # 每天凌晨 3:00
```

## 蒸馏流水线集成

### Step 6: 迭代优化

维护报告用于判断 Brain 状态是否适合蒸馏：
- 孤儿页过多 → Step 2 需要补充链接
- 死链接过多 → Step 1 语料导入有问题
- 过期页过多 → Minions cron 未运行

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 健康，无问题 |
| 1 | 警告（可继续） |
| 2 | 错误（需要修复） |

## 反模式

- 不要在 `--fix` 模式下不先执行 `--check`
- 不要删除 orphan pages（只报告，让人工决定）
- 不要修改 compiled truth 区域的内容（只修复 metadata 和链接格式）
