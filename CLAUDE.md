# SkyWatcher — CLAUDE.md

This file gives Claude Code the context it needs to help build and maintain SkyWatcher.

## Project
IoT-enabled smart airport baggage tracking system with real-time anomaly detection.
**PSM (Final Year Project)** — UTeM FTMK, Session 2025/2026, Student B032310853.

## Stack
- **IoT Simulation**: `simulator/rfid_sim.py` — Python, paho-mqtt, publishes to MQTT
- **Message Broker**: Mosquitto on localhost:1883, topic `baggage/events`
- **Backend**: `backend/app.py` — Flask, REST API on port 5000
- **Storage**: Supabase (Postgres) — tables: `users`, `bags`, `events`, `anomalies`. Connected via `supabase-py`; config in `.env` (`SUPABASE_URL`, `SUPABASE_KEY`)
- **Auth**: JWT (HS256), 8 h expiry — `Authorization: Bearer <token>`. Secret in `.env` (`JWT_SECRET`). Decorator: `@token_required(...roles)` in `backend/auth.py`
- **ML**: `backend/models/anomaly.py` — scikit-learn Isolation Forest, trained at module import on per-checkpoint synthetic durations
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
- `backend/models/database.py` — Supabase client + all DB helpers
- `backend/models/anomaly.py` — Isolation Forest + rule-based detectors (STALL / WRONG_ROUTE / SECURITY_BYPASS)
- `backend/auth.py` — JWT issue/verify + `@token_required` decorator
- `skywatcher-dashboard/src/context/AuthContext.jsx` — token storage in `localStorage` (key `sw_token`), `/auth/me` re-hydrate on mount
- `skywatcher-dashboard/src/utils/api.js` — axios instance, attaches `Bearer` token, redirects to `/login` on 401
- `skywatcher-dashboard/src/hooks/usePolling.js` — 3s polling hook
- `simulator/demo.sh` — one-bag demo recipes (normal / stall / bypass / wrong-route / mixed) wrapping `rfid_sim.py` flags

## Simulator flags
`python rfid_sim.py [flags]` — defaults to 10 bags, parallel, randomized anomalies.
- `--bags N` — bag count
- `--sequential` — process bags one at a time
- `--scenario {normal,stall,wrong-route,bypass}` — force every bag's outcome
- `--passenger NAME` / `--flight ID` — pin identifying values
- `--speed X` — scale inter-checkpoint delay (0.3 = fast demo)

## Coding conventions
- Python: PEP 8, type hints where useful, dotenv for all config
- React: functional components, hooks only, no class components
- All colours via CSS variables defined in `index.css`
- Poll interval: 3000ms for live views, 5000ms for analytics
