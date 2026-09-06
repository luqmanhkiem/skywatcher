# SkyWatcher — Test Case Specification

**System:** SkyWatcher — IoT Smart Airport Baggage Tracking System
**Module under test:** Real-time anomaly-detection pipeline (`backend/`)
**Test tool:** pytest 8.4 (Python 3.9, scikit-learn 1.6, paho-mqtt 2.1)
**Environment:** DB layer (Supabase) mocked so timing reflects the system's own
processing, not internet latency. Live tests hit the running Flask API.

Run all: `cd backend && python -m pytest`
Run only time-requirement tests: `cd backend && python -m pytest -m timing -s`

---

## 1. Time Requirement (Real-Time Performance) Test Cases

SkyWatcher is a **real-time** system: each RFID scan must be ingested, analysed
for anomalies, and made visible to ground staff fast enough to act while the bag
is still in the hall. The following Non-Functional Requirements (NFRs) define the
timing budget, and each has an automated test that **fails if the requirement is
breached**.

| ID | Test Case | Requirement (threshold) | Method | Expected | Measured result | Status |
|----|-----------|-------------------------|--------|----------|-----------------|--------|
| TC-T01 | Mean anomaly-detection latency per event | ≤ 50 ms | 500 iterations, warmed up, mean of per-call time | mean ≤ 50 ms | **~2.15 ms** | ✅ PASS |
| TC-T02 | 95th-percentile detection latency | ≤ 100 ms | 500 iterations, nearest-rank p95 | p95 ≤ 100 ms | **~2.24 ms** | ✅ PASS |
| TC-T03 | Worst-case detection latency | ≤ 250 ms | 500 iterations, max | max ≤ 250 ms | **~2.32 ms** | ✅ PASS |
| TC-T04 | Isolation Forest inference only | ≤ 20 ms mean | 500 `predict()` calls | mean ≤ 20 ms | **~2.12 ms** | ✅ PASS |
| TC-T05 | Sustained throughput | ≥ 100 events/s | 1000 sequential detections | ≥ 100 events/s | **~468 events/s** | ✅ PASS |
| TC-T06 | Cold single-call latency (first scan after start-up) | ≤ 500 ms | one timed call | ≤ 500 ms | **~2.14 ms** | ✅ PASS |
| TC-T07 | POST /api/events end-to-end (ingest+detect+store) | ≤ 1500 ms | 20 live requests (mean) | ≤ 1500 ms | live-only* | ⏭ requires running stack |
| TC-T08 | GET /api/health round-trip | ≤ 500 ms | 20 live requests (mean) | ≤ 500 ms | live-only* | ⏭ requires running stack |

\* TC-T07/08 are executed against the live Flask API + Supabase during the demo:
`export SKYWATCHER_API_URL=http://localhost:5001 && pytest -m live -s`

**Interpretation.** The core detection pipeline turns a scan into a stored,
analysed event in about **2 ms** — roughly **25× faster** than the 50 ms budget —
and sustains ~**468 events per second** on a single thread. Because the dashboard
polls every 3 seconds (3000 ms) for live views, detection latency is negligible
compared with the refresh interval, so an anomaly is effectively surfaced on the
**next poll**, well within real-time expectations for airport ground operations.
Actual millisecond figures vary slightly per machine; the tests assert against
the thresholds, not the exact numbers.

---

## 2. Functional (Correctness) Test Cases

| ID | Test Case | Input | Expected output | Status |
|----|-----------|-------|-----------------|--------|
| TC-F01 | Normal event → no anomaly | security @ 4 min, history [check_in, security] | `None` | ✅ PASS |
| TC-F02 | STALL above threshold | check_in @ 25 min | anomaly `STALL` | ✅ PASS |
| TC-F03 | STALL boundary (exactly 20 min) | sorting @ 20 min | anomaly `STALL` | ✅ PASS |
| TC-F04 | No stall just below threshold | sorting @ 19.9 min | not `STALL` | ✅ PASS |
| TC-F05 | WRONG_ROUTE (skips a step) | check_in → sorting | anomaly `WRONG_ROUTE` | ✅ PASS |
| TC-F06 | SECURITY_BYPASS (no security scan) | reaches loading, security absent | anomaly `SECURITY_BYPASS` | ✅ PASS |
| TC-F07 | No false bypass when security present | check_in → security → sorting | not `SECURITY_BYPASS` | ✅ PASS |
| TC-F08 | Unknown checkpoint ignored | checkpoint `teleport` | `None` | ✅ PASS |
| TC-F09 | Malformed payload (no tag_id) | tag_id = `None` | `None` | ✅ PASS |
| TC-F10 | Confidence bounded + persisted | check_in @ 30 min | score ∈ [0,1], 1 row stored | ✅ PASS |

---

## 3. Traceability

| Requirement source | Requirement | Test case(s) |
|--------------------|-------------|--------------|
| CLAUDE.md — STALL | bag at checkpoint > 20 min | TC-F02, TC-F03, TC-F04 |
| CLAUDE.md — WRONG_ROUTE | checkpoint out of sequence | TC-F05 |
| CLAUDE.md — SECURITY_BYPASS | reaches sorting/loading/arrival w/o security | TC-F06, TC-F07 |
| NFR — real-time responsiveness | detection latency budget | TC-T01…TC-T06 |
| NFR — end-to-end responsiveness | API round-trip budget | TC-T07, TC-T08 |
| CLAUDE.md — poll interval 3000 ms | live-view refresh | context for TC-T01…T06 |

_Last run: 16 tests, 16 passed (6 timing + 10 functional). Live tests (2) run separately against the deployed stack._
