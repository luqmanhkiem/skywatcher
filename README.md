# SkyWatcher
**IoT-Enabled Smart Airport Baggage Tracking System with Real-Time Anomaly Detection**

Built for UTeM FTMK PSM — B032310853 Ahmad Luqmanul Hakiem bin Rusli

---

## Stack
| Layer | Technology |
|---|---|
| IoT Simulation | Python + paho-mqtt |
| Message Broker | Mosquitto (MQTT) |
| Backend API | Flask + Supabase (PostgreSQL) |
| Anomaly Detection | scikit-learn Isolation Forest |
| Frontend Dashboard | React + Vite + Recharts |

## Checkpoints
`check_in` → `security` → `sorting` → `loading` → `arrival`

---

## Prerequisites (one-time setup)

**1. Install Mosquitto:**
```bash
brew install mosquitto
```

**2. Python virtual environment:**
```bash
cd "/path/to/skywatcher"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**3. Node dependencies:**
```bash
cd skywatcher-dashboard
npm install
cd ..
```

**4. Environment variables — create a `.env` file in the project root:**
```env
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TOPIC=baggage/events
FLASK_PORT=5000
FLASK_DEBUG=true
ANOMALY_STALL_THRESHOLD_MINUTES=20
JWT_SECRET=skywatcher-secret-change-in-production
JWT_EXPIRY_HOURS=8

# Supabase — get these from supabase.com → your project → Project Settings → API
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_KEY=<your-anon-public-key>
```

> **Note:** If your project path contains a colon (e.g. `SEM 2 25:26`), `npm run dev` uses
> `./node_modules/.bin/vite` directly in `package.json` to work around a macOS PATH limitation.

---

## Running the project

You need **3 terminal tabs** (+ optional Tab 4 for the simulator).

### Tab 1 — Mosquitto MQTT broker
```bash
/opt/homebrew/sbin/mosquitto
```
Leave this running. If you see `port 1883` in the output, it's ready.

---

### Tab 2 — Flask backend
```bash
cd "/path/to/skywatcher"
source .venv/bin/activate
cd backend
python3 app.py
```

Expected output:
```
[AnomalyEngine] Isolation Forest trained on synthetic normal data.
[SkyWatcher] Connected to Supabase.
[SkyWatcher] Demo accounts seeded.
[SkyWatcher] MQTT client started.
[MQTT] Connected to broker at localhost:1883
[SkyWatcher] Flask running on http://localhost:5000
```

> If port 5000 is taken by AirPlay Receiver, disable it:
> **System Settings → General → AirDrop & Handoff → AirPlay Receiver → OFF**

---

### Tab 3 — React dashboard
```bash
cd "/path/to/skywatcher/skywatcher-dashboard"
npm run dev
```

Open **http://localhost:5173** in your browser.

**Demo accounts:**
| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `staff_checkin` | `staff123` | Ground Staff — Check-In |
| `staff_security` | `staff123` | Ground Staff — Security |
| `staff_sorting` | `staff123` | Ground Staff — Sorting |
| `staff_loading` | `staff123` | Ground Staff — Loading |
| `staff_arrival` | `staff123` | Ground Staff — Arrival |
| `passenger_test` | `pass123` | Passenger |

---

### Tab 4 — RFID simulator (optional)
```bash
cd "/path/to/skywatcher"
source .venv/bin/activate
cd simulator
python3 rfid_sim.py
```

10 bags start moving through checkpoints. The Live Map populates within seconds.

---

## Testing on mobile

To open the dashboard on your phone (must be on the same Wi-Fi):

1. Find your Mac's local IP:
```bash
ipconfig getifaddr en0
```

2. Start Vite with `--host`:
```bash
cd skywatcher-dashboard
./node_modules/.bin/vite --host
```

3. On your phone, open: `http://<your-mac-ip>:5173`

---

## Stopping everything

| Process | How to stop |
|---|---|
| Mosquitto | `Ctrl+C` in Tab 1 |
| Flask | `Ctrl+C` in Tab 2 |
| Vite | `Ctrl+C` in Tab 3 |
| Simulator | Exits automatically when all bags finish |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: No module named 'flask'` | Run `source .venv/bin/activate` first |
| `MQTT Failed to connect` | Start Mosquitto in Tab 1 first |
| `sh: vite: command not found` | Run `rm -rf node_modules && npm install` in `skywatcher-dashboard/` |
| `Address already in use` on port 5000 | Disable AirPlay Receiver in System Settings |
| Dashboard shows "Cannot reach Flask backend" | Make sure Tab 2 (Flask) is running |
| `urllib3 LibreSSL` warning on startup | Harmless on macOS — app runs fine |
| `TypeError: unsupported operand type(s) for \|` | You are on Python 3.9 — already patched in this repo |

---

## API Endpoints
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/bags | All bags + last checkpoint |
| GET | /api/bags/:tag_id/history | Full checkpoint history for a bag |
| GET | /api/alerts | Latest anomaly alerts |
| PATCH | /api/alerts/:id/resolve | Mark alert as resolved |
| GET | /api/stats | Throughput per checkpoint |
| GET | /api/flights | Flight summaries |
| POST | /api/auth/login | Login and get JWT token |
| GET | /api/users | List all users (admin only) |
| POST | /api/users | Create a user (admin only) |

## Anomaly Types
| Type | Trigger |
|---|---|
| `STALL` | Bag at a checkpoint longer than 20 minutes |
| `WRONG_ROUTE` | Checkpoint appeared out of expected sequence |
| `SECURITY_BYPASS` | Security step missing from bag history |
