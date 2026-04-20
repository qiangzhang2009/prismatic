#!/bin/bash
# ============================================
# Hermes Admin Panel — Local Runner
# ============================================
# Starts the admin panel locally, connected to
# your Hermes ~/.hermes/ data.
#
# Usage:
#   ./run-local.sh          # dev mode
#   ./run-local.sh prod     # production mode
#   ./run-local.sh stop     # stop servers
# ============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ADMIN_DIR="$SCRIPT_DIR"
HERMES_PATH="$HOME/.hermes"
DB_PATH="$HERMES_PATH/data/wechat-assistant.db"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[Hermes Admin]${NC} $1"; }
warn() { echo -e "${YELLOW}[Hermes Admin]${NC} $1"; }
err() { echo -e "${RED}[Hermes Admin]${NC} $1"; }

# Check Hermes is available
check_hermes() {
  if [ ! -d "$HERMES_PATH" ]; then
    err "Hermes not found at $HERMES_PATH"
    err "Please install Hermes Agent first: pip install hermes-agent"
    exit 1
  fi

  if [ ! -d "$HERMES_PATH/sessions" ]; then
    warn "No sessions directory found yet. Gateway may not have run."
  fi

  log "Hermes data: $HERMES_PATH"
  log "Database:     $DB_PATH"

  # Check gateway
  GATEWAY_STATE="$HERMES_PATH/gateway_state.json"
  if [ -f "$GATEWAY_STATE" ]; then
    STATE=$(cat "$GATEWAY_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('gateway_state','unknown'))" 2>/dev/null || echo "unknown")
    if [ "$STATE" = "running" ]; then
      PID=$(cat "$GATEWAY_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('pid','?'))" 2>/dev/null || echo "?")
      log "Gateway: running (PID $PID)"
    else
      warn "Gateway: $STATE"
      warn "Start with: hermes gateway run"
    fi
  else
    warn "Gateway state not found. Is Hermes running?"
    warn "Start with: hermes gateway run"
  fi
}

# Install dependencies
install_deps() {
  if [ ! -d "$ADMIN_DIR/node_modules" ]; then
    log "Installing dependencies..."
    cd "$ADMIN_DIR"
    npm install
    npx prisma generate
    log "Dependencies ready."
  fi
}

# Stop existing servers
stop() {
  log "Stopping admin panel servers..."
  pkill -f "next dev.*3001" 2>/dev/null || true
  pkill -f "next dev.*3002" 2>/dev/null || true
  pkill -f "next start.*3001" 2>/dev/null || true
  pkill -f "next start.*3002" 2>/dev/null || true
  lsof -i :3001 -ti | xargs kill 2>/dev/null || true
  lsof -i :3002 -ti | xargs kill 2>/dev/null || true
  log "Done."
}

# Start dev server
start_dev() {
  check_hermes
  install_deps
  cd "$ADMIN_DIR"
  log "Starting Hermes Admin Panel in dev mode..."
  log "  Local:  http://localhost:3001"
  log "  Hermes: $HERMES_PATH"
  echo ""
  npm run dev
}

# Start production server
start_prod() {
  check_hermes
  install_deps
  cd "$ADMIN_DIR"
  log "Building..."
  npm run build > /dev/null 2>&1
  log "Starting Hermes Admin Panel in production mode..."
  log "  Local:  http://localhost:3001"
  npm run start
}

# Main
case "${1:-}" in
  stop)
    stop
    ;;
  prod|production)
    start_prod
    ;;
  dev|*)
    start_dev
    ;;
esac
