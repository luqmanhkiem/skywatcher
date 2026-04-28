#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SkyWatcher — Stop All Services
# ─────────────────────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")" && pwd)"
PIDS="$ROOT/.pids"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[SkyWatcher]${NC} $*"; }
warn() { echo -e "${YELLOW}[SkyWatcher]${NC} $*"; }

if [ ! -f "$PIDS" ]; then
  warn "No .pids file found — killing any processes on ports 5000 and 5173..."
  for PORT in 5000 5173; do
    PID=$(lsof -ti tcp:$PORT 2>/dev/null || true)
    [ -n "$PID" ] && kill -9 $PID 2>/dev/null && log "  Killed process on port $PORT (PID $PID)"
  done
  # Kill mosquitto by name
  pkill -f mosquitto 2>/dev/null && log "  Killed mosquitto" || true
  pkill -f rfid_sim  2>/dev/null && log "  Killed RFID simulator" || true
  exit 0
fi

# Read PIDs and kill each
source "$PIDS"

for VAR in MQTT_PID BACKEND_PID FRONTEND_PID SIM_PID; do
  PID="${!VAR}"
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null
    log "  Stopped $VAR (PID $PID)"
  fi
done

rm -f "$PIDS"
log "✅ All SkyWatcher services stopped."
