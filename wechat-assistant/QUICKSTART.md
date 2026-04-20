# Wechat Assistant · 快速上手指南

> **版本**: v1.0
> **最后更新**: 2026-04-20
> **适用范围**: 连接个人微信/企业微信到 Hermes Agent

---

## 一、系统架构

```
你的电脑 (本地运行)
┌─────────────────────────────────────────┐
│  Hermes Gateway (hermes-agent)           │
│  ├── 微信连接 (iLink Bot API)             │
│  ├── LLM 调用 (DeepSeek)                 │
│  └── Persona 引擎                        │
└─────────────────────────────────────────┘
                    │
                    ▼
            管理后台 (Vercel)
    https://admin-panel-gamma-pied.vercel.app
```

**重要**：Hermes Gateway 必须**持续运行**在你的电脑上（或者部署到云服务器），微信消息才会被处理。

---

## 二、连接微信（步骤 1-4）

### 步骤 1：安装依赖

在终端运行：

```bash
pip install aiohttp cryptography hermes-agent[messaging]
```

### 步骤 2：运行扫码登录

```bash
hermes gateway setup
```

选择 **Weixin** 选项，终端会显示一个二维码。

用微信手机客户端扫描二维码，然后在手机上确认登录。

登录成功后，你会看到：
```
微信连接成功，account_id=your-account-id
```

凭证会自动保存到 `~/.hermes/weixin/` 目录。

### 步骤 3：检查连接状态

```bash
hermes gateway status
```

### 步骤 4：启动 Gateway

```bash
hermes gateway run
```

Gateway 会保持运行，持续接收微信消息。

---

## 三、配置群组管理（步骤 5-7）

### 步骤 5：开启群组功能

默认情况下，微信机器人**只响应私聊**，不会响应群消息。

编辑 `~/.hermes/.env`：

```env
# 群组策略：open=响应所有群，allowlist=只响应指定群
WEIXIN_GROUP_POLICY=open

# 或者只允许特定群
WEIXIN_GROUP_POLICY=allowlist
WEIXIN_GROUP_ALLOWED_USERS=群ID1,群ID2

# 私聊策略：open=所有人，pairing=配对模式
WEIXIN_DM_POLICY=open
```

### 步骤 6：添加群组到管理后台

启动 Gateway 后，机器人会记录你加入的群的 ID。

然后在管理后台 https://admin-panel-gamma-pied.vercel.app：

1. 进入 **群组配置** 页面
2. 点击 **添加群组**
3. 填入群名称和群 ID
4. 选择使用哪个 Persona（人格）
5. 设置关键词过滤策略

### 步骤 7：验证连接

在微信群里发一条消息，机器人应该会回复。

---

## 四、启动命令参考

| 命令 | 说明 |
|------|------|
| `hermes gateway setup` | 扫码连接微信 |
| `hermes gateway run` | 启动 Gateway（前台运行） |
| `hermes gateway install` | 安装为后台服务（Mac/Linux） |
| `hermes gateway status` | 查看连接状态 |
| `hermes gateway` | 交互式 Gateway 模式 |

### 后台运行（推荐）

如果希望 Gateway 在后台持续运行：

```bash
# Mac: 使用 launchd
hermes gateway install

# 或者使用 tmux/screen
tmux
hermes gateway run
# 按 Ctrl+B 然后按 D 来分离 tmux session
```

---

## 五、Persona 人格配置

### 预设人格

| Slug | 名称 | 风格 |
|------|------|------|
| `smart-assistant` | 智能助手 | 有问必答 |
| `customer-service` | 客服小秘 | 专业友好，不超过 200 字 |
| `mentor` | 导师 | 启发式引导 |
| `entertainer` | 吐槽大师 | 轻松幽默 |
| `strict-moderator` | 严格管理员 | 简洁直接 |

### 修改人格

编辑 `wechat-assistant/corpus/personas/` 目录下的 JSON 文件。

### 切换群的 Persona

在管理后台的群组配置页面，可以为每个群单独设置 Persona。

---

## 六、常见问题

### Q: 机器人不回复群消息
A: 检查 `WEIXIN_GROUP_POLICY` 是否设置为 `open` 或 `allowlist`（默认是 `disabled`）

### Q: 二维码过期了
A: 重新运行 `hermes gateway setup`，二维码会自动刷新

### Q: Session expired (errcode=-14)
A: 登录已过期，重新运行 `hermes gateway setup` 扫码

### Q: 如何让机器人只在特定群响应？
```env
WEIXIN_GROUP_POLICY=allowlist
WEIXIN_GROUP_ALLOWED_USERS=群ID1,群ID2
```

### Q: 如何限制只有我能私聊机器人？
```env
WEIXIN_DM_POLICY=allowlist
WEIXIN_ALLOWED_USERS=你的微信ID
```

---

## 七、架构决策：本地 vs 云端

### 当前方案：本地 Hermes + Vercel 后台

**优点**：
- 快速上手
- 数据完全在你控制之下

**缺点**：
- 需要你的电脑一直开着
- 如果你的网络没有公网 IP，群消息可能有延迟

### 替代方案：部署到云服务器（Fly.io/Railway）

如果你希望 24/7 在线，可以把 Hermes 部署到云服务器：

```bash
# 使用 Docker 部署
docker run -d \
  --name hermes \
  --restart unless-stopped \
  -v ~/.hermes:/opt/data \
  -p 8642:8642 \
  nousresearch/hermes-agent gateway run
```

---

## 八、管理后台 URL

- **微信助手管理后台**：https://admin-panel-gamma-pied.vercel.app
- **棱镜折射主站**：https://prismatic-i2b4ye23c-johnzhangs-projects-50e83ec4.vercel.app

---

## 九、相关文档

- [Hermes Agent 官方文档](https://hermes-agent.nousresearch.com/)
- [微信接入指南](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/weixin)
- [企业微信接入](https://hermes-agent.nousresearch.com/docs/user-guide/messaging/wecom)
