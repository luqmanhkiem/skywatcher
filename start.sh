#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# SkyWatcher — Start All Services
# Usage:
#   ./start.sh          start MQTT + Backend + Frontend
#   ./start.sh sim      start MQTT + Backend + Frontend + RFID Simulator
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Ensure Homebrew (and node) is on PATH in non-interactive shells
eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || true

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/.logs"
PIDS="$ROOT/.pids"

mkdir -p "$LOGS"

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${GREEN}[SkyWatcher]${NC} $*"; }
warn() { echo -e "${YELLOW}[SkyWatcher]${NC} $*"; }
err()  { echo -e "${RED}[SkyWatcher]${NC} $*"; }

# ── Check if already running ──────────────────────────────────────────────────
if [ -f "$PIDS" ]; then
  warn "SkyWatcher may already be running. Run ./stop.sh first, or delete .pids."
  exit 1
fi

# ── Kill leftover processes on used ports ─────────────────────────────────────
for PORT in 5001 5173; do
  PID_ON_PORT=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "$PID_ON_PORT" ]; then
    warn "Port $PORT in use (PID $PID_ON_PORT) — killing..."
    kill -9 $PID_ON_PORT 2>/dev/null || true
    sleep 0.5
  fi
done

# ── 1. Mosquitto MQTT Broker ─────────────────────────────────────────────────
log "Starting Mosquitto MQTT broker..."
/opt/homebrew/sbin/mosquitto > "$LOGS/mosquitto.log" 2>&1 &
MQTT_PID=$!
sleep 1
if ! kill -0 $MQTT_PID 2>/dev/null; then
  err "Mosquitto failed to start. Check $LOGS/mosquitto.log"
  exit 1
fi
log "  MQTT broker running  (PID $MQTT_PID)"

# ── 2. Flask Backend ──────────────────────────────────────────────────────────
log "Starting Flask backend..."
(
  cd "$ROOT/backend"
  "$ROOT/.venv/bin/python3" app.py
) > "$LOGS/backend.log" 2>&1 &
BACKEND_PID=$!
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  err "Flask failed to start. Check $LOGS/backend.log"
  kill $MQTT_PID 2>/dev/null || true
  exit 1
fi
log "  Flask API running    (PID $BACKEND_PID)  →  http://localhost:5001"

# ── 3. React Frontend ─────────────────────────────────────────────────────────
log "Starting React frontend..."
(
  cd "$ROOT/skywatcher-dashboard"
  ./node_modules/.bin/vite
) > "$LOGS/frontend.log" 2>&1 &
FRONTEND_PID=$!
sleep 2
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  err "Vite failed to start. Check $LOGS/frontend.log"
  kill $MQTT_PID $BACKEND_PID 2>/dev/null || true
  exit 1
fi
log "  React app running    (PID $FRONTEND_PID)  →  http://localhost:5173"

# ── 4. RFID Simulator (optional) ─────────────────────────────────────────────
SIM_PID=""
if [ "$1" = "sim" ]; then
  log "Starting RFID simulator..."
  (
    cd "$ROOT/simulator"
    "$ROOT/.venv/bin/python3" rfid_sim.py
  ) > "$LOGS/simulator.log" 2>&1 &
  SIM_PID=$!
  sleep 1
  if ! kill -0 $SIM_PID 2>/dev/null; then
    warn "Simulator failed to start. Check $LOGS/simulator.log"
    SIM_PID=""
  else
    log "  RFID simulator running (PID $SIM_PID)"
  fi
fi

# ── Write PIDs ────────────────────────────────────────────────────────────────
echo "MQTT_PID=$MQTT_PID"       > "$PIDS"
echo "BACKEND_PID=$BACKEND_PID" >> "$PIDS"
echo "FRONTEND_PID=$FRONTEND_PID" >> "$PIDS"
[ -n "$SIM_PID" ] && echo "SIM_PID=$SIM_PID" >> "$PIDS"

# ── Open browser ──────────────────────────────────────────────────────────────
log ""
log "✅ All services started. Opening dashboard..."
sleep 1
open "http://localhost:5173"

log ""
log "Logs:  $LOGS/"
log "Stop:  ./stop.sh"
