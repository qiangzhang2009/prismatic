#!/bin/bash
# ============================================
# 同步 Hermes 微信凭证到 Fly.io
# 在本地运行此脚本，将微信凭证上传到 Fly.io
# ============================================

set -e

FLY_APP="prismatic-wechat"

echo "========================================"
echo "Hermes WeChat 凭证同步工具"
echo "========================================"

# 检查本地微信凭证是否存在
if [ ! -d ~/.hermes/weixin/accounts ]; then
    echo "❌ 错误: 本地没有微信凭证"
    echo "   请先运行 'hermes gateway setup' 完成扫码"
    exit 1
fi

echo "✅ 找到本地微信凭证"

# 检查 Fly.io CLI
if ! command -v fly &> /dev/null; then
    echo "❌ 错误: fly CLI 未安装"
    echo "   请运行: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# 创建临时 tar 包
TEMP_DIR=$(mktemp -d)
TAR_FILE="$TEMP_DIR/hermes-weixin-backup.tar.gz"

echo "📦 打包微信凭证..."
tar -czf "$TAR_FILE" \
    -C ~ .hermes/weixin \
    -C ~ .hermes/auth.lock \
    2>/dev/null || true

# 列出要上传的文件
echo ""
echo "📋 将上传以下文件:"
tar -tzf "$TAR_FILE"

echo ""
echo "🚀 上传到 Fly.io..."
fly ssh issue --agent \
    --app "$FLY_APP" \
    --command "mkdir -p /opt/data && tar -xzf /dev/stdin -C /opt/data" \
    < "$TAR_FILE"

echo ""
echo "✅ 凭证同步完成!"
echo ""
echo "接下来运行: fly deploy"
echo "然后 SSH 进入: fly ssh console --app $FLY_APP"

# 清理
rm -rf "$TEMP_DIR"
