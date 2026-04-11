# Prismatic · 折射之光

> **一个汇聚人类最卓越思维的系统，让乔布斯、马斯克、芒格、费曼同时为你思考。**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org)

---

## ✨ 核心特性

### 四种协作模式

| 模式 | 人数 | 场景 |
|------|------|------|
| 👤 **单人对话** | 1人 | 深度探索单一视角 |
| 🔺 **折射视图** | 2-3人 | 全面透视问题本质 |
| 🏛️ **圆桌辩论** | 4-8人 | 多人物实时辩论收敛 |
| 🎯 **任务模式** | 2-6人 | 多角色分工协作 |

### 15位蒸馏人物

来自投资、商业、科技、哲学、教育等领域的卓越思考者：

- **Steve Jobs** · 产品 / 设计 / 战略
- **Elon Musk** · 工程 / 第一性原理 / 成本拆解
- **Charlie Munger** · 投资 / 多元思维 / 逆向分析
- **Naval Ravikant** · 财富 / 杠杆 / 人生哲学
- **Richard Feynman** · 学习 / 科学思维 / 简化
- **Paul Graham** · 创业 / 写作 / 品味
- **Zhang Yiming** · 产品 / 组织 / 全球化
- **Andrew Karpathy** · AI / 工程 / 教育
- **Nassim Taleb** · 风险 / 反脆弱 / 尾部思维
- *(更多人物持续添加中)*

### 知识图谱

交互式三维可视化，展示：
- 人物-概念连接网络
- 跨人物认知距离
- 共享心智模型地图

---

## 🚀 快速开始

### 方式一：在线体验

访问 **[prismatic.app](https://prismatic.app)** 直接使用。

### 方式二：本地部署

```bash
# 1. 克隆仓库
git clone https://github.com/yourusername/prismatic.git
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

### 方式三：Docker 部署

```bash
# 构建镜像
docker build -t prismatic .

# 运行容器
docker run -p 3000:3000 \
  --env-file .env.example \
  prismatic
```

---

## 🔧 配置

### 环境变量

```env
# LLM Provider (必填)
OPENAI_API_KEY=sk-...

# 可选：Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Vector Database (可选，用于语义搜索)
PINECONE_API_KEY=your-key

# Cache (可选)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### 支持的模型

| Provider | 模型 | 状态 |
|----------|------|------|
| OpenAI | GPT-4o, GPT-4-turbo | ✅ 默认 |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus | ✅ |
| Azure OpenAI | GPT-4, GPT-35-turbo | ⚙️ 配置后可用 |
| 本地模型 | Ollama, LM Studio | ⚙️ 配置后可用 |

---

## 🏗️ 项目架构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── chat/          # 多智能体对话 API
│   │   └── personas/      # 人物数据 API
│   ├── app/              # 聊天应用页面
│   ├── personas/          # 人物档案馆页面
│   └── graph/             # 知识图谱页面
├── components/             # React 组件
│   ├── chat-interface.tsx  # 主对话界面
│   ├── persona-card.tsx   # 人物卡片
│   └── mode-selector.tsx  # 模式选择器
├── lib/                   # 核心库
│   ├── personas.ts         # 15个人物完整数据
│   ├── prismatic-agent.ts  # 多智能体编排引擎
│   ├── llm.ts             # LLM 抽象层
│   ├── types.ts           # TypeScript 类型
│   └── constants.ts       # 全局常量
└── store.ts               # Zustand 状态管理
```

---

## 🎯 使用指南

### 单人对话模式

选择一个人物，直接提问：

```
> 用乔布斯的视角分析这个产品设计

乔布斯会先问：这是给谁用的？
然后他会看产品能不能用一句话说清楚。
如果说不清楚，这个产品就有问题。
```

### 折射视图模式

选择 2-3 个人物，系统同时生成多视角分析：

```
用户：帮我分析这个创业方向

Jobs视角：先看产品是否解决了真实问题，还是在解决想象中的问题
Musk视角：先算成本结构的渐近极限，看有没有10x改进空间
Naval视角：先问这有没有杠杆，产出和投入是线性还是指数关系

综合分析：三位视角都指向同一个问题——市场验证不足...
```

### 圆桌辩论模式

选择 4+ 个人物，系统自动组织辩论：

```
第1轮 - 开场陈述：
  Jobs：产品定义优先
  Musk：成本结构优先
  Munger：激励机制优先
  Naval：长期视角优先

第2轮 - 交叉质询：
  Jobs → Munger：你的激励机制分析忽视了产品体验...
  ...

最终共识：
  三位都同意：在讨论成本结构之前，先确认产品是否解决了真实问题。
```

---

## 🧪 开发

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

## 🤝 贡献

欢迎提交 PR！请参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 添加新人物

1. 在 `src/lib/personas.ts` 中添加新的 Persona 对象
2. 确保包含：mentalModels、decisionHeuristics、expressionDNA、honestBoundaries
3. 运行 `npm run type-check` 确保类型正确

### 添加新模式

1. 在 `src/lib/types.ts` 的 Mode 类型中添加新模式
2. 在 `src/lib/prismatic-agent.ts` 中实现新模式的逻辑
3. 在 UI 组件中支持新模式

---

## 📄 许可证

MIT License — 详见 [LICENSE](LICENSE)

---

## 🙏 致谢

- 基于 [女娲 (nuwa-skill)](https://github.com/alchaincyf/nuwa-skill) 的蒸馏方法论
- 使用 [Next.js](https://nextjs.org)、[Tailwind CSS](https://tailwindcss.com)、[Framer Motion](https://framer.com/motion/)
- 灵感来自所有为人类认知做出卓越贡献的思考者们

---

*Prismatic — 折射之光，让每一个卓越灵魂为你思考。*
