#!/bin/bash
# ============================================
# Hermes 安装脚本
# 自动配置 wechat-assistant 所需的环境
# ============================================

set -e

echo "============================================"
echo "Wechat Assistant — Hermes 安装向导"
echo "============================================"

# 1. 检查 Hermes 是否已安装
if command -v hermes &> /dev/null; then
    HERMES_VERSION=$(hermes --version 2>/dev/null || echo "unknown")
    echo "[1/6] Hermes 已安装 (version: $HERMES_VERSION)"
else
    echo "[1/6] 安装 Hermes Agent..."
    npm install -g hermes-agent
    echo "[1/6] Hermes 安装完成"
fi

# 2. 创建数据目录
DATA_DIR="${HOME}/.hermes/data"
mkdir -p "$DATA_DIR"
echo "[2/6] 数据目录: $DATA_DIR"

# 3. 创建插件目录
PLUGIN_DIR="${HOME}/.hermes/plugins"
mkdir -p "$PLUGIN_DIR"
echo "[3/6] 插件目录: $PLUGIN_DIR"

# 4. 检查环境变量文件
if [ ! -f "${HOME}/.hermes/wechat-assistant/.env" ]; then
    mkdir -p "${HOME}/.hermes/wechat-assistant"
    cp "$(dirname "$0")/../hermes-config/.env.example" \
       "${HOME}/.hermes/wechat-assistant/.env"
    echo "[4/6] 已创建环境变量模板: ${HOME}/.hermes/wechat-assistant/.env"
    echo "      请编辑该文件填入你的凭证"
else
    echo "[4/6] 环境变量文件已存在"
fi

# 5. 创建符号链接（Hermes 配置）
CONFIG_DIR="$(dirname "$0")/../hermes-config"
if [ ! -L "${HOME}/.hermes/assistant-config" ]; then
    ln -sf "$CONFIG_DIR" "${HOME}/.hermes/assistant-config"
    echo "[5/6] 配置软链接已创建"
else
    echo "[5/6] 配置软链接已存在"
fi

# 6. 验证安装
echo "[6/6] 验证 Hermes..."
if hermes --help &> /dev/null; then
    echo "      Hermes 安装验证成功"
else
    echo "      警告: Hermes 验证失败，请手动检查"
fi

echo ""
echo "============================================"
echo "安装完成！"
echo "============================================"
echo ""
echo "下一步："
echo "1. 编辑 ${HOME}/.hermes/wechat-assistant/.env"
echo "   填入你的微信/企业微信凭证"
echo ""
echo "2. 连接微信:"
echo "   hermes gateway setup"
echo "   选择 Weixin，然后扫码"
echo ""
echo "3. 启动助手:"
echo "   hermes start"
echo ""
echo "4. 访问管理后台:"
echo "   cd admin-panel && npm run dev"
echo "   访问 http://localhost:3001"
echo ""
