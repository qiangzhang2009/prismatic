#!/usr/bin/env python3
"""
导出 Cursor 3.0 的聊天记录到 .specstory/history/ 目录
适配 Cursor 3.0 新存储格式: aiService.generations
"""
import sqlite3
import json
import os
from datetime import datetime

WORKSPACE_ID = "3136b074926e82436dc6809883bfe35d"
DB_PATH = f"/Users/john/Library/Application Support/Cursor/User/workspaceStorage/{WORKSPACE_ID}/state.vscdb"
OUTPUT_DIR = "/Users/john/蒸馏2/.specstory/history"

def export_chat_history():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM ItemTable WHERE key='aiService.generations'")
    row = cursor.fetchone()
    if not row:
        print("❌ 未找到 aiService.generations 数据")
        return

    generations = json.loads(row[0])
    print(f"✅ 找到 {len(generations)} 条聊天记录")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 按时间排序
    generations.sort(key=lambda x: x.get('unixMs', 0))

    for i, gen in enumerate(generations):
        ts = gen.get('unixMs', 0) // 1000
        dt = datetime.fromtimestamp(ts)
        dt_str = dt.strftime('%Y-%m-%d %H:%M:%S')
        uuid = gen.get('generationUUID', f'gen_{i}')
        gtype = gen.get('type', 'unknown')
        text = gen.get('textDescription', '')

        # 文件名: timestamp_title.md
        title_part = text[:40].replace('/', '-').replace('\\', '-').replace('*', '').replace('#', '').strip()
        if not title_part:
            title_part = f"chat_{i+1}"
        filename = f"{dt.strftime('%Y%m%d_%H%M%S')}_{title_part}.md"
        filepath = os.path.join(OUTPUT_DIR, filename)

        # 内容
        content = f"""---
type: {gtype}
uuid: {uuid}
timestamp: {dt_str}
unixMs: {gen.get('unixMs')}
source: cursor_aiService_generations
---

# {text[:100]}{'...' if len(text) > 100 else ''}

{text}

---

*由导出脚本生成 | {dt_str}*
"""

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"  [{i+1}/{len(generations)}] {dt_str} | {gtype} | {text[:50]}...")

    conn.close()
    print(f"\n✅ 导出完成！共 {len(generations)} 条记录 -> {OUTPUT_DIR}")

if __name__ == '__main__':
    export_chat_history()
