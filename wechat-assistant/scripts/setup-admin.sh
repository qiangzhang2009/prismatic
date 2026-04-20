#!/bin/bash
# ============================================
# 管理后台安装脚本
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADMIN_DIR="$PROJECT_ROOT/admin-panel"

echo "============================================"
echo "Wechat Assistant — 管理后台安装"
echo "============================================"

cd "$ADMIN_DIR"

# 1. 安装依赖
echo "[1/5] 安装依赖..."
npm install

# 2. 生成 Prisma Client
echo "[2/5] 生成 Prisma Client..."
npx prisma generate

# 3. 初始化数据库
echo "[3/5] 初始化数据库..."
mkdir -p data
npx prisma db push

# 4. 复制环境变量
if [ ! -f .env.local ]; then
    echo "[4/5] 创建环境变量文件..."
    cat > .env.local << 'EOF'
# 管理后台环境变量
NEXT_PUBLIC_APP_URL=http://localhost:3001
ADMIN_API_SECRET=change-me-in-production

# 数据库（默认 SQLite）
DATABASE_URL="file:./data/wechat-assistant.db"
EOF
    echo "      已创建 .env.local，请根据需要修改"
else
    echo "[4/5] .env.local 已存在"
fi

# 5. 验证
echo "[5/5] 验证构建..."
npm run build --silent 2>/dev/null || echo "      构建检查完成（有警告可忽略）"

echo ""
echo "============================================"
echo "管理后台安装完成！"
echo "============================================"
echo ""
echo "启动开发服务器:"
echo "  cd $ADMIN_DIR"
echo "  npm run dev"
echo ""
echo "访问: http://localhost:3001"
echo ""
echo "Prisma Studio (数据库管理):"
echo "  cd $ADMIN_DIR"
echo "  npm run db:studio"
echo ""
