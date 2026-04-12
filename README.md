# Prismatic · 折射之光

> **「人可以是书，那么，书也可以是人」**
>
> 每个人的一生都是一本书，每本书都是一个人的灵魂。当我们阅读那些卓越人物的著作时，不仅是在获取知识，更是在与一个伟大的灵魂对话——他们把自己人生的智慧、失败、顿悟，都凝聚成了文字。
>
> **Prismatic** 基于这一认知，通过深度访谈、文献研究、著作分析等方式，对人类历史上最卓越的思考者进行「认知蒸馏」，重构他们的思维模型、决策框架和表达DNA。让乔布斯、马斯克、芒格、费曼同时为你思考——不是引用他们说过的话，而是用他们的方式去思考你的问题。

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

来自投资、商业、科技、哲学、宗教、教育、军事等领域的卓越思考者，包括乔布斯、马斯克、芒格、纳瓦尔、费曼、格雷厄姆、张一鸣、卡尔帕西、塔勒布、孙子、塞内卡、老子、庄子、六祖慧能、济群法师、康德、尼古拉·特斯拉、爱因斯坦、钱学森等。

---

## 在线体验

访问 **[prismatic.zxqconsulting.com](https://prismatic.zxqconsulting.com)** 直接使用。

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

# 3. 初始化数据库（需要 PostgreSQL）
npx prisma db push

# 4. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的 API Key

# 5. 启动开发服务器
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 用户登录体系

Prismatic 支持多种登录方式，无需 GitHub 或 Google 账户也能正常使用。

### 支持的登录方式

| 方式 | 适用场景 | 配置难度 |
|------|---------|---------|
| **邮箱 + 密码** | 国内用户首选 | ⭐ 简单 |
| **手机号 + 验证码** | 追求便捷的用户 | ⭐⭐ 需配置短信 |
| **微信 OAuth** | 国内用户最习惯 | ⭐⭐ 需微信开放平台账号 |
| **邮箱魔法链接** | 无需记忆密码 | ⭐ 简单 |
| **GitHub** | 开发者群体 | ⭐⭐ 需 GitHub OAuth App |
| **Google** | 国际用户 | ⭐⭐ 需 Google OAuth App |

### 快速启用（开发环境）

开发环境下，邮箱验证码会自动打印到控制台，无需配置短信服务。

### 生产环境配置

#### 1. 数据库（必填）
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/prismatic"
```
运行 `npx prisma db push` 初始化数据库表。

#### 2. 邮箱服务（推荐）
推荐使用 [Resend](https://resend.com)，免费额度足够个人使用：
```env
RESEND_API_KEY=re_your_key
EMAIL_FROM=Prismatic <noreply@yourdomain.com>
```

#### 3. 手机号登录（可选）
国内推荐阿里云短信，国际推荐 Twilio：
```env
# 阿里云短信
ALIYUN_ACCESS_KEY_ID=xxx
ALIYUN_ACCESS_KEY_SECRET=xxx
ALIYUN_SMS_SIGN_NAME=Prismatic
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxxxxxx

# 或 Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

#### 4. 微信登录（可选）
在 [微信开放平台](https://open.weixin.qq.com) 创建网站应用后：
```env
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret
```

### 用户体系特性

- **无门槛注册**：邮箱或手机号即可注册，无需第三方账户
- **多账号绑定**：同一用户可绑定微信、GitHub、Google 等多个账号
- **会话持久化**：JWT 30天有效期，自动续期
- **登录日志**：完整的认证事件审计日志
- **频率限制**：防暴力破解的验证码冷却机制
- **账号安全**：支持修改密码、绑定/解绑第三方账号

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

## 数据库初始化

```bash
# 推送 schema 到数据库
npx prisma db push

# 生成 Prisma Client
npx prisma generate

# 查看数据库（可选）
npx prisma studio
```

---

## 许可证

MIT License — 详见 [LICENSE](LICENSE)

---

## 致谢

- 基于认知蒸馏方法论的人物建模
- 使用 [Next.js](https://nextjs.org)、[Tailwind CSS](https://tailwindcss.com)、[Framer Motion](https://framer.com/motion/)
- 灵感来自所有为人类认知做出卓越贡献的思考者们
