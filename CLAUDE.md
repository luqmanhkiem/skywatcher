# SkyWatcher — CLAUDE.md

This file gives Claude Code the context it needs to help build and maintain SkyWatcher.

## Project
IoT-enabled smart airport baggage tracking system with real-time anomaly detection.
**PSM (Final Year Project)** — UTeM FTMK, Session 2025/2026, Student B032310853.

## Stack
- **IoT Simulation**: `simulator/rfid_sim.py` — Python, paho-mqtt, publishes to MQTT
- **Message Broker**: Mosquitto on localhost:1883, topic `baggage/events`
- **Backend**: `backend/app.py` — Flask, REST API on port 5001 (`FLASK_PORT` in `.env`)
- **Storage**: Supabase (Postgres) — tables: `users`, `bags`, `events`, `anomalies`, `feedback`. Connected via `supabase-py`; config in `.env` (`SUPABASE_URL`, `SUPABASE_KEY`)
- **Auth**: JWT (HS256), 8 h expiry — `Authorization: Bearer <token>`. Secret in `.env` (`JWT_SECRET`). Decorator: `@token_required(...roles)` in `backend/auth.py`
- **ML**: `backend/models/anomaly.py` — scikit-learn Isolation Forest, trained at module import on per-checkpoint synthetic durations
- **Frontend**: `skywatcher-dashboard/` — React + Vite + Recharts, port 5173
- **Mobile**: `skywatcher-mobile/` — Flutter (iOS/Android) ground-ops client; reuses the same REST API. Ships only `lib/` + `pubspec.yaml` (run `flutter create .` to generate native folders). Login + live Alerts screen; base URL in `lib/api.dart` (`kBaseUrl`). See its README.

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
| POST | /api/admin/simulate | Inject one operator-supplied bag into the live MQTT stream (admin; scenario + speed) |
| POST | /api/feedback | Submit a passenger feedback/issue report (public, rate-limited) |
| GET | /api/feedback | List feedback tickets + status counts (staff/admin) |
| PATCH | /api/feedback/:id | Update ticket status / staff notes (staff/admin) |

## Roles & accounts
- **admin** — full dashboard incl. Inject Bag, Users, Analytics, Flights, Support.
- **ground_staff** — Live Map, Bags, Alerts, Support. **Uniform**: staff are no longer tied to a checkpoint; all staff see and resolve all alerts and all feedback.
- Seeded demo accounts: `admin`/`admin123`, `staff1`/`staff123`, `staff2`/`staff123`.

## Feedback workflow
Passengers submit via public `/feedback` (or "Report an issue" from the landing page / a tracked bag). Staff manage tickets in `/support` (FeedbackInbox): status flows **New → In Review → Resolved**, with internal notes and a `resolved_by` stamp. `feedback` table schema lives in `backend/sql/feedback.sql` (run once in the Supabase SQL editor).

## Email alerts
Critical anomalies (SECURITY_BYPASS) trigger an email via `backend/notifier.py` (SMTP, background thread). Recipients are pulled from the DB — every active admin/ground_staff account with an `email` set (managed on the Users page; `users.email` column added via `backend/sql/users_email.sql`). `ALERT_EMAIL_TO` in `.env` is an optional fallback used only when no account has an email. Configure `SMTP_HOST/PORT/USER/PASS` in `.env`; unset = logged no-op. Staff are Bcc'd so addresses stay private.

## QR bag tags
The bag detail modal (`BagHistoryModal`) renders a QR (via `qrcode.react`) encoding the public `/track` URL for that bag, with a Print button for a physical tag.

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
- `backend/models/database.py` — Supabase client + all DB helpers (incl. feedback CRUD)
- `backend/models/anomaly.py` — Isolation Forest + rule-based detectors (STALL / WRONG_ROUTE / SECURITY_BYPASS)
- `backend/auth.py` — JWT issue/verify + `@token_required` decorator
- `backend/routes/admin.py` — user management + `POST /admin/simulate` (Inject Bag, background `simulate_one_bag` thread)
- `backend/routes/feedback.py` — public submit + staff inbox blueprint
- `backend/notifier.py` — SMTP email on critical anomalies (no-op if unconfigured)
- `skywatcher-dashboard/src/pages/InjectBagView.jsx` — admin Inject Bag form
- `skywatcher-dashboard/src/pages/FeedbackPage.jsx` (public) / `FeedbackInbox.jsx` (staff `/support`)
- `skywatcher-dashboard/src/components/BagHistoryModal.jsx` — bag detail + QR bag tag
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
