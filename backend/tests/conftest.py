"""
Shared pytest fixtures for the SkyWatcher test suite.

The anomaly detector normally reads a bag's checkpoint history from Supabase
(``get_recent_events_for_bag``) and writes alerts back to it (``insert_anomaly``).
For unit and time-requirement testing we replace those two functions with
in-memory fakes so that:

  * tests are deterministic (no network, no live database),
  * timing measurements reflect the *detection algorithm* (rules + Isolation
    Forest inference) and NOT Supabase network latency, and
  * the suite runs anywhere, including offline in the exam/demo environment.
"""
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest

# Make `models`, `auth`, etc. importable regardless of the working directory.
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import models.anomaly as anomaly  # noqa: E402  (import after sys.path fix)


# ---------------------------------------------------------------------------
# Helpers to build event payloads / histories the way Supabase returns them
# ---------------------------------------------------------------------------

def make_event(checkpoint, duration_mins=5.0, tag_id='TAG-TEST',
               flight_id='MH370', passenger='Test Passenger', ts=None):
    """Build one MQTT-shaped event payload."""
    return {
        'tag_id': tag_id,
        'flight_id': flight_id,
        'passenger': passenger,
        'checkpoint': checkpoint,
        'duration_mins': duration_mins,
        'timestamp': (ts or datetime.now(timezone.utc)).isoformat(),
    }


def make_history(checkpoints, tag_id='TAG-TEST'):
    """
    Build a fake checkpoint history in the shape the detector expects:
    newest first (DESC by timestamp), each row a dict with 'checkpoint'.
    `checkpoints` is given oldest -> newest for readability, then reversed.
    """
    now = datetime.now(timezone.utc)
    rows = []
    for i, cp in enumerate(checkpoints):
        rows.append({
            'tag_id': tag_id,
            'checkpoint': cp,
            'timestamp': (now + timedelta(minutes=i)).isoformat(),
            'duration_mins': 5.0,
        })
    rows.reverse()  # DESC — index 0 = most recent
    return rows


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_db(monkeypatch):
    """
    Patch the detector's DB dependencies with in-memory fakes.

    Usage:
        def test_x(fake_db):
            fake_db.set_history(['check_in', 'security'])
            result = detect_anomaly(payload)
            assert fake_db.stored == []   # nothing persisted by detect()
    """
    state = {'history': [], 'stored': []}

    def fake_get_recent_events_for_bag(tag_id, limit=10):
        return state['history'][:limit]

    def fake_insert_anomaly(**kwargs):
        state['stored'].append(kwargs)

    monkeypatch.setattr(anomaly, 'get_recent_events_for_bag',
                        fake_get_recent_events_for_bag)
    monkeypatch.setattr(anomaly, 'insert_anomaly', fake_insert_anomaly)

    class Handle:
        stored = state['stored']

        @staticmethod
        def set_history(checkpoints_oldest_first, tag_id='TAG-TEST'):
            state['history'] = make_history(checkpoints_oldest_first, tag_id)

        @staticmethod
        def set_raw_history(rows):
            state['history'] = rows

    return Handle()
