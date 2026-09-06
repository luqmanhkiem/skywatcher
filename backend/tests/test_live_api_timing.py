"""
LIVE end-to-end time requirement tests (optional).

Unlike test_time_requirements.py (which mocks the DB to isolate the algorithm),
these measure the REAL round-trip a scan takes through the running Flask API,
including Supabase. Use them for the demo/defence when the full stack is up.

They are SKIPPED unless you point them at a running server:

    export SKYWATCHER_API_URL=http://localhost:5001
    pytest -m live -s

Requirements measured (TC-T07 .. TC-T08):

    TR-7   POST /api/events end-to-end (ingest + detect + store)   <= 1500 ms
    TR-8   GET  /api/health responds                               <=  500 ms
"""
import os
import statistics
import time

import pytest

API_URL = os.getenv('SKYWATCHER_API_URL')

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not API_URL, reason='set SKYWATCHER_API_URL to run live timing tests'),
]

TR7_INGEST_MS = 1500.0
TR8_HEALTH_MS = 500.0
ITERS = 20


@pytest.fixture(scope='module')
def requests_lib():
    requests = pytest.importorskip('requests')
    return requests


def test_TR7_event_ingest_end_to_end(requests_lib):
    url = f'{API_URL.rstrip("/")}/api/events'
    samples = []
    for i in range(ITERS):
        payload = {
            'tag_id': f'TAG-PERF-{i:03d}',
            'flight_id': 'MH370',
            'passenger': 'Perf Test',
            'checkpoint': 'security',
            'duration_mins': 4.0,
        }
        t0 = time.perf_counter()
        r = requests_lib.post(url, json=payload, timeout=10)
        samples.append((time.perf_counter() - t0) * 1000.0)
        assert r.status_code in (200, 201), r.text

    mean = statistics.mean(samples)
    p95 = sorted(samples)[int(0.95 * len(samples)) - 1]
    print(f"\n[TIMING] TR-7 POST /api/events: mean={mean:.1f}ms  "
          f"p95={p95:.1f}ms  max={max(samples):.1f}ms  (n={ITERS})")
    assert mean <= TR7_INGEST_MS, f"Mean ingest {mean:.1f}ms exceeds {TR7_INGEST_MS}ms"


def test_TR8_health_endpoint_latency(requests_lib):
    url = f'{API_URL.rstrip("/")}/api/health'
    samples = []
    for _ in range(ITERS):
        t0 = time.perf_counter()
        r = requests_lib.get(url, timeout=10)
        samples.append((time.perf_counter() - t0) * 1000.0)
        assert r.status_code == 200
    mean = statistics.mean(samples)
    print(f"\n[TIMING] TR-8 GET /api/health: mean={mean:.1f}ms  "
          f"max={max(samples):.1f}ms  (n={ITERS})")
    assert mean <= TR8_HEALTH_MS, f"Mean health latency {mean:.1f}ms exceeds {TR8_HEALTH_MS}ms"
