"""
Generate BITP 3423 Lab Activity 1 report as a .docx file.
Run: python3 generate_report.py
"""
from docx import Document
from docx.shared import Pt, Inches, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import copy

doc = Document()

# ── Page margins ──────────────────────────────────────────────
for section in doc.sections:
    section.top_margin    = Cm(2.54)
    section.bottom_margin = Cm(2.54)
    section.left_margin   = Cm(3.18)
    section.right_margin  = Cm(2.54)

# ── Styles ────────────────────────────────────────────────────
style_normal = doc.styles['Normal']
style_normal.font.name = 'Times New Roman'
style_normal.font.size = Pt(12)

def set_heading_style(para, level, text, color=None):
    """Apply a numbered heading style."""
    para.style = doc.styles[f'Heading {level}']
    run = para.runs[0] if para.runs else para.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.bold = True
    run.font.size = Pt(14 if level == 1 else 13 if level == 2 else 12)
    if color:
        run.font.color.rgb = RGBColor(*color)
    para.paragraph_format.space_before = Pt(14)
    para.paragraph_format.space_after  = Pt(4)

def add_heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    for run in p.runs:
        run.font.name = 'Times New Roman'
        run.font.size = Pt(14 if level == 1 else 13 if level == 2 else 12)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x5f)
    p.paragraph_format.space_before = Pt(16 if level == 1 else 12)
    p.paragraph_format.space_after  = Pt(4)
    return p

def add_para(doc, text='', bold=False, italic=False, size=12, indent=0, space_after=6, align=None):
    p = doc.add_paragraph()
    p.paragraph_format.space_after  = Pt(space_after)
    p.paragraph_format.space_before = Pt(2)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    if align:
        p.alignment = align
    if text:
        run = p.add_run(text)
        run.font.name  = 'Times New Roman'
        run.font.size  = Pt(size)
        run.font.bold  = bold
        run.font.italic = italic
    return p

def add_bullet(doc, text, level=0):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.left_indent  = Cm(1.5 + level * 0.5)
    p.paragraph_format.space_after  = Pt(3)
    run = p.add_run(text)
    run.font.name = 'Times New Roman'
    run.font.size = Pt(12)
    return p

def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = 'Table Grid'
    # Header row
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr.cells[i]
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(h)
        run.font.name  = 'Times New Roman'
        run.font.size  = Pt(11)
        run.font.bold  = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        # Blue header background
        tc = cell._tc
        tcPr = tc.get_or_add_tcPr()
        shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto')
        shd.set(qn('w:fill'), '1E3A5F')
        tcPr.append(shd)
    # Data rows
    for ri, row_data in enumerate(rows):
        row = table.rows[ri + 1]
        for ci, val in enumerate(row_data):
            cell = row.cells[ci]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            p = cell.paragraphs[0]
            run = p.add_run(str(val))
            run.font.name = 'Times New Roman'
            run.font.size = Pt(11)
            # Alternate row shading
            if ri % 2 == 1:
                tc = cell._tc
                tcPr = tc.get_or_add_tcPr()
                shd = OxmlElement('w:shd')
                shd.set(qn('w:val'), 'clear')
                shd.set(qn('w:color'), 'auto')
                shd.set(qn('w:fill'), 'EBF0F7')
                tcPr.append(shd)
    # Column widths
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Cm(w)
    return table

def add_code_block(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent  = Cm(1)
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after  = Pt(4)
    run = p.add_run(text)
    run.font.name = 'Courier New'
    run.font.size = Pt(9)
    # Light grey background via paragraph shading
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F3F4F6')
    pPr.append(shd)
    return p

# ═══════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════
add_para(doc, 'UNIVERSITI TEKNIKAL MALAYSIA MELAKA', bold=True, size=14,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, 'FACULTY OF INFORMATION AND COMMUNICATION TECHNOLOGY', bold=True, size=12,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=24)

add_para(doc, 'BITP 3423', bold=True, size=16,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, 'SPECIAL TOPIC IN SOFTWARE ENGINEERING', bold=True, size=14,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=4)
add_para(doc, 'LAB ACTIVITY 1', bold=True, size=14,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=32)

add_para(doc, 'IT Architecture Design & Project Challenges Analysis', bold=True, italic=True, size=13,
         align=WD_ALIGN_PARAGRAPH.CENTER, space_after=40)

# Info table
info_table = doc.add_table(rows=5, cols=2)
info_table.style = 'Table Grid'
labels = ['Project Title', 'Student Name', 'Matric Number', 'Faculty', 'Session']
values = [
    'SkyWatcher — IoT-Enabled Smart Airport Baggage Tracking System',
    '(Your Full Name)',
    'B032310853',
    'FTMK — Faculty of Information and Communication Technology',
    '2025/2026',
]
for i, (lbl, val) in enumerate(zip(labels, values)):
    row = info_table.rows[i]
    for ci, txt in enumerate([lbl, val]):
        cell = row.cells[ci]
        p = cell.paragraphs[0]
        run = p.add_run(txt)
        run.font.name = 'Times New Roman'
        run.font.size = Pt(11)
        run.font.bold = (ci == 0)
        cell.width = Cm(5) if ci == 0 else Cm(10)
for row in info_table.rows:
    row.cells[0].width = Cm(5)
    row.cells[1].width = Cm(10)

doc.add_page_break()

# ═══════════════════════════════════════════════════════════════
# SECTION 1 — IT ARCHITECTURE DESIGN
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '1. IT Architecture Design', level=1)

add_heading(doc, '1.1 System Overview', level=2)
add_para(doc,
    'SkyWatcher is an IoT-enabled smart airport baggage tracking system that provides '
    'real-time visibility of baggage movement across five sequential checkpoints within '
    'an airport environment. The system leverages RFID (Radio Frequency Identification) '
    'technology to scan baggage tags at each processing stage and automatically detects '
    'anomalies in baggage flow using a machine learning model.')
add_para(doc,
    'The primary purpose of SkyWatcher is to reduce baggage mishandling incidents, '
    'improve operational transparency for ground staff, and enable passengers to monitor '
    'the live status of their luggage without requiring an account or login. Anomaly '
    'detection is fully automated, removing the need for manual inspection at every '
    'stage of the baggage handling pipeline.')
add_para(doc, 'The system enforces a strict five-stage checkpoint sequence:', space_after=4)
add_para(doc, 'Check-In  →  Security  →  Sorting  →  Loading  →  Arrival',
         bold=True, indent=1.5, space_after=8)
add_para(doc, 'Target Users:', bold=True, space_after=4)
add_table(doc,
    ['User Role', 'Access Level', 'Description'],
    [
        ['Administrator', 'Full system', 'Manages users, views all analytics and alerts, resolves anomalies across all checkpoints'],
        ['Ground Staff', 'Checkpoint-scoped', 'Views bags and alerts relevant to their assigned checkpoint only'],
        ['Passenger', 'Public self-service', 'Enters flight number and name at /track to see live bag status — no login required'],
    ],
    col_widths=[3.5, 4, 8]
)
doc.add_paragraph()

add_heading(doc, '1.2 Identification of Key Components', level=2)

add_heading(doc, '1.2a Frontend', level=3)
add_para(doc,
    'The frontend is a Single-Page Application (SPA) built with React 18 and bundled '
    'using Vite, running on port 5173. Data visualisation is provided by the Recharts '
    'library. Communication with the backend is handled exclusively via the Axios HTTP '
    'client. An Axios request interceptor automatically attaches a JWT Bearer token to '
    'every outgoing request, and a response interceptor handles 401 Unauthorized '
    'responses by redirecting to the login page.')
add_para(doc, 'The frontend provides the following views:')
bullets_fe = [
    'Live Map — Real-time overview of bag distribution across all five checkpoints',
    'Bag Table — Searchable table of all bags with current status and history modal',
    'Alert Panel — Anomaly alert feed with filter buttons and resolve functionality',
    'Analytics / Stats View — KPI cards, anomaly trend line chart, flight anomaly bar chart, checkpoint heatmap, average resolution time',
    'Flights View — Per-flight baggage summary',
    'Users View (Admin only) — Full user account management: create, edit, deactivate',
    'Public Passenger Tracker (/track) — No-login page where passengers enter flight number and name to view a live five-step progress stepper',
]
for b in bullets_fe:
    add_bullet(doc, b)
doc.add_paragraph()

add_heading(doc, '1.2b Backend', level=3)
add_para(doc,
    'The backend is a Flask (Python) REST API server running on port 5000. It is '
    'structured using Flask Blueprints to separate concerns across four route modules. '
    'A custom token_required(*roles) decorator validates the JWT on every protected '
    'route and enforces role-based access control, injecting the decoded user payload '
    'into Flask\'s g context object.')
add_table(doc,
    ['Blueprint', 'URL Prefix', 'Responsibility'],
    [
        ['baggage_bp', '/api', 'Bag ingestion, bag queries, public tracking, analytics stats'],
        ['alerts_bp', '/api', 'Anomaly alert retrieval and resolution with resolved_at timestamp'],
        ['auth_bp', '/api/auth', 'Login with JWT issuance, token validation (/me), logout'],
        ['admin_bp', '/api/admin', 'User account CRUD — create, edit, deactivate (admin only)'],
    ],
    col_widths=[3.5, 3.5, 9]
)
add_para(doc, '')
add_para(doc,
    'The backend also hosts the anomaly detection engine (models/anomaly.py) using a '
    'scikit-learn Isolation Forest model trained on 500 synthetic normal-behaviour samples. '
    'Three deterministic rule checks execute before the model score:')
rules = [
    'STALL — bag remains at a checkpoint longer than 20 minutes (configurable via .env)',
    'WRONG_ROUTE — bag skips forward more than one step in the checkpoint sequence',
    'SECURITY_BYPASS — bag reaches sorting/loading/arrival without a security scan on record',
    'Catch-all ANOMALY — Isolation Forest confidence score > 0.75 (skipped on first scan)',
]
for r in rules:
    add_bullet(doc, r)
add_para(doc,
    'An in-memory brute-force rate limiter on the login endpoint (5 failed attempts per '
    '60 seconds) returns HTTP 429 to prevent credential stuffing.')
doc.add_paragraph()

add_heading(doc, '1.2c Database', level=3)
add_para(doc,
    'The database is SQLite (skywatcher.db), stored in the backend/ directory. SQLite '
    'was selected for its zero-configuration deployment and suitability for a '
    'single-server FYP environment. The schema consists of four tables:')
add_table(doc,
    ['Table', 'Primary Key', 'Key Columns', 'Purpose'],
    [
        ['bags', 'tag_id (TEXT)', 'flight_id, passenger, status, last_checkpoint, last_seen', 'Current state of each bag — one row per RFID tag, upserted on every scan'],
        ['events', 'id (INTEGER)', 'tag_id, checkpoint, timestamp, duration_mins', 'Immutable scan log. UNIQUE(tag_id, checkpoint, timestamp) prevents duplicates'],
        ['anomalies', 'id (INTEGER)', 'tag_id, type, score, resolved, resolved_at', 'Detected anomalies with Isolation Forest confidence score and resolution timestamp'],
        ['users', 'id (INTEGER)', 'username, password_hash, role, checkpoint, active', 'Staff/admin accounts. Passwords hashed with pbkdf2:sha256. Soft-deletion via active flag'],
    ],
    col_widths=[2.5, 3.5, 5.5, 5]
)
add_para(doc, '')
add_para(doc,
    'Schema migrations for existing databases are handled via PRAGMA table_info() checks '
    'in init_db(), applying ALTER TABLE ADD COLUMN statements conditionally — no external '
    'migration framework is required.')
doc.add_paragraph()

add_heading(doc, '1.2d External Systems', level=3)
add_table(doc,
    ['External System', 'Technology', 'Role'],
    [
        ['Mosquitto MQTT Broker', 'Eclipse Mosquitto 2.x', 'Message bus on localhost:1883. Simulator publishes to topic baggage/events; mqtt_client.py subscribes and forwards to POST /api/events'],
        ['RFID Simulator', 'Python + paho-mqtt (rfid_sim.py)', 'Simulates RFID scanner reads at all five checkpoints. Generates realistic events with configurable anomaly injection. In production, replaced by physical readers'],
    ],
    col_widths=[4, 4.5, 8]
)
doc.add_paragraph()

add_heading(doc, '1.3 Relationships Between Components (Data Flow)', level=2)
add_para(doc,
    'SkyWatcher operates across two distinct data paths that work concurrently:')

add_para(doc, 'Path 1 — IoT Ingest Pipeline (Event-Driven / Asynchronous):', bold=True, space_after=4)
add_code_block(doc,
    'RFID Simulator\n'
    '    │  publishes JSON payload to MQTT topic: baggage/events\n'
    '    ▼\n'
    'Mosquitto MQTT Broker  (port 1883)\n'
    '    │  delivers message to subscriber\n'
    '    ▼\n'
    'mqtt_client.py  (Flask background thread)\n'
    '    │  HTTP POST /api/events  (internal call)\n'
    '    ▼\n'
    'baggage_bp  →  insert_event()  →  SQLite  (upsert bags, insert events)\n'
    '    │\n'
    '    └──►  detect_anomaly()  →  store_anomaly()  →  SQLite  (anomalies table)')

add_para(doc, 'Path 2 — User-Facing REST API (Request-Response / Synchronous):', bold=True, space_after=4)
add_code_block(doc,
    'React Dashboard  /  Public Passenger Tracker\n'
    '    │  HTTP GET/POST/PATCH  +  JWT Bearer token  (or no token for /track)\n'
    '    ▼\n'
    'Flask REST API  (port 5000)\n'
    '    │  token_required() validates JWT  →  sets g.user with role and scope\n'
    '    ▼\n'
    'Blueprint route handler  →  database.py helper  →  SQLite\n'
    '    │\n'
    '    └──►  JSON response  →  React updates UI state via usePolling hook')

add_para(doc,
    'The React frontend polls the backend on a fixed interval — 3,000 ms for live '
    'operational views (Live Map, Bags, Alerts) and 5,000–10,000 ms for analytics views '
    '— using the custom usePolling hook. This provides near-real-time responsiveness '
    'while avoiding WebSocket complexity.')
doc.add_paragraph()

add_heading(doc, '1.4 System Environment', level=2)
add_table(doc,
    ['Aspect', 'Detail'],
    [
        ['Platform', 'Web browser — Chrome, Firefox, Safari. No mobile-specific build required'],
        ['Hosting', 'All services run locally on a single machine (localhost); LAN-accessible via host IP'],
        ['Operating System', 'macOS (development); fully Linux-compatible for deployment'],
        ['Backend Runtime', 'Python 3.9, virtual environment (.venv), Flask dev server / Gunicorn (production)'],
        ['Frontend Runtime', 'Node.js 18+, Vite dev server (development) / static build served by Nginx (production)'],
        ['Message Broker', 'Mosquitto 2.x installed via Homebrew on macOS'],
        ['Production Path', 'Flask → Gunicorn + Nginx; SQLite → PostgreSQL; React → npm run build + Nginx static serve'],
    ],
    col_widths=[4.5, 12]
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════
# SECTION 2 — ARCHITECTURE TYPE
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '2. Architecture Type and Justification', level=1)

add_heading(doc, '2.1 Architecture Type', level=2)
add_para(doc,
    'SkyWatcher adopts a Client-Server Architecture with Event-Driven IoT Integration. '
    'These two complementary patterns operate at different layers of the system.')

add_para(doc, 'Client-Server Architecture (Three-Tier):', bold=True, space_after=4)
bullets_cs = [
    'Presentation Tier — React SPA running in the browser',
    'Logic Tier — Flask REST API (authentication, business logic, anomaly detection)',
    'Data Tier — SQLite relational database',
]
for b in bullets_cs:
    add_bullet(doc, b)

add_para(doc, 'Event-Driven Architecture (IoT Layer):', bold=True, space_after=4)
add_para(doc,
    'The IoT ingestion layer uses the MQTT publish-subscribe protocol. The simulator '
    '(publisher) and the Flask backend (subscriber) are fully decoupled through the '
    'Mosquitto broker. This means new data sources such as physical RFID scanners can '
    'be integrated simply by publishing to the same topic, without modifying the backend.')
doc.add_paragraph()

add_heading(doc, '2.2 Justification', level=2)
add_table(doc,
    ['Justification', 'Reasoning'],
    [
        ['Development simplicity', 'A monolithic Flask backend with Blueprint modularisation is faster to develop and debug than microservices — appropriate for a solo FYP with a single developer'],
        ['Separation of concerns', 'Frontend, backend, and database are independently maintainable; the frontend can be replaced without touching the API'],
        ['IoT protocol compatibility', 'MQTT is the industry-standard protocol for IoT sensor data — lightweight, low-bandwidth, and designed for unreliable or intermittent network conditions'],
        ['Role-based access control', 'Client-server architecture naturally supports centralised JWT authentication, enforcing per-role data scoping at the API layer without frontend trust'],
        ['Scalability path', 'The Blueprint structure allows individual route modules to be extracted into separate microservices in a future production version without rewriting business logic'],
        ['Stateless API', 'JWT-based stateless authentication allows the API to scale horizontally — multiple Flask workers can handle requests without shared session storage'],
    ],
    col_widths=[5, 11.5]
)
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════
# SECTION 3 — CHALLENGES
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '3. Project Challenges Analysis', level=1)

add_heading(doc, 'Challenge 1: Real-Time Data Synchronisation and Latency', level=2)
add_para(doc,
    'In an airport environment, baggage events occur rapidly and concurrently across '
    'five checkpoints. The system must reflect these changes in the dashboard within '
    'seconds to be operationally useful. However, SkyWatcher uses a polling mechanism '
    '(the usePolling hook) rather than a persistent WebSocket connection, introducing '
    'a fixed latency of up to 3 seconds between an event being written to the database '
    'and becoming visible in the UI.')
add_para(doc,
    'The complete IoT-to-screen pipeline — MQTT delivery → Flask processing → SQLite '
    'write → frontend poll cycle — can accumulate to 4–6 seconds end-to-end under '
    'normal conditions, and longer if the MQTT broker experiences message queuing.')
add_para(doc, 'Impact:', bold=True, space_after=4)
add_para(doc,
    'Ground staff may act on stale data. A bag that has already moved to the next '
    'checkpoint may still appear at the previous one for several seconds, potentially '
    'triggering unnecessary manual investigation.')
doc.add_paragraph()

add_heading(doc, 'Challenge 2: Anomaly Detection Accuracy with Synthetic Training Data', level=2)
add_para(doc,
    'The Isolation Forest model in anomaly.py is trained entirely on synthetically '
    'generated normal data (500 samples with uniformly distributed durations and '
    'sequential checkpoint indices). No real historical baggage handling data was '
    'available during development. This introduces the following risks:')
bullets_ch2 = [
    'The model\'s normal-behaviour boundary is based on assumptions rather than observed airport operations',
    'The catch-all anomaly threshold (confidence > 0.75) may still produce false positives for edge cases such as deliberate rescans or system testing',
    'Anomaly confidence scores may not correlate with actual operational severity, making alert prioritisation difficult for ground staff',
]
for b in bullets_ch2:
    add_bullet(doc, b)
add_para(doc, 'Impact:', bold=True, space_after=4)
add_para(doc,
    'False positive anomaly alerts reduce staff trust in the system. If too many '
    'irrelevant alerts appear, staff may begin ignoring them — defeating the purpose '
    'of automated detection and increasing the risk of real anomalies being missed.')
doc.add_paragraph()

add_heading(doc, 'Challenge 3: Multi-Role Access Control Complexity and Data Scoping', level=2)
add_para(doc,
    'SkyWatcher supports three fundamentally different user roles with distinct data '
    'visibility rules:')
bullets_ch3 = [
    'Admin — sees all bags, all alerts, all analytics globally',
    'Ground Staff — sees only bags and alerts at their assigned checkpoint',
    'Passenger — accesses only their own bag via a public endpoint with no authentication',
]
for b in bullets_ch3:
    add_bullet(doc, b)
add_para(doc,
    'Implementing this correctly requires data scoping logic at both the API layer '
    '(Flask route handlers filter results by g.user[\'checkpoint\']) and the frontend '
    '(navigation items and routes are role-gated via the ProtectedRoute component). '
    'Any inconsistency between these two enforcement points could expose data to '
    'unauthorised users.')
add_para(doc,
    'Additionally, the soft-deletion mechanism for user accounts (setting active = 0 '
    'rather than deleting the row) requires the verify_password() function to explicitly '
    'check the active flag. The system must also prevent an administrator from '
    'deactivating their own account or the last remaining admin account.')
add_para(doc, 'Impact:', bold=True, space_after=4)
add_para(doc,
    'A misconfigured role check at either the frontend or backend layer could allow '
    'ground staff to view or resolve alerts outside their assigned checkpoint, '
    'violating operational security and data segregation requirements.')
doc.add_paragraph()

# ═══════════════════════════════════════════════════════════════
# SECTION 4 — AGILITY SOLUTIONS
# ═══════════════════════════════════════════════════════════════
add_heading(doc, '4. Agility-Based Solutions', level=1)

add_heading(doc, 'Solution 1 — Awareness: Real-Time Monitoring Dashboard and Offline Indicators', level=2)
add_para(doc, 'Challenge Addressed: Challenge 1 (Real-time data synchronisation)', italic=True)
add_para(doc,
    'Agility Principle — Awareness: Maintaining a clear, accurate, and current picture '
    'of system state so that all stakeholders can act on correct information at all times.')
add_para(doc,
    'SkyWatcher addresses this challenge through a layered awareness strategy:')
bullets_s1 = [
    'Polling interval calibration — Operational views poll at 3,000 ms and analytics at 5,000–10,000 ms, balancing responsiveness with backend load',
    'Backend offline detection — When the backend is unreachable, a red banner "⚠ Cannot reach backend — showing last known data" is immediately displayed in the Alert Panel and Bag Table, preventing staff from acting on stale information',
    'Toast notification system — The ToastContext and ToastContainer components fire a pop-up alert within 3 seconds when a new anomaly is detected, regardless of which page the user is currently viewing, ensuring critical events are never missed',
    'Sidebar connection indicator — A Radio icon in the sidebar turns red when the backend is offline, providing a persistent system health signal',
]
for b in bullets_s1:
    add_bullet(doc, b)
add_para(doc,
    'Benefit: Staff maintain continuous situational awareness of both the system\'s '
    'health and the baggage pipeline status, reducing delayed responses to anomalies '
    'and eliminating the risk of acting on outdated data.')
doc.add_paragraph()

add_heading(doc, 'Solution 2 — Flexibility: Modular Blueprint Architecture and Role-Adaptive UI', level=2)
add_para(doc, 'Challenge Addressed: Challenge 3 (Multi-role access control complexity)', italic=True)
add_para(doc,
    'Agility Principle — Flexibility: Designing the system so that individual components '
    'can be extended, modified, or replaced independently without requiring changes '
    'across the entire codebase.')
add_para(doc,
    'The Flask backend uses Blueprints as isolated route modules. The token_required(*roles) '
    'decorator is the single enforcement point for all role-based access control. Adding '
    'a new role requires only two changes: adding the role to the CHECK constraint in the '
    'users table DDL and passing the new role string to the relevant @token_required() '
    'decorators.')
add_para(doc,
    'On the frontend, the ProtectedRoute component and the NAV_ADMIN / NAV_STAFF '
    'navigation arrays provide a single configuration point for role-based routing. '
    'The public passenger tracker at /track demonstrates further flexibility — it '
    'requires no authentication layer, serving a completely different user group through '
    'the same backend with a dedicated unauthenticated endpoint (GET /api/track).')
add_para(doc,
    'Benefit: New roles, features, or access rules can be introduced without '
    'restructuring the authentication system or frontend routing logic, supporting '
    'incremental feature delivery aligned with agile development principles.')
doc.add_paragraph()

add_heading(doc, 'Solution 3 — Productivity: Automated Layered Anomaly Detection', level=2)
add_para(doc, 'Challenge Addressed: Challenge 2 (Anomaly detection accuracy)', italic=True)
add_para(doc,
    'Agility Principle — Productivity: Automating repetitive or error-prone processes '
    'so that human effort is focused where it adds the most value, reducing wasted '
    'effort and improving throughput.')
add_para(doc,
    'Rather than relying entirely on the Isolation Forest model (trained on synthetic '
    'data), SkyWatcher implements a layered detection strategy with deterministic rule '
    'checks evaluated before the model score:')
add_table(doc,
    ['Layer', 'Type', 'Condition', 'Precision'],
    [
        ['1. STALL', 'Deterministic', 'duration_mins >= 20 (configurable via .env)', '100%'],
        ['2. WRONG_ROUTE', 'Deterministic', 'Forward checkpoint skip > 1 step', '100%'],
        ['3. SECURITY_BYPASS', 'Deterministic', 'Sorting/loading/arrival without security in history', '100%'],
        ['4. Catch-all ANOMALY', 'ML Model', 'Isolation Forest confidence > 0.75, only when history > 1 event', 'High (tuned threshold)'],
    ],
    col_widths=[4, 3.5, 7, 2]
)
add_para(doc, '')
add_para(doc,
    'The deterministic rules handle the majority of real-world anomaly types with '
    'perfect precision. The model score acts only as a safety net for subtle patterns. '
    'The resolved_at timestamp feature enables measurement of average resolution time '
    '(displayed as a KPI card in the Analytics view), creating a data-driven feedback '
    'loop for administrators to evaluate and improve operational procedures over time.')
add_para(doc,
    'Benefit: Ground staff only receive alerts for genuinely suspicious events. '
    'Measurable resolution time KPIs allow continuous productivity improvement '
    'of the baggage handling workflow through objective performance data.')
doc.add_paragraph()

add_heading(doc, 'Solution 4 — Adaptability: Schema Migration Guards and Environment-Driven Configuration', level=2)
add_para(doc, 'Challenge Addressed: All challenges (general system evolution)', italic=True)
add_para(doc,
    'Agility Principle — Adaptability: Ensuring the system can evolve incrementally '
    'in response to new requirements without breaking existing deployments or '
    'requiring full redeployment.')
add_para(doc,
    'SkyWatcher was designed to evolve without a formal database migration framework. '
    'The init_db() function uses PRAGMA table_info() to detect missing columns and '
    'applies ALTER TABLE ADD COLUMN statements conditionally. A CREATE UNIQUE INDEX IF '
    'NOT EXISTS statement safely adds the duplicate-event prevention index to existing '
    'databases without failure.')
add_para(doc,
    'All configurable operational parameters are externalised into a .env file:')
add_code_block(doc,
    'DB_PATH=skywatcher.db\n'
    'JWT_SECRET=skywatcher-secret-change-in-production\n'
    'JWT_EXPIRY_HOURS=8\n'
    'ANOMALY_STALL_THRESHOLD_MINUTES=20\n'
    'FLASK_PORT=5000')
add_para(doc,
    'Anomaly sensitivity, token expiry, and database path can all be adjusted for '
    'different deployment environments — development, testing, production — without '
    'modifying source code. The MQTT topic and broker address are similarly '
    'configurable, allowing the system to connect to real airport RFID infrastructure '
    'by changing a single environment variable.')
add_para(doc,
    'Benefit: The system can be incrementally enhanced — adding database columns, '
    'adjusting anomaly thresholds, or deploying to a new environment — with minimal '
    'risk of disrupting the running system. This directly reflects the agile principle '
    'of continuous delivery and evolutionary design.')
doc.add_paragraph()

# ── Footer note ───────────────────────────────────────────────
add_para(doc, '─' * 80, size=10)
add_para(doc,
    'Report prepared for BITP 3423 — Special Topic in Software Engineering  |  '
    'UTeM FTMK  |  Session 2025/2026  |  Student ID: B032310853',
    size=10, italic=True, align=WD_ALIGN_PARAGRAPH.CENTER)

# ── Save ──────────────────────────────────────────────────────
output_path = '/Users/luqmanulhakiem/Documents/UTEM/SEM 2 25:26/FYP/skywatcher/BITP3423_Lab1_SkyWatcher_B032310853.docx'
doc.save(output_path)
print(f'Saved: {output_path}')
