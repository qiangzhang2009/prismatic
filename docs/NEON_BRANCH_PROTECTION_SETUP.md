# Neon 分支保护与只读凭证设置指南

> **执行时间：5 分钟手动操作，之后所有自动化都基于此运行。**

---

## 步骤 1: 保护 main 分支

1. 打开 [Neon Console](https://console.neon.tech/app/projects/cold-cell-86302864)
2. 进入项目 → **Branches** → 点击 `main` 分支
3. 找到 **Protected** 开关 → 打开
4. 同样保护 `website-backend-admin` 项目 (`crimson-river-48992324`) 的 main 分支

**效果：** main 分支无法被删除或重置，即使有人持有完整凭证也无法绕过。

---

## 步骤 2: 创建只读凭证（Read-only Role）

Neon PostgreSQL 支持创建额外的连接凭证。

### 方案 A：通过 Neon Console（推荐）

1. 进入项目 → **Roles** → **Create role**
2. Role 名称：`prismatic_readonly`
3. 权限：`CONNECT` + `SELECT`（所有表）
4. 复制生成的密码

### 方案 B：通过 SQL（在 Neon SQL Editor 或 psql 中执行）

```sql
-- 创建只读角色
CREATE ROLE prismatic_readonly WITH LOGIN PASSWORD 'your-strong-password-here';

-- 授予所有表的 SELECT 权限
GRANT CONNECT ON DATABASE neondb TO prismatic_readonly;
GRANT USAGE ON SCHEMA public TO prismatic_readonly;

-- 对所有现有表
GRANT SELECT ON ALL TABLES IN SCHEMA public TO prismatic_readonly;

-- 对未来新建的表也自动授予（需要设置默认权限）
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO prismatic_readonly;

-- 对所有序列（用于 SELECT 时获取 nextval）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO prismatic_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO prismatic_readonly;
```

### 方案 C：应用分层凭证（最佳实践）

应用使用两种连接：

```
生产环境连接策略：

┌──────────────────────────────────────────────────────────┐
│  应用代码（Next.js API Routes）                          │
│  → 使用 DATABASE_URL_READONLY（只读凭证）                │
│    • 所有 SELECT 查询正常                                │
│    • INSERT/UPDATE/DELETE → 被 RLS 或应用层拦截         │
│    • 只能读取，不能修改数据                              │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  迁移脚本 + 种子脚本（独立执行）                          │
│  → 使用 DATABASE_URL（读写凭证）                        │
│    • 仅在本地/CI 中手动触发                              │
│    • 受 GitHub Actions 迁移安全闸保护                    │
│    • 不通过 Vercel 环境变量暴露                         │
└──────────────────────────────────────────────────────────┘
```

---

## 步骤 3: 验证保护生效

创建只读凭证后，验证：

```bash
# 测试只读凭证（应该只能 SELECT）
psql "postgresql://prismatic_readonly:密码@host/neondb?sslmode=require"
neondb=> DELETE FROM users WHERE id = 'test';
ERROR:  permission denied for table users  ✅

neondb=> SELECT COUNT(*) FROM users;
 count
-------
 1
 ✅
```

---

## 步骤 4: 更新 .env.production

添加只读凭证：

```env
# 只读凭证（应用使用这个）
DATABASE_URL_READONLY="postgresql://prismatic_readonly:密码@host/neondb?sslmode=require"

# 读写凭证（仅迁移脚本使用，不部署到 Vercel）
DATABASE_URL_RW="postgresql://neondb_owner:密码@host/neondb?sslmode=require"
```

> **重要：** `DATABASE_URL_RW` 不要添加到 Vercel 环境变量中。只在本地和 CI secrets 中使用。
