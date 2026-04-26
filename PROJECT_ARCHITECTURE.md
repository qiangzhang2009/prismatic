# 项目架构与数据文档

> **维护日期**: 2026-04-24
> **项目名称**: Prismatic · 棱镜折射
> **技术栈**: Next.js 14 + TypeScript + PostgreSQL (Neon) + Prisma

---

## 一、项目整体架构

```
prismatic/
├── src/                      # Next.js 主应用
│   ├── app/                  # App Router 页面
│   │   ├── api/              # API 路由
│   │   ├── personas/         # 人物档案馆
│   │   ├── forum/            # 智辩场
│   │   ├── admin/            # 管理后台
│   │   └── auth/             # 认证页面
│   ├── components/           # React 组件
│   └── lib/                  # 核心业务逻辑
│
├── scripts/                  # 工具脚本 (~95个，清理后)
│   ├── archive/              # 归档旧版本 (22个)
│   ├── corpus/               # 语料收集相关
│   ├── wittsrg*/            # 维特根斯坦语料下载
│   ├── distill*/            # 蒸馏相关
│   ├── fix-*.ts/mjs         # 数据修复脚本
│   ├── deploy-*.ts/mjs      # 部署脚本
│   └── check-*.ts           # 检查脚本
│
├── corpus/                   # 语料数据目录
│   └── ni-haixia/           # 倪海厦中医资料
│       ├── texts/           # 文本语料
│       └── raw-images/      # 原始图片 (OCR用)
│
├── prisma/                   # 数据库 Schema
├── newsnow-local/           # 旧版本前端（遗留）
├── backups/                  # 数据备份
├── docs/                     # 文档
└── scrapers/                 # 爬虫脚本
```

---

## 二、核心代码模块 (src/lib/)

### 2.1 身份认证与用户管理
| 文件 | 用途 |
|------|------|
| `auth.ts` | 主认证逻辑 |
| `auth-utils.ts` | 认证工具函数 |
| `auth-complete.ts` | 认证完成处理 |
| `auth-store.ts` | 认证状态管理 (Zustand) |
| `encryption.ts` | API Key 加密存储 |
| `user-management.ts` | 用户管理逻辑 |
| `user-service.ts` | 用户服务层 |
| `session-manager.ts` | 会话管理 |

### 2.2 多智能体蒸馏系统
| 文件 | 用途 |
|------|------|
| `distillation-v4.ts` | 蒸馏 v4 核心引擎 |
| `distillation-v4-types.ts` | 蒸馏类型定义 |
| `distillation-config.ts` | 蒸馏配置 |
| `distillation-metrics.ts` | 蒸馏指标 |
| `distillation-l1-intelligence.ts` | L1 智能层 |
| `distillation-l2-routing.ts` | L2 路由层 |
| `distillation-l3-knowledge.ts` | L3 知识层 |
| `distillation-l4-expression.ts` | L4 表达层 |
| `distillation-l5-validation.ts` | L5 验证层 |
| `distillation-l6-gates.ts` | L6 门控层 |
| `distillation-semantic-validator.ts` | 语义验证 |
| `distillation-translation.ts` | 翻译层 |
| `distillation-events.ts` | 事件处理 |

### 2.3 智能体与辩论
| 文件 | 用途 |
|------|------|
| `prismatic-agent.ts` | 多智能体编排引擎 |
| `guardian.ts` | 守望者调度 |
| `guardian-engine.ts` | 守望者引擎 |
| `guardian-discussion-engine.ts` | 守望者讨论引擎 |
| `debate-arena-engine.ts` | 辩论场引擎 |
| `persona-skills.ts` | 人物技能定义 |

### 2.4 人物数据集
| 文件 | 用途 |
|------|------|
| `personas.ts` | **核心人物数据集** (~48位蒸馏人物) |
| `personas-example.ts` | 人物数据示例 |

### 2.5 同步与多设备
| 文件 | 用途 |
|------|------|
| `sync-engine.ts` | 同步引擎 |
| `use-conversation-sync.ts` | 对话同步 Hook |
| `migrate-legacy-storage.ts` | 旧存储迁移 |

### 2.6 其他核心模块
| 文件 | 用途 |
|------|------|
| `llm.ts` | LLM 抽象层 (DeepSeek/OpenAI/Anthropic) |
| `prisma.ts` | Prisma 客户端 |
| `admin-db.ts` | 管理员数据库访问 |
| `store.ts` | Zustand 全局状态 |
| `constants.ts` | 常量定义 |
| `utils.ts` | 工具函数 |

---

## 三、数据库 Schema (prisma/schema.prisma)

### 3.1 核心数据表
| 表名 | 用途 |
|------|------|
| `users` | 用户主表 |
| `accounts` | OAuth 账号关联 |
| `conversations` | 对话记录 |
| `messages` | 消息详情 |
| `comments` | 评论 |

### 3.2 认证相关
| 表名 | 用途 |
|------|------|
| `verification_tokens` | 验证令牌 |
| `verification_codes` | 验证码 (短信/邮箱) |
| `auth_events` | 认证事件日志 |

### 3.3 分析与统计
| 表名 | 用途 |
|------|------|
| `user_sessions` | 用户会话 |
| `user_events` | 用户事件追踪 |
| `daily_metrics` | 每日指标 |
| `admin_audit_logs` | 管理员审计日志 |
| `system_daily_stats` | 系统每日统计 |

### 3.4 守望者计划
| 表名 | 用途 |
|------|------|
| `guardian_duties` | 守望者排班 |
| `guardian_discussions` | 守望者讨论 |

### 3.5 蒸馏系统
| 表名 | 用途 |
|------|------|
| `distill_sessions` | 蒸馏会话 |
| `distill_corpus_items` | 语料库条目 |
| `distilled_personas` | 已蒸馏人物 |

### 3.6 多设备同步
| 表名 | 用途 |
|------|------|
| `devices` | 设备管理 |
| `local_conversations` | 本地对话快照 |
| `sync_logs` | 同步日志 |
| `sync_conflicts` | 同步冲突 |
| `conversation_migrations` | 对话迁移记录 |

---

## 四、Scripts 目录结构 (~75个活跃文件 + 22个归档)

### 4.1 活跃脚本分类

#### 部署脚本
```
scripts/deploy-v5-to-db.mjs    # 部署 v5 到数据库 (推荐)
scripts/deploy-v4-to-db.mjs    # 部署 v4 到数据库
scripts/deploy-via-api.mjs     # API 部署
```

#### 数据修复脚本 (fix-*)
```
scripts/fix-*.ts/mjs           # 各种数据修复
scripts/fix-all-sp-corruption.ts
scripts/fix-db-chinese.mjs
scripts/fix-corrupted-json.ts
scripts/fix-remaining-sp.ts
scripts/fix-all-namezh.mjs
scripts/fix-final-8.ts
scripts/fix-db-sp-corruption.ts
scripts/fix-persona-colors.js
scripts/fix-persona-data-format.ts
```

#### 合并脚本 (merge-*)
```
scripts/merge-v4-python.py       # 合并 v4 人物 (推荐)
```

#### 蒸馏脚本 (distill-*)
```
scripts/distill-v5-batch.mjs    # v5 批量蒸馏 (推荐)
```

#### 审计与检查 (check-* / audit-*)
```
scripts/audit-personas.ts        # 人物审计
scripts/check-admin-convs.ts    # 检查管理员对话
scripts/check-admin-latest.ts    # 检查最新对话
scripts/check-jiqun.ts          # 检查集群
scripts/check-users.ts          # 检查用户
scripts/check-tables.ts         # 检查表结构
scripts/analyze_missing_confidence.py
```

#### 导出与迁移
```
scripts/export-all-tables.ts     # 导出所有表
scripts/migrate-*.ts           # 迁移脚本
scripts/backup-workflow.js      # 备份工作流
```

### 4.2 语料收集 (scripts/corpus/)
```
scripts/corpus/
├── ni-haixia-convert.py      # 倪海厦语料转换
├── ni-haixia-ocr.py          # OCR 识别
├── ni-haixia-inventory*.py   # 语料清单管理
├── wiki-builder.ts           # Wiki 构建
├── wiki-lint.ts              # Wiki 检查
└── fingerprint-compare.ts    # 指纹比对
```

### 4.3 维特根斯坦语料 (wittsrg*/)
```
scripts/wittsrg-*.py          # 批量下载
scripts/wittsrg-*-py.py       # Playwright 下载
scripts/wittgenstein-*.py     # 语料处理
scripts/extract-*.py          # 内容提取
```

### 4.4 WittSRC 相关
```
scripts/wittsrc-*.ts          # 维特根斯坦来源追踪
```

### 4.5 归档目录 (scripts/archive/)
```
scripts/archive/               # 22个已归档脚本
├── merge-v4-fast.ts         # 旧版合并
├── merge-v4-personas.ts
├── merge-v4-v2.ts
├── distill-v4.ts            # 旧版蒸馏
├── distill-persona.ts
├── distill-batch.ts
├── debug-*.js/mjs           # 调试文件
└── test-*.ts/js            # 测试文件
```

---

## 五、语料数据目录 (corpus/)

### 5.1 清理后的结构
```
corpus/ni-haixia/
├── texts/                    # 文本语料
│   ├── 老王-临床医案/         # 临床医案 (2个文件)
│   ├── 老王-人纪教材/         # 人纪教材 (3个文件)
│   ├── 老王-天纪教材/         # 天纪教材 (1个文件)
│   └── 逐字讲稿-PDF/          # PDF讲稿 (1个文件)
└── raw-images/               # 原始图片 (OCR用)
    ├── page-01.png
    ├── tianji-01.png
    ├── tianji-02.png
    ├── zhenjiu-001.png
    ├── zhenjiu-002.png
    └── zhenjiu-003.png
```

### 5.2 语料统计
| 目录 | 文件数 | 说明 |
|------|--------|------|
| 老王-临床医案 | 2 | 清代名医医案、观音功法 |
| 老王-人纪教材 | 3 | 神农本草经、天机道 |
| 老王-天纪教材 | 1 | 天纪繁体竖版 |
| 逐字讲稿-PDF | 1 | 针灸大成 |
| **总计** | **7** | |

---

## 六、备份目录 (backups/)

```
backups/2026-04-18/
├── personas.json            # 人物数据备份
├── users.json               # 用户数据备份
├── conversations.json        # 对话备份
├── messages.json            # 消息备份
├── comments.json            # 评论备份
├── auth_events.json         # 认证事件
├── user_sessions.json       # 会话数据
├── admin_audit_logs.json    # 审计日志
└── ... (共20+个表)
```

---

## 七、清理记录 (2026-04-24)

### 7.1 已完成的清理

| 操作 | 详情 |
|------|------|
| **归档旧版本脚本** | 6个 (merge-v4-fast/v2/personas, distill-v4/persona/batch) |
| **归档调试文件** | 16个 (8个debug*, 8个test*) |
| **删除重复目录** | corpus/corpus-prismatic/ (已合并到 ni-haixia/) |
| **移动OCR图片** | 从 tmp_ocr/ 移动到 corpus/ni-haixia/raw-images/ |
| **删除空目录** | tmp_ocr/ |

### 7.2 当前状态
- **活跃脚本**: 75个
- **归档脚本**: 22个 (位于 scripts/archive/)
- **Scripts 目录**: 从 ~134个 减少到 ~97个 (含 archive)

### 7.3 建议的后续清理

**可进一步归档** (有替代脚本):
- `db-publish-personas.ts` → 使用 `db-publish-personas.py`
- `collect-wittgenstein.ts` → 使用 `collect-wittgenstein-recover.ts`

**可考虑删除的遗留文件**:
- `newsnow-local/` - 旧版本前端，可考虑移除
- `--source/` - 源码目录，需确认用途

---

## 八、快速导航

### 核心业务逻辑
```
src/lib/personas.ts          # 人物数据集
src/lib/prismatic-agent.ts   # 多智能体引擎
src/lib/distillation-v4.ts   # 蒸馏引擎
```

### 常用数据库操作
```bash
# 部署人物到数据库
node scripts/deploy-v5-to-db.mjs

# 检查数据
node scripts/audit-personas.ts
node scripts/check-admin-latest.ts

# 修复数据
node scripts/fix-all-sp-corruption.ts
```

### 语料处理
```bash
# 转换倪海厦语料
python scripts/corpus/ni-haixia-convert.py

# OCR 处理
python scripts/corpus/ni-haixia-ocr.py
```

---

*文档生成时间: 2026-04-24*
