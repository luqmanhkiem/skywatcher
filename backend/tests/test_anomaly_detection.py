"""
Functional test cases — Anomaly Detection Engine (models/anomaly.py)

Verifies the three rule-based detectors and the guard conditions:
    STALL            — duration >= ANOMALY_STALL_THRESHOLD_MINUTES (20)
    WRONG_ROUTE      — checkpoint skips a step in the strict sequence
    SECURITY_BYPASS  — reaches sorting/loading/arrival with no security on record

These map to test cases TC-F01 .. TC-F10 in tests/TEST_CASES.md.
"""
import pytest

from models.anomaly import detect_anomaly, store_anomaly, STALL_THRESHOLD
from tests.conftest import make_event

pytestmark = pytest.mark.functional


# --- TC-F01 — normal event produces no anomaly --------------------------------
def test_normal_event_returns_none(fake_db):
    fake_db.set_history(['check_in', 'security'])
    payload = make_event('security', duration_mins=4.0)
    assert detect_anomaly(payload) is None


# --- TC-F02 — STALL above threshold ------------------------------------------
def test_stall_detected_above_threshold(fake_db):
    fake_db.set_history(['check_in'])
    payload = make_event('check_in', duration_mins=25.0)
    result = detect_anomaly(payload)
    assert result is not None
    assert result['type'] == 'STALL'


# --- TC-F03 — STALL boundary: exactly at threshold fires ----------------------
def test_stall_boundary_exact_threshold(fake_db):
    fake_db.set_history(['sorting'])
    payload = make_event('sorting', duration_mins=STALL_THRESHOLD)
    assert detect_anomaly(payload)['type'] == 'STALL'


# --- TC-F04 — just below threshold does NOT stall -----------------------------
def test_no_stall_just_below_threshold(fake_db):
    fake_db.set_history(['check_in', 'security', 'sorting'])
    payload = make_event('sorting', duration_mins=STALL_THRESHOLD - 0.1)
    result = detect_anomaly(payload)
    assert result is None or result['type'] != 'STALL'


# --- TC-F05 — WRONG_ROUTE: checkpoint skips a step ----------------------------
def test_wrong_route_detected(fake_db):
    # Bag jumps check_in -> sorting (skips security). Current event = sorting.
    fake_db.set_history(['check_in', 'sorting'])
    payload = make_event('sorting', duration_mins=6.0)
    result = detect_anomaly(payload)
    assert result is not None
    assert result['type'] == 'WRONG_ROUTE'


# --- TC-F06 — SECURITY_BYPASS: reaches loading with no security ---------------
def test_security_bypass_detected(fake_db):
    # check_in -> sorting -> loading, security never scanned.
    # Current event (loading) is adjacent to previous (sorting) so WRONG_ROUTE
    # does not fire; the missing-security rule does.
    fake_db.set_history(['check_in', 'sorting', 'loading'])
    payload = make_event('loading', duration_mins=7.0)
    result = detect_anomaly(payload)
    assert result is not None
    assert result['type'] == 'SECURITY_BYPASS'


# --- TC-F07 — normal sequence through security is NOT flagged as bypass -------
def test_no_bypass_when_security_present(fake_db):
    fake_db.set_history(['check_in', 'security', 'sorting'])
    payload = make_event('sorting', duration_mins=8.0)
    result = detect_anomaly(payload)
    assert result is None or result['type'] != 'SECURITY_BYPASS'


# --- TC-F08 — unknown checkpoint is ignored -----------------------------------
def test_unknown_checkpoint_ignored(fake_db):
    fake_db.set_history(['check_in'])
    payload = make_event('teleport', duration_mins=5.0)
    assert detect_anomaly(payload) is None


# --- TC-F09 — malformed payload (no tag_id) returns None ----------------------
def test_missing_tag_id_returns_none(fake_db):
    payload = make_event('security', duration_mins=5.0)
    payload['tag_id'] = None
    assert detect_anomaly(payload) is None


# --- TC-F10 — every detected anomaly carries a bounded confidence score -------
def test_anomaly_score_bounds_and_persist(fake_db):
    fake_db.set_history(['check_in'])
    payload = make_event('check_in', duration_mins=30.0)
    result = detect_anomaly(payload)
    assert 0.0 <= result['score'] <= 1.0
    assert {'tag_id', 'type', 'checkpoint', 'description'} <= result.keys()

    # store_anomaly must persist exactly one row via the DB layer
    store_anomaly(result)
    assert len(fake_db.stored) == 1
    assert fake_db.stored[0]['anomaly_type'] == 'STALL'
