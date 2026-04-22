# Wechat Assistant · 智能微信群管理助手

> 基于 Hermes Agent + Prismatic Persona 系统的通用智能微信群管理助手。支持个人微信 + 企业微信双入口，具备 AI 对话答疑、关键词自动管理、定时任务、反馈收集，人格切换五大核心功能。

---

## 核心能力

| 功能 | 说明 |
|------|------|
| AI 对话答疑 | 基于 Persona 风格的多角色 AI 助手 |
| 关键词管理 | L1/L2/L3 三层过滤，广告自动拦截 |
| 定时任务 | 日报/周报推送、潜水提醒、内容订阅 |
| 反馈收集 | 自动归集群友意见，支持导出分析 |
| 人格切换 | 5 种预设 Persona，一键切换群风格 |

---

## 快速开始

### 1. 启动管理后台（本地）

```bash
cd admin-panel

# 方式一：交互式启动
./run-local.sh

# 方式二：手动
npm install
npx prisma generate
npm run dev
# 打开 http://localhost:3001
```

> **注意**：管理后台需要在本地运行才能访问 Hermes 数据。

### 2. 启动 Hermes Gateway

```bash
hermes gateway run
```

### 3. 在微信中发送消息

管理后台会自动显示：
- Gateway 运行状态（PID、平台连接）
- 实时会话记录
- Token 消耗统计
- 平台消息统计

---

## 系统架构

```
你的 Mac
┌──────────────────────────────────────────────────────┐
│  ~/.hermes/                                        │
│  ├── sessions/sessions.json     ← 真实会话数据      │
│  ├── gateway_state.json        ← Gateway 状态       │
│  ├── channel_directory.json    ← 通道目录           │
│  ├── SOUL.md                  ← 人格配置           │
│  └── data/wechat-assistant.db ← SQLite 数据库       │
│                                                      │
│  Hermes Gateway (PID 90950)                         │
│  └── 微信 ──→ Agent ──→ LLM (DeepSeek)            │
│                                                      │
│  Admin Panel (localhost:3001)                       │
│  └── 从 ~/.hermes/ 读取真实数据 → 显示              │
└──────────────────────────────────────────────────────┘
```

---

## 管理后台页面

| 页面 | 地址 | 功能 |
|------|------|------|
| 总览仪表盘 | `/` | Gateway 状态、平台连接、Token 统计、会话列表 |
| 群组配置 | `/groups` | 添加/管理微信群，绑定 Persona |
| Persona 管理 | `/personas` | 查看 5 种预设人格，复制 slug |
| 反馈中心 | `/feedback` | 查看/处理用户反馈，标记状态 |
| 定时任务 | `/tasks` | 创建/管理 Cron 定时任务 |
| 消息日志 | `/logs` | 搜索历史消息记录 |
| 系统设置 | `/settings` | Gateway 状态、**微信权限配置**、人格编辑、Skills、文档链接 |
| 会话详情 | `/sessions/[id]` | 单个会话的完整对话记录 |

---

## 数据层

- **SQLite 数据库**：`~/.hermes/data/wechat-assistant.db`
  - 群组配置、反馈记录、违规记录、定时任务
  - 开发环境直接读写本地文件
  - 生产环境可切换为 PostgreSQL (Neon)

- **Hermes 运行时数据**（JSON 文件）
  - `sessions/sessions.json` — 会话元数据
  - `session_*.json` — 完整会话（含 system prompt）
  - `*.jsonl` — 原始消息流
  - `gateway_state.json` — Gateway 实时状态
  - `channel_directory.json` — 通道/联系人列表
  - `SOUL.md` — 当前人格配置

---

## Persona 人格库

| Slug | 名称 | 风格 |
|------|------|------|
| `smart-assistant` | 智能助手 | 默认助手风格，有问必答 |
| `customer-service` | 客服小秘 | 专业友好，不超过 200 字 |
| `mentor` | 导师 | 启发式引导，侧重学习成长 |
| `entertainer` | 吐槽大师 | 轻松幽默，适度玩梗 |
| `strict-moderator` | 严格管理员 | 简洁直接，规则明确 |

---

## 目录结构

```
wechat-assistant/
├── admin-panel/               # 管理后台（Next.js, :3001）
│   ├── run-local.sh          # 本地启动脚本
│   ├── .env.local            # 本地环境变量（指向 ~/.hermes）
│   ├── src/
│   │   ├── app/             # 页面路由 + API
│   │   ├── lib/
│   │   │   ├── hermes.ts    # Hermes 数据读取库
│   │   │   ├── db.ts        # Prisma 客户端
│   │   │   └── persona-registry.ts  # Persona 管理
│   │   └── app/globals.css  # 深空主题样式
│   └── prisma/schema.prisma  # SQLite 数据模型
├── corpus/personas/           # Persona JSON 文件
└── scripts/                 # 迁移脚本
```

---

## 配置文档

- [Hermes Agent 文档](https://hermes-agent.nousresearch.com/)
- [微信接入指南](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin)
- [企业微信接入](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom)
- [MCP 集成文档](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp)

---

*Prismatic · 棱镜折射 — 蒸馏项目配套工具*
