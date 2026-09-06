"""
Generate a formatted 'TEST CASE FYP' PDF for SkyWatcher.

Mirrors the module/table layout used in the sample document:
    Module heading -> table (Test Case ID | Description | Pre-conditions |
                             Test Steps | Expected Result | Pass / Fail)

The Time Requirement module (real-time performance) adds Threshold and
Measured Result columns, since those are the numbers the supervisor asked for.

Run:  python backend/tests/generate_test_case_pdf.py
Out:  backend/tests/SkyWatcher_Test_Cases.pdf
"""
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, KeepTogether,
)

OUT = os.path.join(os.path.dirname(__file__), 'SkyWatcher_Test_Cases.pdf')

styles = getSampleStyleSheet()
TITLE = ParagraphStyle('T', parent=styles['Title'], fontName='Helvetica-Bold',
                       fontSize=16, spaceAfter=4)
SUB = ParagraphStyle('S', parent=styles['Normal'], fontSize=9,
                     textColor=colors.HexColor('#555555'), spaceAfter=10)
MOD = ParagraphStyle('M', parent=styles['Heading2'], fontName='Helvetica-Bold',
                     fontSize=11.5, spaceBefore=14, spaceAfter=6)
CELL = ParagraphStyle('C', parent=styles['Normal'], fontName='Helvetica',
                      fontSize=8.2, leading=10.5)
CELL_B = ParagraphStyle('CB', parent=CELL, fontName='Helvetica-Bold')
HEAD = ParagraphStyle('H', parent=CELL, fontName='Helvetica-Bold', fontSize=8.4)
NOTE = ParagraphStyle('N', parent=styles['Normal'], fontSize=8.5,
                      textColor=colors.HexColor('#333333'), spaceBefore=4,
                      leading=11)


def P(t, s=CELL):
    return Paragraph(t, s)


def steps(items):
    return P('<br/>'.join(f'{i+1}. {t}' for i, t in enumerate(items)))


HEADER_BG = colors.HexColor('#F2EDE4')   # cream, matches project aesthetic
GRID = colors.HexColor('#888888')

BASE_STYLE = [
    ('GRID', (0, 0), (-1, -1), 0.6, GRID),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_BG),
    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5),
]


def std_table(rows):
    """Standard 6-column functional test-case table."""
    head = [P('Test Case ID', HEAD), P('Description', HEAD),
            P('Pre-conditions', HEAD), P('Test Steps', HEAD),
            P('Expected Result', HEAD), P('Pass / Fail', HEAD)]
    data = [head] + rows
    col_w = [24*mm, 30*mm, 28*mm, 44*mm, 42*mm, 15*mm]
    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle(BASE_STYLE))
    return t


def timing_table(rows):
    """Time-requirement table with Threshold + Measured columns."""
    head = [P('Test Case ID', HEAD), P('Description', HEAD),
            P('Method', HEAD), P('Requirement (Threshold)', HEAD),
            P('Measured Result', HEAD), P('Pass / Fail', HEAD)]
    data = [head] + rows
    col_w = [22*mm, 34*mm, 40*mm, 30*mm, 30*mm, 18*mm]
    t = Table(data, colWidths=col_w, repeatRows=1)
    st = list(BASE_STYLE)
    t.setStyle(TableStyle(st))
    return t


def module(title, table):
    return KeepTogether([Paragraph(title, MOD), table, Spacer(1, 4)])


PF = '[  ]'          # empty box, filled by hand during the demo
PASS = '[ &#10003; ]'  # ticked box for the already-measured timing results


# ===========================================================================
# Content
# ===========================================================================

def build():
    doc = SimpleDocTemplate(
        OUT, pagesize=A4,
        leftMargin=16*mm, rightMargin=16*mm,
        topMargin=16*mm, bottomMargin=14*mm,
        title='SkyWatcher — Test Cases',
    )
    e = []
    e.append(Paragraph('TEST CASE — SkyWatcher', TITLE))
    e.append(Paragraph(
        'IoT-Enabled Smart Airport Baggage Tracking System &nbsp;|&nbsp; '
        'Final Year Project (PSM), UTeM FTMK 2025/2026 &nbsp;|&nbsp; '
        'B032310853', SUB))

    # ---- Module 1 — Authentication & Access Control -----------------------
    m1 = [
        [P('TC-001', CELL_B),
         P('Admin login with valid credentials'),
         P('Admin account seeded; API running.'),
         steps(['Open dashboard login.',
                'Enter username <b>admin</b> / <b>admin123</b>.',
                'Click Login.']),
         P('JWT (HS256) issued; role = admin; redirected to dashboard.'),
         P(PF)],
        [P('TC-002', CELL_B),
         P('Login rejected with wrong password'),
         P('Admin account exists.'),
         steps(['Enter username <b>admin</b> and a wrong password.',
                'Click Login.']),
         P('401 Unauthorized; access denied; no token issued.'),
         P(PF)],
        [P('TC-003', CELL_B),
         P('Ground staff sees only their checkpoint'),
         P('staff_security logged in.'),
         steps(['Login as <b>staff_security</b>.',
                'Open the Bags list.']),
         P('Only bags whose last checkpoint = security are shown.'),
         P(PF)],
        [P('TC-004', CELL_B),
         P('Role restriction on admin-only route'),
         P('Ground staff logged in.'),
         steps(['As ground staff, call GET /api/stats.']),
         P('403 Forbidden — insufficient permission.'),
         P(PF)],
        [P('TC-005', CELL_B),
         P('Expired / invalid token blocked'),
         P('Token expired or tampered.'),
         steps(['Send a request with an invalid Bearer token.']),
         P('401 Unauthorized; user redirected to /login.'),
         P(PF)],
    ]
    e.append(module('Module 1: User Authentication &amp; Access Control (JWT)', std_table(m1)))

    # ---- Module 2 — Baggage Event Tracking --------------------------------
    m2 = [
        [P('TC-006', CELL_B),
         P('Ingest a valid RFID scan event'),
         P('API + broker running.'),
         steps(['Publish/POST a valid event (tag_id, checkpoint, duration).']),
         P('201 Created; bag upserted; event stored in DB.'),
         P(PF)],
        [P('TC-007', CELL_B),
         P('Reject malformed event'),
         P('API running.'),
         steps(['POST an event missing tag_id and checkpoint.']),
         P('400 Bad Request; "tag_id and checkpoint are required".'),
         P(PF)],
        [P('TC-008', CELL_B),
         P('Duplicate scan is not double-counted'),
         P('Event already stored.'),
         steps(['POST the same (tag_id, checkpoint, timestamp) twice.']),
         P('Duplicate ignored; only one event row persists.'),
         P(PF)],
        [P('TC-009', CELL_B),
         P('Retrieve full bag history in order'),
         P('Bag has several events.'),
         steps(['GET /api/bags/&lt;tag_id&gt;/history.']),
         P('All checkpoints returned in chronological order.'),
         P(PF)],
        [P('TC-010', CELL_B),
         P('Public passenger self-tracking'),
         P('Bag exists for flight+name.'),
         steps(['GET /api/track?flight_id=MH370&amp;passenger=Ahmad.']),
         P('Bag + event timeline returned; no login required.'),
         P(PF)],
    ]
    e.append(module('Module 2: Baggage Event Tracking', std_table(m2)))

    # ---- Module 3 — Real-Time Anomaly Detection ---------------------------
    m3 = [
        [P('TC-011', CELL_B),
         P('Normal bag → no anomaly'),
         P('History: check_in → security.'),
         steps(['Process a security event with duration 4 min.']),
         P('No anomaly raised (returns None).'),
         P(PF)],
        [P('TC-012', CELL_B),
         P('STALL detection (&gt; 20 min)'),
         P('Threshold = 20 min.'),
         steps(['Process a check_in event with duration 25 min.']),
         P('Anomaly type = <b>STALL</b> raised and stored.'),
         P(PF)],
        [P('TC-013', CELL_B),
         P('STALL boundary (exactly 20 min)'),
         P('Threshold = 20 min.'),
         steps(['Process an event with duration exactly 20.0 min.']),
         P('STALL fires (threshold is inclusive).'),
         P(PF)],
        [P('TC-014', CELL_B),
         P('WRONG_ROUTE (skips a step)'),
         P('Previous checkpoint = check_in.'),
         steps(['Process a sorting event (skips security).']),
         P('Anomaly type = <b>WRONG_ROUTE</b> raised.'),
         P(PF)],
        [P('TC-015', CELL_B),
         P('SECURITY_BYPASS (no security scan)'),
         P('History has no security event.'),
         steps(['Bag reaches loading without a security scan.']),
         P('Anomaly type = <b>SECURITY_BYPASS</b> raised.'),
         P(PF)],
        [P('TC-016', CELL_B),
         P('No false alarm on valid sequence'),
         P('History: check_in → security → sorting.'),
         steps(['Process the sorting event normally.']),
         P('No SECURITY_BYPASS; no anomaly.'),
         P(PF)],
        [P('TC-017', CELL_B),
         P('Confidence score is bounded'),
         P('Any detected anomaly.'),
         steps(['Inspect the score of a raised anomaly.']),
         P('Score is within [0.0, 1.0]; alert persisted once.'),
         P(PF)],
    ]
    e.append(module('Module 3: Real-Time Anomaly Detection (Isolation Forest + Rules)', std_table(m3)))

    # ---- Module 4 — Alerts & Dashboard ------------------------------------
    m4 = [
        [P('TC-018', CELL_B),
         P('Anomaly appears as an alert'),
         P('An anomaly was detected.'),
         steps(['GET /api/alerts.']),
         P('Alert listed with type, checkpoint and unresolved count.'),
         P(PF)],
        [P('TC-019', CELL_B),
         P('Resolve an alert'),
         P('Unresolved alert exists.'),
         steps(['PATCH /api/alerts/&lt;id&gt;/resolve.']),
         P('Alert marked resolved with resolved_at timestamp.'),
         P(PF)],
        [P('TC-020', CELL_B),
         P('Staff cannot resolve other checkpoints'),
         P('Alert belongs to another checkpoint.'),
         steps(['Ground staff attempts to resolve it.']),
         P('403 Forbidden — only own-checkpoint alerts allowed.'),
         P(PF)],
        [P('TC-021', CELL_B),
         P('Live dashboard auto-refresh'),
         P('Dashboard open.'),
         steps(['Create a new event and wait one poll cycle.']),
         P('New data appears within the 3-second poll interval.'),
         P(PF)],
    ]
    e.append(module('Module 4: Alerts &amp; Live Dashboard', std_table(m4)))

    # ---- Module 5 — TIME REQUIREMENT (real-time performance) --------------
    e.append(Paragraph('Module 5: Time Requirement Test (Real-Time Performance)', MOD))
    e.append(Paragraph(
        'SkyWatcher is a real-time system: each scan must be ingested, analysed '
        'and surfaced fast enough for ground staff to act while the bag is still '
        'in the hall. The database layer is mocked so each figure reflects the '
        'system&#8217;s own processing time, not network latency. Automated with '
        'pytest (500&#8211;1000 iterations, warmed up).', NOTE))
    e.append(Spacer(1, 4))
    tr = [
        [P('TC-T01', CELL_B),
         P('Mean anomaly-detection latency per event'),
         P('500 detections, mean of per-call time'),
         P('&#8804; 50 ms'),
         P('&#8776; 2.1 ms', CELL_B),
         P(PASS)],
        [P('TC-T02', CELL_B),
         P('95th-percentile detection latency'),
         P('500 detections, p95 (nearest rank)'),
         P('&#8804; 100 ms'),
         P('&#8776; 2.2 ms', CELL_B),
         P(PASS)],
        [P('TC-T03', CELL_B),
         P('Worst-case detection latency'),
         P('500 detections, maximum'),
         P('&#8804; 250 ms'),
         P('&#8776; 7 ms', CELL_B),
         P(PASS)],
        [P('TC-T04', CELL_B),
         P('Machine-learning inference only'),
         P('500 IsolationForest.predict() calls'),
         P('&#8804; 20 ms'),
         P('&#8776; 2.1 ms', CELL_B),
         P(PASS)],
        [P('TC-T05', CELL_B),
         P('Sustained processing throughput'),
         P('1000 sequential detections'),
         P('&#8805; 100 events / s'),
         P('&#8776; 470 events/s', CELL_B),
         P(PASS)],
        [P('TC-T06', CELL_B),
         P('Cold first-scan latency after start-up'),
         P('First timed detection call'),
         P('&#8804; 500 ms'),
         P('&#8776; 2.1 ms', CELL_B),
         P(PASS)],
        [P('TC-T07', CELL_B),
         P('End-to-end POST /api/events (live stack)'),
         P('20 live HTTP requests, mean'),
         P('&#8804; 1500 ms'),
         P('measured at demo', CELL),
         P(PF)],
        [P('TC-T08', CELL_B),
         P('GET /api/health round-trip (live stack)'),
         P('20 live HTTP requests, mean'),
         P('&#8804; 500 ms'),
         P('measured at demo', CELL),
         P(PF)],
    ]
    e.append(timing_table(tr))
    e.append(Paragraph(
        '<b>Conclusion:</b> detection completes in &#8776;2 ms &#8212; about 25&#215; '
        'faster than the 50 ms budget &#8212; and sustains &#8776;470 events per '
        'second on a single thread. As this is far below the 3-second dashboard '
        'refresh interval, anomalies are effectively surfaced on the next poll, '
        'satisfying the real-time requirement. (Millisecond values vary slightly '
        'per machine; the test asserts against the threshold, not the exact number.)',
        NOTE))

    e.append(Spacer(1, 10))
    e.append(Paragraph(
        'Legend:&nbsp; [  ] = to be verified during demonstration &nbsp;&nbsp; '
        '[ &#10003; ] = automated test executed and passed. &nbsp; '
        'Automated cases: run <font face="Courier">cd backend &amp;&amp; python -m pytest</font>.',
        SUB))

    doc.build(e)
    print(f'Wrote {OUT}')


if __name__ == '__main__':
    build()
