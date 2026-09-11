"""
Bag State Machine - SkyWatcher

A bag's tracking status is a finite state machine (FSM). Every transition is
triggered by an *input* (a checkpoint scan or an operator action) and gated by a
*guard* (a validation rule). Illegal inputs are either rejected
(``InvalidTransition``) or routed to an exception state - this is the
"processing" step the project demonstrates.

This module is **pure**: no database, no network, no Flask. The DB layer
(``models/database.py``) gathers context from event history and calls
``decide()``; the result is what gets persisted. Keeping it pure makes every
transition unit-testable in isolation (see ``tests/test_state_machine.py``).

Public API:
    STATES, TRANSITIONS, ACTIONS, CHECKPOINTS, TERMINAL_STATES
    normalize_status(status, last_checkpoint=None) -> str | None
    decide(current_status, trigger, context=None) -> (new_status, anomaly | None)
    InvalidTransition  (raised for an action that is illegal from the current state)
"""
from typing import Optional


# ── Checkpoints (strict order - mirrors CLAUDE.md "Checkpoint flow") ──────────

CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']
CHECKPOINT_ORDER = {cp: i for i, cp in enumerate(CHECKPOINTS)}

DEFAULT_STALL_THRESHOLD = 20.0  # minutes; DB layer passes the env-configured value


# ── States ───────────────────────────────────────────────────────────────────

# Happy-path lifecycle (in order). Each maps 1:1 to a checkpoint scan.
CHECKPOINT_TO_STATE = {
    'check_in': 'REGISTERED',
    'security': 'SCREENED',
    'sorting':  'SORTED',
    'loading':  'LOADED',
    'arrival':  'ARRIVED',
}
HAPPY_SEQUENCE = ['REGISTERED', 'SCREENED', 'SORTED', 'LOADED', 'ARRIVED', 'CLAIMED']

# Exception / operational states.
EXCEPTION_STATES = ['FLAGGED', 'MISROUTED', 'HELD', 'LOST']

STATES = HAPPY_SEQUENCE + EXCEPTION_STATES

# Category per state - used by the dashboard/mobile to pick a badge colour.
STATE_CATEGORY = {
    'REGISTERED': 'active', 'SCREENED': 'active', 'SORTED': 'active',
    'LOADED': 'active', 'ARRIVED': 'success', 'CLAIMED': 'success',
    'FLAGGED': 'critical', 'MISROUTED': 'warning', 'HELD': 'hold', 'LOST': 'critical',
}

# Terminal states: no scan or action advances out of these.
# ARRIVED = happy-path end (bag at carousel, journey done).
# CLAIMED = lost-bag recovery end (lost bag returned to passenger).
TERMINAL_STATES = {'ARRIVED', 'CLAIMED'}


# ── Operator actions ─────────────────────────────────────────────────────────

# action -> (set of allowed source states, destination state)
ACTION_TRANSITIONS = {
    'hold':        ({'REGISTERED', 'SCREENED', 'SORTED', 'LOADED', 'FLAGGED', 'MISROUTED'}, 'HELD'),
    'release':     ({'HELD'}, 'SCREENED'),
    'reroute':     ({'MISROUTED'}, 'SORTED'),
    'claim':       ({'LOST'}, 'CLAIMED'),
    'report_lost': ({'REGISTERED', 'SCREENED', 'SORTED', 'LOADED', 'FLAGGED', 'MISROUTED', 'HELD'}, 'LOST'),
    'found':       ({'LOST'}, 'SCREENED'),
}
ACTIONS = list(ACTION_TRANSITIONS.keys())

# Anomaly resolution sends a bag back onto the happy path (used in Phase 5 by
# resolve_alert). Declared here so the FSM stays the single source of truth.
RESOLUTION_TRANSITIONS = {
    'FLAGGED':   'SCREENED',
    'MISROUTED': 'SORTED',
}

# A readable, exported view of every non-scan transition (scans are rule-derived
# in ``decide`` because they depend on event sequence, not just the source state).
TRANSITIONS = {
    'actions':    {a: {'from': sorted(src), 'to': dst} for a, (src, dst) in ACTION_TRANSITIONS.items()},
    'resolution': dict(RESOLUTION_TRANSITIONS),
    'scans':      dict(CHECKPOINT_TO_STATE),
}


class InvalidTransition(Exception):
    """Raised when an operator action is not permitted from the current state."""

    def __init__(self, current_status: Optional[str], trigger: str):
        self.current_status = current_status
        self.trigger = trigger
        super().__init__(
            f'Action {trigger!r} is not allowed from state {current_status!r}.'
        )


# ── Legacy / defensive normalisation ─────────────────────────────────────────

def normalize_status(status: Optional[str],
                     last_checkpoint: Optional[str] = None) -> Optional[str]:
    """
    Map any stored status value into a valid FSM state. Existing bags carry the
    legacy values ``in_transit`` / ``arrived``; this never crashes on an
    unexpected value (hard-requirement: backward compatibility).

        - already an FSM state  -> returned unchanged
        - 'arrived'             -> 'ARRIVED'
        - 'in_transit'          -> derived from last_checkpoint (default REGISTERED)
        - None                  -> None (a brand-new bag, no prior status)
        - anything else         -> derived from last_checkpoint (default REGISTERED)
    """
    if status is None:
        return None
    if status in STATES:
        return status

    s = str(status).strip().lower()
    if s == 'arrived':
        return 'ARRIVED'
    # 'in_transit' or any unknown legacy value: infer from where the bag last was.
    return CHECKPOINT_TO_STATE.get(last_checkpoint or '', 'REGISTERED')


# ── The decision engine ──────────────────────────────────────────────────────

def decide(current_status: Optional[str], trigger: str,
           context: Optional[dict] = None):
    """
    Decide the bag's next status given its current status and an input trigger.

    Args:
        current_status: the bag's current FSM state (pass through
            ``normalize_status`` first), or None for a brand-new bag.
        trigger: a checkpoint name (a *scan*) or an action name (an *operator
            action*). See CHECKPOINTS / ACTIONS.
        context: for scans -> {'prev_checkpoint', 'visited', 'duration_mins',
            'stall_threshold'}; ignored for actions.

    Returns:
        (new_status, anomaly) where anomaly is None on a clean transition, or a
        dict {'type', 'checkpoint', 'description'} describing the rule violation
        that drove the bag into an exception state.

    Raises:
        InvalidTransition: an action that is illegal from ``current_status``
            (or a scan against a terminal CLAIMED bag).
        ValueError: an unrecognised trigger.
    """
    context = context or {}

    if trigger in CHECKPOINT_ORDER:
        return _decide_scan(current_status, trigger, context)
    if trigger in ACTION_TRANSITIONS:
        return _decide_action(current_status, trigger)

    raise ValueError(f'Unknown trigger: {trigger!r}')


def _decide_scan(current_status: Optional[str], checkpoint: str, context: dict):
    """Resolve a checkpoint scan into the next status (+ list of anomalies).

    All three anomaly conditions are evaluated independently so a single scan
    can produce multiple anomaly records (e.g. a bag that stalled AND skipped
    security will generate both STALL and SECURITY_BYPASS).

    Returns (new_status, [anomaly, ...]) - the list may be empty.
    """
    if current_status in TERMINAL_STATES:
        raise InvalidTransition(current_status, checkpoint)

    cp_idx       = CHECKPOINT_ORDER[checkpoint]
    target_state = CHECKPOINT_TO_STATE[checkpoint]
    duration     = float(context.get('duration_mins') or 0)
    threshold    = float(context.get('stall_threshold') or DEFAULT_STALL_THRESHOLD)
    visited      = set(context.get('visited') or [])
    prev_cp      = context.get('prev_checkpoint')
    prev_idx     = CHECKPOINT_ORDER.get(prev_cp, -1)
    expected_idx = prev_idx + 1  # -1 on first scan → expect check_in (0)

    anomalies = []
    exception_status = None  # track the worst exception state found

    # 1. STALL - dwell exceeded the threshold.
    if duration >= threshold:
        anomalies.append(_anomaly(
            'STALL', checkpoint,
            f'Bag stalled at {checkpoint} for {duration:.1f} min '
            f'(threshold: {threshold:.0f} min).',
        ))
        exception_status = 'FLAGGED'

    # 2. SECURITY_BYPASS - only fire on the *first* checkpoint that requires
    #    security (sorting). If sorting is already visited, the bypass was
    #    already caught there; don't re-alert on every downstream checkpoint.
    if (cp_idx >= CHECKPOINT_ORDER['sorting']
            and 'security' not in visited
            and 'sorting' not in visited):
        anomalies.append(_anomaly(
            'SECURITY_BYPASS', checkpoint,
            f'Bag reached {checkpoint} with no security screening on record.',
        ))
        exception_status = 'FLAGGED'

    # 3. WRONG_ROUTE - out of expected sequence (checked after safety anomalies).
    if cp_idx != expected_idx and cp_idx != prev_idx:
        anomalies.append(_anomaly(
            'WRONG_ROUTE', checkpoint,
            f'Bag scanned at {checkpoint}; expected '
            f'{CHECKPOINTS[expected_idx] if 0 <= expected_idx < len(CHECKPOINTS) else "end of route"}.',
        ))
        if exception_status is None:  # FLAGGED takes priority over MISROUTED
            exception_status = 'MISROUTED'

    if exception_status:
        return exception_status, anomalies

    # Normal advance or idempotent re-scan.
    return target_state, []


def _decide_action(current_status: Optional[str], action: str):
    """Resolve an operator action into the next status, or reject it."""
    allowed_from, destination = ACTION_TRANSITIONS[action]
    if current_status not in allowed_from:
        raise InvalidTransition(current_status, action)
    return destination, []


# ── Helpers ──────────────────────────────────────────────────────────────────

def expected_next_checkpoint(current_status: Optional[str]) -> Optional[str]:
    """The checkpoint a bag in a happy-path state is expected to reach next."""
    if current_status in HAPPY_SEQUENCE:
        idx = HAPPY_SEQUENCE.index(current_status)
        if idx + 1 < len(CHECKPOINTS):
            return CHECKPOINTS[idx + 1]
    return None


def _anomaly(atype: str, checkpoint: str, description: str) -> dict:
    return {'type': atype, 'checkpoint': checkpoint, 'description': description}
