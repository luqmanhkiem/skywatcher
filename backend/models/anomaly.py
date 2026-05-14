"""
Anomaly Detection — SkyWatcher
Uses scikit-learn Isolation Forest to detect three anomaly types:
  1. STALL           — bag at checkpoint longer than threshold
  2. WRONG_ROUTE     — checkpoint out of expected sequential order
  3. SECURITY_BYPASS — security step missing from bag history

Features fed to the model: [duration_mins, checkpoint_index, expected_next_index]
"""
import os
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from sklearn.ensemble import IsolationForest

from models.database import get_recent_events_for_bag, insert_anomaly

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

STALL_THRESHOLD = float(os.getenv('ANOMALY_STALL_THRESHOLD_MINUTES', 20))

# Strict checkpoint ordering
CHECKPOINT_ORDER: dict[str, int] = {
    'check_in': 0,
    'security': 1,
    'sorting': 2,
    'loading': 3,
    'arrival': 4,
}

# ---------------------------------------------------------------------------
# Isolation Forest — trained once at module import on synthetic normal data
# ---------------------------------------------------------------------------

# Per-checkpoint normal duration ranges, padded slightly beyond the simulator's
# NORMAL_DURATIONS so values at the simulator's edges (e.g. arrival 1.0 min,
# loading 12 min) sit comfortably inside the model's "normal" region.
# Format: (low, high) for sampling.
_TRAINING_DURATIONS = {
    0: (1, 10),   # check_in   (sim: 3–8)
    1: (1, 8),    # security   (sim: 2–6)
    2: (2, 13),   # sorting    (sim: 4–10)
    3: (3, 15),   # loading    (sim: 5–12)
    4: (0.5, 6),  # arrival    (sim: 1–4)
}


def _build_training_data(n_per_cp: int = 200) -> np.ndarray:
    """
    Synthetic normal-behaviour data, sampled per checkpoint to match the
    simulator's per-checkpoint duration ranges (with padding).
    Each row: [duration_mins, checkpoint_idx, expected_next_idx]
    """
    rng = np.random.default_rng(42)
    rows = []
    for cp_idx, (lo, hi) in _TRAINING_DURATIONS.items():
        durations = rng.uniform(lo, hi, size=n_per_cp)
        next_idx = min(cp_idx + 1, 4)
        for d in durations:
            rows.append([d, cp_idx, next_idx])
    return np.array(rows)


# contamination=0.01: only the most extreme 1% of training points are treated
# as anomalous. This keeps the decision boundary tight against true outliers
# (long stalls, durations far outside any checkpoint's normal range).
_forest = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
_forest.fit(_build_training_data())
print('[AnomalyEngine] Isolation Forest trained on synthetic normal data.')


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_anomaly(payload: dict) -> Optional[dict]:
    """
    Run all anomaly checks against one MQTT event payload.

    NOTE: This must be called *after* insert_event() so that
    get_recent_events_for_bag() returns the full history including
    the current event at index 0 (most recent, DESC order).
    WRONG_ROUTE therefore reads history[1] for the *previous* checkpoint.

    Returns an anomaly dict on detection, None otherwise.
    """
    tag_id = payload.get('tag_id')
    checkpoint = payload.get('checkpoint')
    duration_mins = float(payload.get('duration_mins', 0))

    if not tag_id or not checkpoint:
        return None

    cp_idx = CHECKPOINT_ORDER.get(checkpoint, -1)
    if cp_idx == -1:
        return None  # unknown checkpoint — ignore

    # 1. STALL — bag exceeded time threshold at this checkpoint
    if duration_mins >= STALL_THRESHOLD:
        score = _confidence([duration_mins, cp_idx, min(cp_idx + 1, 4)])
        return _anomaly(
            tag_id, 'STALL', checkpoint, score,
            f'Bag stalled at {checkpoint} for {duration_mins:.1f} min '
            f'(threshold: {STALL_THRESHOLD:.0f} min).',
        )

    # history is DESC by timestamp; [0] = current (just inserted), [1] = previous
    history = get_recent_events_for_bag(tag_id, limit=11)

    # 2. WRONG_ROUTE — current checkpoint skips more than one step from previous
    if len(history) > 1:
        prev_cp = history[1].get('checkpoint')  # index 1 = previous event
        prev_idx = CHECKPOINT_ORDER.get(prev_cp, -1)
        if prev_idx != -1 and cp_idx - prev_idx > 1:
            score = _confidence([duration_mins, cp_idx, prev_idx + 1])
            return _anomaly(
                tag_id, 'WRONG_ROUTE', checkpoint, score,
                f'Bag jumped from {prev_cp} → {checkpoint}; '
                f'expected step {prev_idx + 1} '
                f'({_checkpoint_name(prev_idx + 1)}).',
            )

    # 3. SECURITY_BYPASS — reached sorting/loading/arrival without security
    if cp_idx >= CHECKPOINT_ORDER['sorting']:
        visited = {e.get('checkpoint') for e in history}
        if 'security' not in visited:
            score = _confidence([duration_mins, cp_idx, CHECKPOINT_ORDER['security']])
            return _anomaly(
                tag_id, 'SECURITY_BYPASS', checkpoint, score,
                f'Bag reached {checkpoint} with no security screening on record.',
            )

    # 4. Catch-all — Isolation Forest flags subtle anomaly
    # Skip on first scan (no history baseline yet). Gate by the model's own
    # contamination-based decision boundary (predict() == -1) instead of a raw
    # score threshold, which was previously firing on every normal event.
    expected_next = min(cp_idx + 1, 4)
    features = [duration_mins, cp_idx, expected_next]
    if len(history) > 1 and _forest.predict([features])[0] == -1:
        score = _confidence(features)
        return _anomaly(
            tag_id, 'ANOMALY', checkpoint, score,
            f'Unusual movement pattern at {checkpoint} (confidence: {score:.2f}).',
        )

    return None


def store_anomaly(anomaly: dict) -> None:
    """Persist a detected anomaly to the anomalies table."""
    insert_anomaly(
        tag_id      = anomaly['tag_id'],
        anomaly_type= anomaly['type'],
        description = anomaly['description'],
        checkpoint  = anomaly['checkpoint'],
        score       = anomaly['score'],
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _confidence(features: list[float]) -> float:
    """
    Map IsolationForest.decision_function() output to a [0, 1] confidence value
    where 1.0 = maximally anomalous.

    decision_function() is centred on the contamination boundary:
      df > 0  → normal     (further from 0 = more clearly normal)
      df < 0  → anomaly    (further from 0 = more clearly anomalous)

    The raw magnitudes for this 3-feature model are small (≈ ±0.1), so we
    scale by 5 to spread the confidence across [0, 1]:
      df = +0.10  →  conf 0.0   (clearly normal)
      df =  0.00  →  conf 0.5   (borderline)
      df = -0.10  →  conf 1.0   (clearly anomalous)
    """
    df: float = _forest.decision_function([features])[0]
    return float(np.clip(0.5 - df * 5, 0.0, 1.0))


def _anomaly(
    tag_id: str,
    atype: str,
    checkpoint: str,
    score: float,
    description: str,
) -> dict:
    return {
        'tag_id': tag_id,
        'type': atype,
        'checkpoint': checkpoint,
        'score': round(score, 4),
        'description': description,
    }


def _checkpoint_name(idx: int) -> str:
    """Reverse-lookup checkpoint name from its index."""
    return next((k for k, v in CHECKPOINT_ORDER.items() if v == idx), 'unknown')
