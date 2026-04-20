# Prismatic 对话同步系统设计文档

> 版本：v1.1
> 日期：2026-04-20
> 状态：已实现

---

## 一、问题背景

### 1.1 用户场景

用户在使用 Prismatic 时存在以下几种情况导致对话记录丢失或无法跨设备访问：

1. **未登录的访客**：在 localStorage 中存储对话，换设备/清缓存后消失
2. **同一账号多设备登录**：手机、平板、电脑的对话各自独立，无法共享
3. **登录后离线使用**：无网络时产生的对话无法同步到服务器

### 1.2 核心挑战

| 挑战 | 解决方案 |
|---|---|
| 同一对话在多个设备产生不同内容 | 内容哈希比对 + 冲突检测 |
| 跨设备时 persona 顺序不一致 | 使用排序后的 persona ID 拼接作为对话 key |
| 消息内容很大不适合每次全量同步 | 增量同步（基于时间戳和哈希） |
| 离线产生的消息 | 本地队列 + 上线后批量推送 |
| 匿名用户升级为注册用户 | Visitor → Registered 迁移 |

---

## 二、系统架构

### 2.1 存储层次

```
┌─────────────────────────────────────────────────────────────┐
│  数据库 (PostgreSQL / Neon)                                  │
│                                                             │
│  ┌─────────────┐  ┌───────────────────┐  ┌──────────────┐  │
│  │  Conversation │  │  Message            │  │  Device      │  │
│  │  (对话元数据) │  │  (消息内容)         │  │  (设备注册)  │  │
│  └─────────────┘  └───────────────────┘  └──────────────┘  │
│  ┌─────────────────────┐  ┌─────────────────┐                │
│  │  LocalConversation  │  │  SyncLog         │                │
│  │  (设备对话快照)     │  │  (同步审计日志)   │                │
│  └─────────────────────┘  └─────────────────┘                │
│  ┌─────────────────────┐                                   │
│  │  SyncConflict       │  ← 冲突记录 + 解决方案             │
│  │  SyncConflict      │                                   │
│  └─────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  浏览器 (localStorage)                                      │
│                                                             │
│  prismatic-device-id         ← 设备唯一标识（跨浏览器重装保持）│
│  prismatic-visitor-id        ← 访客 ID（升级后用于迁移）      │
│  prismatic-conversation-registry  ← 所有对话的消息内容       │
│  prismatic-sync-queue       ← 离线消息队列                  │
│  prismatic-sync-token       ← 最后一次同步的 token           │
│  prismatic-convo-{key}     ← 旧格式的对话存储（已迁移）     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 同步流程

```
用户打开应用
    │
    ▼
auth-store.ts: init()
    │
    ├─► /api/user/me  (获取用户信息)
    │
    └─► triggerSyncOnLogin()
            │
            ├─► 读取 prismatic-device-id
            │
            ├─► 读取 prismatic-conversation-registry
            │       (所有本地对话)
            │
            ├─► 读取 prismatic-visitor-id
            │       (访客 ID，若有)
            │
            ├─► POST /api/sync/migrate
            │       (访客→注册用户迁移)
            │       或
            │   POST /api/sync
            │       (常规双向同步)
            │
            └─► 应用 /api/sync 返回的 pullConversations
                    到 localStorage
                    │
                    ▼
                对话列表更新
```

### 2.3 同步触发时机

| 时机 | 触发 | 方式 |
|---|---|---|
| 用户登录成功 | `auth-store login()` | POST /api/sync（完整同步） |
| 用户注册成功 | `auth-store register()` | POST /api/sync/migrate |
| App 初始化（已登录） | `auth-store init()` | POST /api/sync（完整同步） |
| App 窗口获得焦点 | `useConversationSync` visibility listener | POST /api/sync（增量同步） |
| 每条消息发送后 | `useSyncedChatHistory` | POST /api/sync/push（轻量推送） |
| 每 5 分钟（后台） | `useConversationSync` setInterval | POST /api/sync/push（批量推送） |
| 用户手动刷新 | `runFullSync()` | POST /api/sync（完整同步） |
| 网络恢复 | `useConversationSync` online listener | POST /api/sync/push（清空离线队列） |

---

## 三、核心设计

### 3.1 对话 Key（Conversation Key）

**问题**：用户在 Device A 创建了 `Wittgenstein + Confucius` 对话，在 Device B 创建了 `Confucius + Wittgenstein` 对话。这是同一个对话还是两个不同对话？

**解决方案**：将 persona IDs 排序后用 `-` 连接。

```
Key = sort([personaId1, personaId2, ...]).join('-')
示例: sort(['confucius', 'wittgenstein']).join('-')
      = 'confucius-wittgenstein'
```

无论用户选择顺序如何，相同的 persona 组合永远产生相同的 key。跨设备 merge 时可以正确识别为同一对话。

### 3.2 增量同步机制

**问题**：每次同步都传输所有对话内容太慢太贵。

**解决方案**：使用「最后同步时间 + 内容哈希」进行增量同步。

```
本地存储: lastLocalUpdateAt (ISO timestamp)
服务器存储: lastLocalUpdateAt (datetime)
内容哈希: SHA-256(最后20条消息 + 消息总数)

同步判断:
  - 本地哈希 == 服务器哈希 → 已同步，无需操作
  - 本地更新 > 服务器更新 → 推送本地
  - 服务器更新 > 本地更新 → 拉取服务器
  - 时间差 < 5秒 → 冲突（两端同时修改）
```

### 3.3 冲突检测与解决

当检测到冲突时，系统自动尝试合并。

```typescript
冲突类型:
  CONTENT_OVERWRITE — 双方都有消息，内容不同
  TITLE_CONFLICT  — 对话标题不同
  BOTH_CREATED    — 两端同时创建了对话
  DELETED_CONFLICT — 一端删除，另一端有更新

解决策略:
  SERVER_WINS    — 服务器版本优先（默认用于严重冲突）
  LOCAL_WINS     — 本地版本优先
  MERGE_APPEND    — 按时间戳交错合并（默认推荐）
  USER_DECIDES    — 弹出 UI 让用户手动选择

自动合并算法（MERGE_APPEND）:
  1. 收集本地和服务器所有消息
  2. 按 timestamp 排序
  3. 按 id 去重
  4. 结果存储到两端
```

### 3.4 离线支持

```typescript
离线时:
  1. 每条消息 → localStorage（通过 useSyncedChatHistory）
  2. 离线队列 → prismatic-sync-queue（JSON 数组）

上线时:
  1. online 事件触发
  2. 清空离线队列 → POST /api/sync/push
  3. 触发完整同步 → POST /api/sync
  4. 应用 pull 结果到 localStorage
```

---

## 四、数据模型

### 4.1 新增数据表

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `devices` | 设备注册与管理 | `id`(设备指纹), `userId`, `lastSyncedAt` |
| `local_conversations` | 设备对话快照 | `deviceId`, `conversationKey`, `contentHash`, `syncedConversationId` |
| `sync_logs` | 同步操作审计 | `userId`, `direction`, `pushedCount`, `pulledCount`, `conflictCount`, `status` |
| `sync_conflicts` | 冲突记录 | `syncLogId`, `conversationKey`, `localSnapshot`, `serverSnapshot`, `conflictType`, `resolution` |
| `conversation_migrations` | 访客→用户迁移记录 | `userId`, `visitorId`, `conversationKey`, `messagesJson` |

### 4.2 API 路由

| 路由 | 方法 | 用途 |
|---|---|---|
| `/api/sync` | POST | 完整双向同步（登录时、完整刷新时） |
| `/api/sync` | GET | 拉取该设备的所有对话 |
| `/api/sync/push` | POST | 轻量推送（每条消息后、后台定期） |
| `/api/sync/conflicts` | GET | 获取未解决的冲突列表 |
| `/api/sync/conflicts` | POST | 解决一个冲突 |
| `/api/sync/migrate` | POST | 访客→注册用户迁移 |

---

## 五、前端集成

### 5.1 替换 useChatHistory

原有的 `useChatHistory` 只管理当前设备当前对话。新的 `useSyncedChatHistory` 兼容其 API，同时将消息同步到服务器。

```typescript
// 之前
const { messages, setMessages, clearHistory } = useChatHistory(personaIds);

// 之后（完全兼容）
const { messages, setMessages, clearHistory } = useSyncedChatHistory(personaIds);

// 效果相同，但:
//   - 消息自动同步到服务器
//   - 跨设备可见
//   - 离线支持
```

### 5.2 对话列表

对话列表页面需要从 `prismatic-conversation-registry` 读取所有对话，按 `lastUpdated` 排序显示。

### 5.3 冲突 UI

当 `useConversationSync` 返回 `status === 'conflict'` 时，在对话列表中显示警告徽标。点击后弹出解决界面：

```
┌─────────────────────────────────────────────┐
│  ⚠️ 对话同步冲突                              │
├─────────────────────────────────────────────┤
│  Wittgenstein × Confucius                    │
│                                              │
│  此对话在两台设备上都有修改：                  │
│                                              │
│  本地版本（MacBook Pro）                     │
│  2026-04-20 10:30                          │
│  最后消息: "我觉得这是..."                    │
│                                              │
│  服务器版本                                  │
│  2026-04-20 10:32                          │
│  最后消息: "从哲学..."                       │
│                                              │
│  解决方式:                                   │
│  ○ 合并（按时间排序，推荐）                  │
│  ○ 使用本地版本                              │
│  ○ 使用服务器版本                            │
│  ○ 手动选择                                  │
│                                              │
│  [确认]  [取消]                             │
└─────────────────────────────────────────────┘
```

---

## 六、安全与隐私

| 考量 | 方案 |
|---|---|
| 设备伪造 | `deviceId` 存储在 localStorage，换设备后生成新 ID |
| 未登录用户对话 | 仅本地存储，不上传服务器 |
| 消息内容传输 | HTTPS 加密传输 |
| 消息存储 | 服务器明文存储（用户可删除自己数据） |
| 多设备权限 | 所有设备平等，没有主设备概念 |

---

## 七、已实现的文件

### 核心文件

| 文件 | 说明 |
|---|---|
| `prisma/schema.prisma` | 新增 5 个表和 4 个 enum |
| `src/lib/sync-engine.ts` | 核心同步引擎（双向同步、冲突检测、迁移） |
| `src/app/api/sync/route.ts` | GET/POST 完整同步 API |
| `src/app/api/sync/push/route.ts` | 轻量推送 API |
| `src/app/api/sync/conflicts/route.ts` | 冲突管理 API |
| `src/app/api/sync/migrate/route.ts` | 访客迁移 API |
| `src/app/api/admin/sync/stats/route.ts` | 管理员同步统计 API |
| `src/lib/use-conversation-sync.ts` | 前端同步 Hook（自动触发、同步队列） |
| `src/lib/auth-store.ts` | 更新：在 login/register/init 中触发同步 |
| `src/lib/migrate-legacy-storage.ts` | 旧版 localStorage 迁移工具 |

### UI 组件

| 文件 | 说明 |
|---|---|
| `src/components/sync-status-indicator.tsx` | 浮窗同步状态指示器（右下角） |
| `src/components/conflict-resolution-modal.tsx` | 冲突解决 Modal（左右对比 + 三种策略） |
| `src/app/conversations/page.tsx` | 同步版对话列表页（搜索、筛选、分组） |
| `src/app/admin/page.tsx` | 新增「同步管理」Tab（健康度仪表盘 + 冲突/设备/日志） |
| `src/components/providers.tsx` | 集成迁移脚本（App 初始化时自动迁移旧数据） |

---

## 八、部署步骤

1. `npx prisma migrate dev --name add-sync-tables`
2. `npx prisma generate`
3. 提交代码 → CI 自动部署

---

## 九、未尽事宜

- [ ] 对话删除的跨设备同步
- [ ] 对话导入/导出的同步支持
- [ ] 移动端 PWA 的 Service Worker 缓存策略
- [ ] IndexedDB 作为 localStorage 的备选（存储空间更大）
- [ ] 设备管理页面（允许用户查看/注销已登录设备）
- [ ] 同步通知 Toast（消息级别的推送提示）
