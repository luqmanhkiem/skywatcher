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

def _build_training_data(n: int = 500) -> np.ndarray:
    """
    Synthetic normal-behaviour data.
    Each row: [duration_mins, checkpoint_idx, expected_next_idx]
    Normal bags: 2–12 min per checkpoint, move forward one step at a time.
    """
    rng = np.random.default_rng(42)
    cp_indices = rng.integers(0, 5, size=n)
    durations = rng.uniform(2, 12, size=n)
    next_indices = np.minimum(cp_indices + 1, 4)
    return np.column_stack([durations, cp_indices, next_indices])


_forest = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
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
    # Skip on first scan (no history baseline yet) and require high confidence
    expected_next = min(cp_idx + 1, 4)
    score = _confidence([duration_mins, cp_idx, expected_next])
    if len(history) > 1 and score > 0.75:
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
    Map IsolationForest.score_samples() output to a [0, 1] confidence value
    where 1.0 = maximally anomalous.

    score_samples() returns lower (more negative) values for anomalies.
    Typical range for this model: roughly [-0.5, 0.5].
    Mapping: confidence = clip(0.5 - raw_score, 0, 1)
      raw = -0.5  →  confidence ≈ 1.0  (very anomalous)
      raw =  0.0  →  confidence ≈ 0.5  (borderline)
      raw =  0.5  →  confidence ≈ 0.0  (clearly normal)
    """
    raw: float = _forest.score_samples([features])[0]
    return float(np.clip(0.5 - raw, 0.0, 1.0))


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
