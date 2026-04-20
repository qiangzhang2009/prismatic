#!/bin/bash
# ============================================
# 每日摘要定时任务
# 每天早上 9:00 执行（工作日）
# 配置: 0 9 * * 1-5
# ============================================

# 执行目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DB_PATH="${HOME}/.hermes/data/wechat-assistant.db"
HERMES_DATA="${HOME}/.hermes/data"

echo "[每日摘要] 开始生成 $(date '+%Y-%m-%d %H:%M')"

# 检查数据库是否存在
if [ ! -f "$DB_PATH" ]; then
    echo "[每日摘要] 数据库不存在，跳过"
    exit 0
fi

# 生成昨日日期
YESTERDAY=$(date -v-1d '+%Y-%m-%d')

# 通过 SQLite 查询昨日数据（使用 HERMES 上下文）
SUMMARY=$(sqlite3 "$DB_PATH" "
SELECT
    COUNT(*) as total_messages,
    COUNT(DISTINCT userId) as active_users,
    COUNT(CASE WHEN feedback.id IS NOT NULL THEN 1 END) as new_feedback
FROM messages
LEFT JOIN feedback ON DATE(messages.createdAt) = DATE(feedback.createdAt)
WHERE DATE(messages.createdAt) = '$YESTERDAY'
")

# 如果没有数据，生成友好提示
if [ -z "$SUMMARY" ] || [ "$(echo "$SUMMARY" | cut -d'|' -f1)" = "0" ]; then
    MESSAGE="📊 每日摘要

昨日（$YESTERDAY）暂无数据。

可能是：
- 群未启用消息记录
- 昨日无活跃用户

如有疑问请联系管理员。"
else
    TOTAL=$(echo "$SUMMARY" | cut -d'|' -f1)
    USERS=$(echo "$SUMMARY" | cut -d'|' -f2)
    FEEDBACK=$(echo "$SUMMARY" | cut -d'|' -f3)

    MESSAGE="📊 每日摘要

昨日（$YESTERDAY）数据：
• 群消息数：$TOTAL
• 活跃用户：$USERS
• 新增反馈：$FEEDBACK

数据来源：wechat-assistant 自动统计"
fi

# 发送到管理员私聊
# 注意：通过 Hermes 的 /background 会话中调用 Hermes API 发送
echo "$MESSAGE"
echo "[每日摘要] 生成完成 $(date '+%Y-%m-%d %H:%M')"
