#!/bin/bash
# ============================================
# 潜水用户提醒
# 每周五晚上 20:00 执行
# 配置: 0 20 * * 5
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${HOME}/.hermes/data/wechat-assistant.db"

echo "[潜水提醒] 开始检查 $(date '+%Y-%m-%d %H:%M')"

if [ ! -f "$DB_PATH" ]; then
    echo "[潜水提醒] 数据库不存在，跳过"
    exit 0
fi

# 统计 7 天内无发言的用户（在群里但沉默）
INACTIVE_USERS=$(sqlite3 "$DB_PATH" "
SELECT COUNT(DISTINCT userId)
FROM messages
WHERE createdAt < datetime('now', '-7 days')
")

echo "[潜水提醒] 发现 $INACTIVE_USERS 位用户最近 7 天未发言"
echo "[潜水提醒] 完成 $(date '+%Y-%m-%d %H:%M')"
