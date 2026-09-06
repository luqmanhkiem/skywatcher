"""
TIME REQUIREMENT TEST CASES — SkyWatcher (real-time performance)

SkyWatcher is a real-time baggage-tracking system: an RFID scan must be turned
into a stored event, analysed for anomalies, and surfaced on the dashboard fast
enough that ground staff can act while the bag is still in the hall. These tests
measure the *latency* of the detection pipeline against defined Non-Functional
Requirements (NFRs) and FAIL if a requirement is breached.

DB access (Supabase, a network round-trip) is mocked out via the `fake_db`
fixture, so each measurement reflects the SYSTEM'S OWN processing time
(rule checks + Isolation Forest inference) rather than internet latency.
This isolates what the software controls, which is what a real-time requirement
should be pinned to.

Defined time requirements (see tests/TEST_CASES.md, TC-T01 .. TC-T06):

    ID       Requirement                                          Threshold
    ------   --------------------------------------------------   ----------
    TR-1     Single-event anomaly detection (mean)                <=  50 ms
    TR-2     Single-event anomaly detection (95th percentile)     <= 100 ms
    TR-3     Single-event anomaly detection (worst case)          <= 250 ms
    TR-4     Isolation Forest inference only (mean)               <=  20 ms
    TR-5     Sustained throughput                                 >= 100 events/s
    TR-6     Cold-path detection incl. warm-up (single call)      <= 500 ms

Run just these:   pytest -m timing -s
(-s shows the printed latency report.)
"""
import statistics
import time

import pytest

from models.anomaly import detect_anomaly, _forest
from tests.conftest import make_event

pytestmark = pytest.mark.timing


# --- Requirement thresholds (edit here if your supervisor sets other targets)--
TR1_MEAN_MS = 50.0
TR2_P95_MS = 100.0
TR3_MAX_MS = 250.0
TR4_INFER_MEAN_MS = 20.0
TR5_MIN_THROUGHPUT = 100.0   # events per second
TR6_COLD_MS = 500.0

WARMUP_ITERS = 20
MEASURE_ITERS = 500


def _percentile(sorted_samples, pct):
    """Nearest-rank percentile in ms."""
    if not sorted_samples:
        return 0.0
    k = max(0, min(len(sorted_samples) - 1,
                   int(round((pct / 100.0) * len(sorted_samples) + 0.5)) - 1))
    return sorted_samples[k]


def _measure_detection_latencies(fake_db, iters=MEASURE_ITERS):
    """Return a list of per-call latencies (ms) for detect_anomaly()."""
    # A representative 'normal' event with a two-step history so every code
    # path (rules + Isolation Forest predict) is exercised, matching the live
    # workload the MQTT bridge produces per scan.
    fake_db.set_history(['check_in', 'security'])
    payload = make_event('security', duration_mins=4.0)

    # Warm-up: prime interpreter / numpy / sklearn caches so we measure the
    # steady-state latency staff actually experience, not first-call overhead.
    for _ in range(WARMUP_ITERS):
        detect_anomaly(payload)

    samples = []
    for _ in range(iters):
        t0 = time.perf_counter()
        detect_anomaly(payload)
        samples.append((time.perf_counter() - t0) * 1000.0)
    return samples


def _report(name, samples):
    s = sorted(samples)
    stats = {
        'n': len(s),
        'mean': statistics.mean(s),
        'median': statistics.median(s),
        'p95': _percentile(s, 95),
        'max': max(s),
        'min': min(s),
    }
    print(
        f"\n[TIMING] {name}: n={stats['n']}  "
        f"mean={stats['mean']:.2f}ms  median={stats['median']:.2f}ms  "
        f"p95={stats['p95']:.2f}ms  max={stats['max']:.2f}ms"
    )
    return stats


# --- TC-T01 / TR-1 — mean detection latency ----------------------------------
def test_TR1_mean_detection_latency_under_50ms(fake_db):
    stats = _report('TR-1/2/3 detection latency',
                    _measure_detection_latencies(fake_db))
    assert stats['mean'] <= TR1_MEAN_MS, (
        f"Mean detection latency {stats['mean']:.2f}ms exceeds "
        f"{TR1_MEAN_MS}ms requirement"
    )


# --- TC-T02 / TR-2 — 95th-percentile latency ---------------------------------
def test_TR2_p95_detection_latency_under_100ms(fake_db):
    stats = _report('TR-2 p95 detection latency',
                    _measure_detection_latencies(fake_db))
    assert stats['p95'] <= TR2_P95_MS, (
        f"p95 detection latency {stats['p95']:.2f}ms exceeds "
        f"{TR2_P95_MS}ms requirement"
    )


# --- TC-T03 / TR-3 — worst-case latency --------------------------------------
def test_TR3_worst_case_latency_under_250ms(fake_db):
    stats = _report('TR-3 worst-case detection latency',
                    _measure_detection_latencies(fake_db))
    assert stats['max'] <= TR3_MAX_MS, (
        f"Worst-case detection latency {stats['max']:.2f}ms exceeds "
        f"{TR3_MAX_MS}ms requirement"
    )


# --- TC-T04 / TR-4 — Isolation Forest inference latency -----------------------
def test_TR4_isolation_forest_inference_under_20ms():
    features = [[5.0, 1, 2]]
    for _ in range(WARMUP_ITERS):
        _forest.predict(features)

    samples = []
    for _ in range(MEASURE_ITERS):
        t0 = time.perf_counter()
        _forest.predict(features)
        samples.append((time.perf_counter() - t0) * 1000.0)

    stats = _report('TR-4 IsolationForest.predict', samples)
    assert stats['mean'] <= TR4_INFER_MEAN_MS, (
        f"Mean ML inference {stats['mean']:.2f}ms exceeds "
        f"{TR4_INFER_MEAN_MS}ms requirement"
    )


# --- TC-T05 / TR-5 — sustained throughput ------------------------------------
def test_TR5_throughput_at_least_100_events_per_second(fake_db):
    fake_db.set_history(['check_in', 'security'])
    payload = make_event('security', duration_mins=4.0)
    for _ in range(WARMUP_ITERS):
        detect_anomaly(payload)

    n = 1000
    t0 = time.perf_counter()
    for _ in range(n):
        detect_anomaly(payload)
    elapsed = time.perf_counter() - t0
    throughput = n / elapsed
    print(f"\n[TIMING] TR-5 throughput: {throughput:.0f} events/s "
          f"({n} events in {elapsed:.3f}s)")
    assert throughput >= TR5_MIN_THROUGHPUT, (
        f"Throughput {throughput:.0f} events/s below "
        f"{TR5_MIN_THROUGHPUT} events/s requirement"
    )


# --- TC-T06 / TR-6 — cold single-call latency --------------------------------
def test_TR6_cold_single_call_under_500ms(fake_db):
    """First real detection after start-up must still respond within 500 ms."""
    fake_db.set_history(['check_in', 'security'])
    payload = make_event('security', duration_mins=4.0)
    t0 = time.perf_counter()
    detect_anomaly(payload)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"\n[TIMING] TR-6 cold single-call: {elapsed_ms:.2f}ms")
    assert elapsed_ms <= TR6_COLD_MS, (
        f"Cold single-call latency {elapsed_ms:.2f}ms exceeds "
        f"{TR6_COLD_MS}ms requirement"
    )
