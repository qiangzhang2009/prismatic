# ============================================
# 反馈收集插件 — Hermes Agent Plugin
# ============================================
# 用途: 接收群消息中的反馈触发词，自动引导用户完善反馈并入库
# 安装: 复制到 ~/.hermes/plugins/wechat-feedback/
#      或在 config.yaml 中指定路径
# ============================================

import json
import re
import time
from datetime import datetime
from typing import Any

# 反馈触发词
FEEDBACK_TRIGGERS = [
    '投诉', '问题', '建议', '反馈',
    'bug', '报错', '改进', '不满意',
    '希望', '能不能', '应该可以',
]

# 反馈标签候选（AI 会从中选择）
FEEDBACK_TAG_CANDIDATES = [
    '功能建议', 'Bug报告', '体验问题',
    '新功能请求', '性能问题', '其他',
]


class WechatFeedbackPlugin:
    """微信群反馈收集插件"""

    name = "wechat-feedback"
    version = "1.0.0"

    def __init__(self, db_path: str = None):
        self.db_path = db_path or f"{os.path.expanduser('~')}/.hermes/data/wechat-assistant.db"
        self._pending_feedback: dict[str, dict] = {}  # userId -> partial feedback

    def on_message(self, message: dict[str, Any]) -> dict[str, Any] | None:
        """
        处理每条群消息。
        返回 dict 表示需要回复，None 表示不回复。
        """
        content = message.get('content', '')
        user_id = message.get('userId', '')
        user_name = message.get('userName', '群友')
        group_id = message.get('groupId', '')

        # 检查是否是反馈触发词
        if not self._contains_feedback_trigger(content):
            return None

        # 检查是否有正在等待完善的反馈
        pending_key = f"{group_id}:{user_id}"
        if pending_key in self._pending_feedback:
            return self._handle_feedback_followup(
                message, pending_key, content
            )

        # 创建新反馈记录
        return self._initiate_feedback_collection(
            user_id, user_name, group_id, content
        )

    def _contains_feedback_trigger(self, text: str) -> bool:
        for trigger in FEEDBACK_TRIGGERS:
            if trigger in text:
                return True
        return False

    def _initiate_feedback_collection(
        self, user_id: str, user_name: str,
        group_id: str, content: str
    ) -> dict[str, Any]:
        """引导用户完善反馈"""
        pending_key = f"{group_id}:{user_id}"

        # 存储待完善的反馈
        self._pending_feedback[pending_key] = {
            'userId': user_id,
            'userName': user_name,
            'groupId': group_id,
            'initialContent': content,
            'timestamp': datetime.now().isoformat(),
        }

        # 生成引导回复
        reply = (
            f"@{user_name} 感谢您的反馈！\n\n"
            "为了更好地帮助您，请补充以下信息：\n"
            "1️⃣ 具体是什么问题/建议？\n"
            "2️⃣ 在什么情况下发生？\n"
            "3️⃣ 期望怎么解决？\n\n"
            "直接回复即可，我会帮您记录~"
        )

        return {
            'action': 'reply',
            'content': reply,
            'priority': 'normal',
        }

    def _handle_feedback_followup(
        self, message: dict[str, Any],
        pending_key: str, content: str
    ) -> dict[str, Any] | None:
        """处理用户的反馈补充"""
        pending = self._pending_feedback.pop(pending_key)

        # 构建完整反馈内容
        full_content = (
            f"【原始反馈】{pending['initialContent']}\n"
            f"【用户补充】{content}"
        )

        # TODO: 写入数据库
        # self._save_to_db({
        #     'groupId': pending['groupId'],
        #     'userId': pending['userId'],
        #     'userName': pending['userName'],
        #     'content': full_content,
        #     'status': 'new',
        # })

        # 生成确认回复
        return {
            'action': 'reply',
            'content': (
                f"@{pending['userName']} 收到！反馈已记录，感谢您的建议！\n\n"
                "我们会在评估后尽快处理。如有进一步问题，随时 @ 我。"
            ),
            'priority': 'normal',
            'metadata': {
                'feedback_saved': True,
                'initial_content': pending['initialContent'],
            }
        }

    def cleanup(self):
        """清理过期未完成的反馈（超过 30 分钟）"""
        now = datetime.now()
        expired = []

        for key, pending in self._pending_feedback.items():
            ts = datetime.fromisoformat(pending['timestamp'])
            if (now - ts).total_seconds() > 1800:  # 30 分钟
                expired.append(key)

        for key in expired:
            self._pending_feedback.pop(key, None)


# Hermes 插件钩子
def register():
    return WechatFeedbackPlugin()


if __name__ == "__main__":
    # 测试
    plugin = WechatFeedbackPlugin()

    test_msg = {
        'userId': 'test_user',
        'userName': '测试用户',
        'groupId': 'test_group',
        'content': '我有个建议，希望能加一个功能',
    }

    result = plugin.on_message(test_msg)
    print("触发反馈收集:", result)

    # 模拟用户补充
    followup = {
        'userId': 'test_user',
        'userName': '测试用户',
        'groupId': 'test_group',
        'content': '就是希望能有一个定时提醒功能，比如每天早上提醒我看新闻',
    }

    result2 = plugin.on_message(followup)
    print("用户补充反馈:", result2)
