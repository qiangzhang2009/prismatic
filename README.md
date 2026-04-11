# 炼心阁 · 认知蒸馏会客厅

> **让古今中外的智者同堂，为你的问题各抒己见。芒格、马斯克、乔布斯、费曼……选择你的智囊团，开启多维度思考之旅。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)
[![Deployed on Vercel](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)

---

## 核心功能

### 四种协作模式

| 模式 | 人数 | 场景 |
|------|------|------|
| 👤 **单人对话** | 1人 | 深度探索单一视角 |
| 🔺 **折射视图** | 2-3人 | 多视角全面分析 |
| 🏛️ **圆桌辩论** | 4-8人 | 多人物实时辩论收敛 |
| 🎯 **任务模式** | 2-6人 | 多角色分工协作 |

### 33+ 位蒸馏人物

来自投资、商业、科技、哲学、教育、军事等领域的卓越思考者，包括乔布斯、马斯克、芒格、纳瓦尔、费曼、格雷厄姆、张一鸣、卡尔帕西、塔勒布、孙子、塞内卡、老子等。

---

## 在线体验

访问 **[prismatic-app.vercel.app](https://prismatic-app.vercel.app)** 直接使用。

---

## 本地部署

### 环境要求

- Node.js 18+
- npm 或 yarn

### 部署步骤

```bash
# 1. 克隆仓库
git clone https://github.com/qiangzhang2009/prismatic.git
cd prismatic

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Key

# 4. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 环境变量配置

```env
# LLM Provider（必填）
DEEPSEEK_API_KEY=sk-...
LLM_PROVIDER=deepseek

# 可选：OpenAI
OPENAI_API_KEY=sk-...

# 可选：Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# NextAuth（必填）
AUTH_SECRET=your-random-secret
AUTH_GITHUB_ID=your-github-oauth-app-id
AUTH_GITHUB_SECRET=your-github-oauth-app-secret
NEXTAUTH_URL=http://localhost:3000
```

### 支持的模型

| Provider | 模型 | 说明 |
|----------|------|------|
| DeepSeek | deepseek-chat, deepseek-reasoner | ✅ 默认 |
| OpenAI | GPT-4o, GPT-4-turbo | 配置后可用 |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus | 配置后可用 |

---

## 项目架构

```
src/
├── app/                      # Next.js App Router
│   ├── api/                 # API 路由
│   │   ├── chat/           # 多智能体对话 API
│   │   ├── personas/       # 人物数据 API
│   │   └── auth/          # NextAuth 认证
│   ├── app/               # 主应用页面
│   ├── personas/           # 人物档案馆
│   ├── graph/              # 知识图谱
│   └── methodology/        # 蒸馏方法论
├── components/              # React 组件
│   ├── chat-interface.tsx  # 对话界面
│   ├── persona-card.tsx   # 人物卡片
│   └── mode-selector.tsx  # 模式选择器
└── lib/                    # 核心库
    ├── personas.ts          # 33个人物数据
    ├── prismatic-agent.ts  # 多智能体编排引擎
    ├── llm.ts             # LLM 抽象层
    ├── types.ts           # TypeScript 类型
    └── constants.ts       # 全局常量
```

---

## 开发指南

```bash
# 类型检查
npm run type-check

# 代码检查
npm run lint

# 测试
npm test

# 生产构建
npm run build
```

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 添加新人物

1. 在 `src/lib/personas.ts` 中添加新的 Persona 条目
2. 确保包含：mentalModels、decisionHeuristics、expressionDNA、honestBoundaries
3. 运行 `npm run type-check` 确保类型正确

---

## 许可证

MIT License — 详见 [LICENSE](LICENSE)

---

## 致谢

- 基于认知蒸馏方法论的人物建模
- 使用 [Next.js](https://nextjs.org)、[Tailwind CSS](https://tailwindcss.com)、[Framer Motion](https://framer.com/motion/)
- 灵感来自所有为人类认知做出卓越贡献的思考者们
