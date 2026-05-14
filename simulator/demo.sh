#!/usr/bin/env bash
# SkyWatcher demo recipes — run one bag at a time with a predictable scenario.
# Usage:  ./demo.sh <recipe>
#   normal       1 bag, no anomaly
#   stall        1 bag, will stall at one checkpoint
#   bypass       1 bag, skips security
#   wrong-route  1 bag, skips sorting
#   mixed        3 bags sequentially: normal, stall, bypass
#   help         show this list

set -e

cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
SPEED="${SPEED:-0.3}"           # default fast demo; override with SPEED=1.0 ./demo.sh ...
PASSENGER="${PASSENGER:-Demo Passenger}"
FLIGHT="${FLIGHT:-MH001}"

run() {
  echo "[demo] $*"
  "$PY" rfid_sim.py "$@"
}

case "${1:-help}" in
  normal)
    run --bags 1 --sequential --scenario normal \
        --passenger "$PASSENGER" --flight "$FLIGHT" --speed "$SPEED"
    ;;
  stall)
    run --bags 1 --sequential --scenario stall \
        --passenger "$PASSENGER" --flight "$FLIGHT" --speed "$SPEED"
    ;;
  bypass)
    run --bags 1 --sequential --scenario bypass \
        --passenger "$PASSENGER" --flight "$FLIGHT" --speed "$SPEED"
    ;;
  wrong-route)
    run --bags 1 --sequential --scenario wrong-route \
        --passenger "$PASSENGER" --flight "$FLIGHT" --speed "$SPEED"
    ;;
  mixed)
    run --bags 1 --sequential --scenario normal --speed "$SPEED"
    run --bags 1 --sequential --scenario stall  --speed "$SPEED"
    run --bags 1 --sequential --scenario bypass --speed "$SPEED"
    ;;
  help|*)
    sed -n '2,9p' "$0"
    ;;
esac
