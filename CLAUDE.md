# SkyWatcher — CLAUDE.md

This file gives Claude Code the context it needs to help build and maintain SkyWatcher.

## Project
IoT-enabled smart airport baggage tracking system with real-time anomaly detection.
**PSM (Final Year Project)** — UTeM FTMK, Session 2025/2026, Student B032310853.

## Stack
- **IoT Simulation**: `simulator/rfid_sim.py` — Python, paho-mqtt, publishes to MQTT
- **Message Broker**: Mosquitto on localhost:1883, topic `baggage/events`
- **Backend**: `backend/app.py` — Flask + SQLite, REST API on port 5000
- **ML**: `backend/models/anomaly.py` — scikit-learn Isolation Forest
- **Frontend**: `skywatcher-dashboard/` — React + Vite + Recharts, port 5173

## Checkpoint flow (in strict order)
check_in → security → sorting → loading → arrival

## Anomaly types
| Type | Trigger |
|---|---|
| STALL | bag at checkpoint > 20 minutes |
| WRONG_ROUTE | checkpoint out of expected sequence |
| SECURITY_BYPASS | bag reaches sorting/loading/arrival without security in history |

## API endpoints
| Method | Path | Returns |
|---|---|---|
| GET | /api/bags | All bags + last checkpoint |
| GET | /api/bags/:tag_id/history | Full checkpoint history |
| GET | /api/alerts | Anomaly alerts |
| PATCH | /api/alerts/:id/resolve | Mark alert resolved |
| GET | /api/stats | Event count per checkpoint |
| GET | /api/flights | Per-flight bag summaries |

## MQTT payload schema
```json
{
  "tag_id": "TAG-1001",
  "flight_id": "MH370",
  "passenger": "Ahmad Luqmanul",
  "checkpoint": "security",
  "duration_mins": 4.5,
  "timestamp": "2026-04-10T10:30:00"
}
```

## Key files
- `backend/models/database.py` — SQLite schema, all DB helpers
- `backend/models/anomaly.py` — Isolation Forest logic
- `skywatcher-dashboard/src/utils/api.js` — all axios calls
- `skywatcher-dashboard/src/hooks/usePolling.js` — 3s polling hook

## Coding conventions
- Python: PEP 8, type hints where useful, dotenv for all config
- React: functional components, hooks only, no class components
- All colours via CSS variables defined in `index.css`
- Poll interval: 3000ms for live views, 5000ms for analytics
