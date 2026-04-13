## 回滚计划 — 2026-04-14

### 当前部署状态

| 项目 | 值 |
|------|----|
| 部署时间 | 2026-04-14 |
| Git commit | `5d6edc3` (fix: add missing today variable + lint fix) |
| Vercel 部署 | `prismatic-r2oppzhv8` — **● Ready** |
| 域名 | `prismatic-app.vercel.app` |
| 回滚 Tag | `rollback-point-20260414` → `0661cec` |

---

### 回滚操作（任选其一）

#### 选项 A：Vercel Dashboard（推荐）

1. 打开 https://vercel.com/johnzhangs-projects-50e83ec4/prismatic-app
2. 进入 **Deployments** 标签
3. 找到 `prismatic-jcqjacawv` (之前正常的 Ready 部署，1h 前)
4. 点击 **⋮** → **Promote to Production**

#### 选项 B：Vercel CLI

```bash
# 查看部署列表
vercel list

# 回滚到上一个正常版本
vercel rollback prismatic-jcqjacawv --prod

# 或用 deployment URL
vercel rollback https://prismatic-jcqjacawv-johnzhangs-projects-50e83ec4.vercel.app --prod
```

#### 选项 C：Git 回滚（会改变代码）

```bash
# 切到回滚点（保留未推送 commit）
git checkout rollback-point-20260414

# 或者强制重置到上一个正常 commit
git reset --hard 4458df5
git push -f origin main
# 然后 Vercel 会自动重新部署
```

---

### Forum 表回滚

如果需要回滚 forum 数据库变更：

```bash
# 在本地数据库执行
npx ts-node scripts/create-forum-tables.ts rollback

# 在 Neon 控制台执行
DROP TABLE IF EXISTS prismatic_forum_topic_suggestions;
DROP TABLE IF EXISTS prismatic_forum_debate_votes;
DROP TABLE IF EXISTS prismatic_forum_debate_views;
DROP TABLE IF EXISTS prismatic_forum_debate_turns;
DROP TABLE IF EXISTS prismatic_forum_debates;
```

---

### 部署历史

| 时间 | Commit | 部署 | 状态 |
|------|--------|------|------|
| 1h 前 | `4458df5` | `prismatic-jcqjacawv` | ● Ready |
| 刚才 | `5d6edc3` | `prismatic-r2oppzhv8` | ● Ready（当前生产）|
