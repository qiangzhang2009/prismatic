# 人物语料采集计划

**生成时间**: 2026-04-22
**更新维护**: 每次新增采集完成后更新此文件

---

## 总览

| 优先级 | 人物 | 语料来源 | 状态 | 预计工作量 |
|---|---|---|---|---|
| P0 | nassim-taleb | Twitter/X 全量 | 🚫 未采集 | 高 |
| P0 | steve-jobs | 传记 + 采访 | 🚫 未采集 | 中 |
| P0 | zhang-yiming | 全员会 + 采访 | 🚫 未采集 | 中 |
| P0 | ilya-sutskever | Twitter + 论文 | 🚫 未采集 | 中 |
| P1 | andrej-karpathy | Twitter + YouTube | 🚫 未采集 | 中 |
| P1 | richard-feynman | PDF讲义(需OCR) | 📄 PDF待转 | 高 |
| P1 | warren-buffett | 股东信 + 年会 | ⚠️ 部分数据 | 低 |
| P1 | jensen-huang | GTC大会 + CEO记录 | ⚠️ 部分数据 | 中 |
| P2 | alan-watts | 讲座录音 + 书籍 | 🚫 未采集 | 中 |
| P2 | osamu-dazai | 作品原文 + 研究 | 🚫 未采集 | 中 |
| P2 | mrbeast | YouTube字幕 | 🚫 未采集 | 中 |
| P2 | zhang-xuefeng | B站/抖音字幕 | ⚠️ 语料极差(6KB) | 中 |
| P3 | john-dee | 历史文献 | 🚫 未采集 | 高 |
| P3 | lin-yutang | 著作 + 采访 | 🚫 未采集 | 低 |
| P3 | yuan-tiangang | 命理文献 | 🚫 未采集 | 高 |
| P3 | marcus-aurelius-stoic | 历史文献 | 🚫 未采集 | 高 |

---

## 详细采集方案

### P0 — 最高优先级

#### 1. Nassim Taleb
- **人物ID**: `nassim-taleb`
- **重要性**: 哲学/概率论核心人物，Incerto系列是重要语料
- **采集方案**:
  - Twitter/X: `@nntaleb` 全量推文 (已有API收集方案)
  - Incerto 系列书籍: Fooled by Randomness, Black Swan, Antifragile, Skin in the Game, Fooled by Randomness
  - Medium博客文章
- **采集脚本**: 参考 `scrapers/twitter/` 目录，使用 Twitter API v2
- **预计语料量**: 500K+ 字
- **参考路径**: `scrapers/training_data/raw/nassim-taleb/` (目前为空，需创建)

#### 2. Steve Jobs
- **人物ID**: `steve-jobs`
- **采集方案**:
  - Walter Isaacson 传记（已有计划）
  - All Things D 采访视频字幕
  - Stanford 毕业典礼演讲
  - Macworld 发布会转录
- **采集脚本**: `scrapers/personae/` 下新建
- **预计语料量**: 200K+ 字

#### 3. 张一鸣 (zhang-yiming)
- **人物ID**: `zhang-yiming`
- **采集方案**:
  - 字节跳动全员会转录 (关键)
  - 知乎/公众号采访
  - 早期博客文章
- **预计语料量**: 100K+ 字

#### 4. Ilya Sutskever
- **人物ID**: `ilya-sutskever`
- **采集方案**:
  - Twitter/X: `@ilyasut` 全量推文
  - OpenAI 官方博客文章
  - 学术论文 (arXiv)
  - YouTube 访谈视频字幕
- **预计语料量**: 200K+ 字

---

### P1 — 高优先级

#### 5. Andrej Karpathy
- **人物ID**: `andrej-karpathy`
- **采集方案**:
  - Twitter/X: `@karpathy` 全量推文
  - YouTube: Stanford CS231n, Making Neural Nets, Andrej Karpathy AI 教程字幕
  - 博客: `karpathy.github.io`
- **预计语料量**: 300K+ 字

#### 6. Richard Feynman
- **人物ID**: `richard-feynman`
- **当前状态**: `scrapers/training_data/raw/richard-feynman/` 有 38 个 PDF (共131MB)
- **采集方案**: PDF → 文本 OCR 转换
  - 使用 `pdftotext` (poppler-utils) 提取文本
  - Feynman Lectures on Physics (3卷)
  - "Surely You're Joking, Mr. Feynman!"
  - "What Do You Care What Other People Think?"
  - Caltech 讲座录音转录
- **预计语料量**: 1M+ 字

#### 7. Warren Buffett
- **人物ID**: `warren-buffett`
- **当前状态**: `scrapers/training_data/raw/jeff-bezos/warren-buffett-ceo.json` 有 CEO 记录
- **采集方案**:
  - 历年致股东信 (1977-2025)
  - Berkshire Hathaway 年度股东大会转录
- **预计语料量**: 500K+ 字

#### 8. Jensen Huang
- **人物ID**: `jensen-huang`
- **当前状态**: `scrapers/training_data/raw/jeff-bezos/jensen-huang-ceo.json` 有 CEO 记录
- **采集方案**:
  - GTC 大会主题演讲 (2009-2025 历史存档)
  - Lex Fridman 访谈
  - CES/NVIDIA 发布活动
- **预计语料量**: 200K+ 字

---

### P2 — 中优先级

#### 9. Alan Watts
- **人物ID**: `alan-watts`
- **采集方案**:
  - 讲座录音转录 (alanwatts.org)
  - 书籍: "The Book", "Way of Zen" 等
- **预计语料量**: 200K+ 字

#### 10. Osamu Dazai (太宰治)
- **人物ID**: `osamu-dazai`
- **采集方案**:
  - 日文原版作品: "人间失格", "斜陽" 等
  - 相关研究文献
- **预计语料量**: 100K+ 字

#### 11. MrBeast
- **人物ID**: `mrbeast`
- **采集方案**:
  - YouTube 视频字幕 (Title of videos)
  - Twitter/X: `@MrBeast`
- **预计语料量**: 100K+ 字

#### 12. 张雪峰 (zhang-xuefeng)
- **人物ID**: `zhang-xuefeng`
- **当前状态**: `scrapers/training_data/raw/zhang-xuefeng/training_corpus.txt` 仅 6KB
- **采集方案**:
  - B站视频字幕 (核心来源)
  - 抖音视频字幕
  - 知乎回答
- **预计语料量**: 500K+ 字 (需大幅扩充)

---

### P3 — 低优先级

#### 13. 刘伯温 (yuan-tiangang)
- **人物ID**: `yuan-tiangang`
- **采集方案**: 历史文献、奏议、碑文
- **预计语料量**: 50K+ 字

#### 14. 林语堂 (lin-yutang)
- **人物ID**: `lin-yutang`
- **采集方案**: 主要著作、采访记录
- **预计语料量**: 200K+ 字

#### 15. Marcus Aurelius (斯多葛版)
- **人物ID**: `marcus-aurelius-stoic`
- **备注**: 注意与 `marcus-aurelius` (已有) 区分，此为斯多葛哲学专项
- **采集方案**: Meditations 相关学术研究

#### 16. John Dee
- **人物ID**: `john-dee`
- **采集方案**: 历史文献、学术研究
- **预计语料量**: 50K+ 字

---

## 采集规范

### 文件格式
```
corpus/{persona-id}/texts/
├── {source-type}_{title}.txt   # 纯文本
├── {source-type}_{title}.json  # 结构化数据
└── {source-type}_{title}.md    # Markdown
```

### 元数据要求
每个文件头部包含:
```
===
来源: {来源名称}
URL: {原始链接}
采集时间: YYYY-MM-DD
===
```

### 采集后操作
1. 运行 `python3 scripts/import-corpus.py --persona {id}` 导入语料
2. 更新 `corpus/corpus-master-manifest.json`
3. 运行 `bun run scripts/distill-v4.ts {persona-id}` 开始蒸馏
4. 蒸馏完成后运行 `python3 scripts/merge-v4-python.py --write` 合并到 personas.ts
5. 提交 PR

### 质量标准
- 文本编码: UTF-8
- 最小语料量: 10K 字
- 推荐语料量: 50K+ 字
- 长文本需分段保存
