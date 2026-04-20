#!/bin/bash
# ============================================
# 每周报告定时任务
# 每周一早上 10:00 执行
# 配置: 0 10 * * 1
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_PATH="${HOME}/.hermes/data/wechat-assistant.db"

echo "[每周报告] 开始生成 $(date '+%Y-%m-%d %H:%M')"

if [ ! -f "$DB_PATH" ]; then
    echo "[每周报告] 数据库不存在，跳过"
    exit 0
fi

# 计算上周日期范围
WEEK_START=$(date -v-7d -j -f "%Y-%m-%d" "$(date '+%Y-%m-%d')" "+%Y-%m-%d" 2>/dev/null || date -d "7 days ago" '+%Y-%m-%d')
WEEK_END=$(date -v-1d '+%Y-%m-%d' 2>/dev/null || date -d "yesterday" '+%Y-%m-%d')

# 查询周数据
WEEK_DATA=$(sqlite3 "$DB_PATH" "
SELECT
    COUNT(*) as total_messages,
    COUNT(DISTINCT userId) as active_users,
    COUNT(DISTINCT groupId) as active_groups,
    COUNT(CASE WHEN feedback.id IS NOT NULL THEN 1 END) as feedback_count,
    COUNT(CASE WHEN feedback.sentiment = 'negative' THEN 1 END) as negative_feedback
FROM messages
LEFT JOIN feedback ON messages.groupId = feedback.groupId
    AND DATE(messages.createdAt) >= '$WEEK_START'
    AND DATE(feedback.createdAt) >= '$WEEK_START'
WHERE DATE(messages.createdAt) >= '$WEEK_START'
    AND DATE(messages.createdAt) <= '$WEEK_END'
")

if [ -z "$WEEK_DATA" ] || [ "$(echo "$WEEK_DATA" | cut -d'|' -f1)" = "0" ]; then
    MESSAGE="📈 每周报告

上周（$WEEK_START ~ $WEEK_END）暂无数据。"
else
    TOTAL=$(echo "$WEEK_DATA" | cut -d'|' -f1)
    USERS=$(echo "$WEEK_DATA" | cut -d'|' -f2)
    GROUPS=$(echo "$WEEK_DATA" | cut -d'|' -f3)
    FEEDBACK=$(echo "$WEEK_DATA" | cut -d'|' -f4)
    NEGATIVE=$(echo "$WEEK_DATA" | cut -d'|' -f5)

    MESSAGE="📈 每周报告

上周（$WEEK_START ~ $WEEK_END）：
• 总消息数：$TOTAL
• 活跃用户：$USERS
• 活跃群组：$GROUPS
• 收到反馈：$FEEDBACK
• 负面反馈：$NEGATIVE

---
💡 建议：登录管理后台查看详细分析
"
fi

echo "$MESSAGE"
echo "[每周报告] 生成完成 $(date '+%Y-%m-%d %H:%M')"
