#!/bin/bash
# Cursor 聊天记录自动备份脚本
# 使用方法: 添加到 crontab: 0 */4 * * * /Users/john/蒸馏2/scripts/backup_cursor_chat.sh
# 每4小时自动备份一次

SCRIPT_DIR="/Users/john/蒸馏2/scripts"
BACKUP_DIR="/Users/john/蒸馏2/.specstory/history"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG="$SCRIPT_DIR/backup.log"

echo "[$TIMESTAMP] 开始备份 Cursor 聊天记录..." >> "$LOG"
python3 "$SCRIPT_DIR/export_cursor_chat.py" >> "$LOG" 2>&1
echo "[$TIMESTAMP] 备份完成！" >> "$LOG"
