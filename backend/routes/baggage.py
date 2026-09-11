from flask import Blueprint, g, jsonify, request

from datetime import datetime, timedelta, timezone

from auth import token_required
from models.anomaly import store_anomaly
from models.state_machine import (
    ACTIONS, CHECKPOINTS, InvalidTransition, normalize_status,
)
from models.database import (
    ADVISORY_LEVELS,
    add_arrival_subscription,
    apply_operator_action,
    create_advisory_request,
    get_advisories,
    get_advisory_requests,
    get_all_bags,
    get_anomalies_for_bag,
    get_bag_by_passenger,
    get_bags_by_booking_ref,
    get_bag_by_tag,
    get_bag_history,
    get_bag_status_history,
    get_carousel,
    get_checkpoint_stats,
    get_expected_durations,
    get_flight_summaries,
    get_anomaly_trend,
    get_flight_anomaly_counts,
    get_avg_resolution_time_minutes,
    get_checkpoint_anomaly_counts,
    insert_event,
    review_advisory_request,
    set_carousel,
    upsert_advisory,
)
from notifier import notify_anomaly

baggage_bp = Blueprint('baggage', __name__)


# ---------------------------------------------------------------------------
# Internal / machine-to-machine - no auth required (MQTT bridge + simulator)
# ---------------------------------------------------------------------------

@baggage_bp.route('/events', methods=['POST'])
def ingest_event():
    """Accept a baggage event via HTTP POST and run anomaly detection."""
    payload = request.get_json(silent=True)
    if not payload or not payload.get('tag_id') or not payload.get('checkpoint'):
        return jsonify({'error': 'tag_id and checkpoint are required'}), 400

    result = insert_event(payload)

    # FSM may produce multiple anomalies (e.g. STALL + SECURITY_BYPASS on same scan).
    stored_anomalies = []
    for fsm_a in result.get('anomalies') or []:
        a = {
            'tag_id':      payload['tag_id'],
            'type':        fsm_a['type'],
            'checkpoint':  fsm_a['checkpoint'],
            'score':       1.0,
            'description': fsm_a['description'],
        }
        store_anomaly(a)
        # Device-fed events raise anomalies too, so they must alert staff just
        # like an operator scan does; without this the HTTP ingestion path
        # detected anomalies silently.
        notify_anomaly(a)
        stored_anomalies.append(a)

    return jsonify({'status': 'ok', 'tag_id': payload['tag_id'], 'anomalies': stored_anomalies}), 201


# ---------------------------------------------------------------------------
# Admin + Ground Staff routes
# ---------------------------------------------------------------------------

@baggage_bp.route('/bags', methods=['GET'])
@token_required('admin', 'ground_staff')
def list_bags():
    """
    Return all bags with current status and last checkpoint.
    Staff are uniform - all roles see every bag (no per-checkpoint filter).
    """
    bags = get_all_bags()
    return jsonify({'bags': bags, 'count': len(bags)})


@baggage_bp.route('/bags/<tag_id>/history', methods=['GET'])
@token_required('admin', 'ground_staff')
def bag_history(tag_id):
    """Return the full checkpoint history for a single bag."""
    if not get_bag_by_tag(tag_id):
        return jsonify({'error': f'Bag tag {tag_id} does not exist'}), 404
    events = get_bag_history(tag_id)
    return jsonify({'tag_id': tag_id, 'events': events, 'count': len(events)})


# ---------------------------------------------------------------------------
# State machine - operator scans & actions (real, unscripted input)
# ---------------------------------------------------------------------------

@baggage_bp.route('/bags/<tag_id>/scan', methods=['POST'])
@token_required('admin', 'ground_staff')
def register_scan(tag_id):
    """
    Register a checkpoint scan for an existing bag (handheld / dashboard input).
    Runs the same ingestion → state machine → anomaly pipeline as the device
    feed, but stamped with the operator as the actor.

    Body: {"checkpoint": "security"}
    Staff are uniform - any staff/admin may scan any bag at any checkpoint.
    """
    body       = request.get_json(silent=True) or {}
    checkpoint = (body.get('checkpoint') or '').strip()

    if checkpoint not in CHECKPOINTS:
        return jsonify({'error': f'checkpoint must be one of {CHECKPOINTS}'}), 400

    bag = get_bag_by_tag(tag_id)
    if not bag:
        return jsonify({'error': f'Bag tag {tag_id} does not exist'}), 404

    payload = {
        'tag_id':     tag_id,
        'checkpoint': checkpoint,
        'flight_id':  bag.get('flight_id', 'FL000'),
        'passenger':  bag.get('passenger', 'Unknown'),
    }

    result = insert_event(payload, actor=g.user.get('username', 'staff'))

    # FSM may produce multiple anomalies (e.g. STALL + SECURITY_BYPASS on same scan).
    stored_anomalies = []
    for fsm_a in result.get('anomalies') or []:
        a = {
            'tag_id':      tag_id,
            'type':        fsm_a['type'],
            'checkpoint':  fsm_a['checkpoint'],
            'score':       1.0,
            'description': fsm_a['description'],
        }
        store_anomaly(a)
        notify_anomaly(a)
        stored_anomalies.append(a)

    return jsonify({
        'tag_id':     tag_id,
        'checkpoint': checkpoint,
        'status':     result['status'],
        'anomalies':  stored_anomalies,
    }), 201


@baggage_bp.route('/bags/<tag_id>/action', methods=['POST'])
@token_required('admin', 'ground_staff')
def operator_action(tag_id):
    """
    Apply an operator action to a bag (hold/release/reroute/claim/report_lost/
    found). The state machine validates it; an illegal action -> HTTP 409.

    Body: {"action": "hold"}
    """
    body   = request.get_json(silent=True) or {}
    action = (body.get('action') or '').strip()

    if action not in ACTIONS:
        return jsonify({'error': f'action must be one of {ACTIONS}'}), 400

    try:
        result = apply_operator_action(tag_id, action, actor=g.user.get('username', 'staff'))
    except InvalidTransition as exc:
        return jsonify({'error': str(exc)}), 409

    if result is None:
        return jsonify({'error': f'Bag tag {tag_id} does not exist'}), 404

    return jsonify(result), 200


@baggage_bp.route('/bags/<tag_id>/status-history', methods=['GET'])
@token_required('admin', 'ground_staff')
def bag_status_history(tag_id):
    """Return the auditable state-transition trail for a single bag."""
    if not get_bag_by_tag(tag_id):
        return jsonify({'error': f'Bag tag {tag_id} does not exist'}), 404
    history = get_bag_status_history(tag_id)
    return jsonify({'tag_id': tag_id, 'history': history, 'count': len(history)})


@baggage_bp.route('/stats', methods=['GET'])
@token_required('admin')
def checkpoint_stats():
    """Return event counts per checkpoint. Admin only."""
    stats = get_checkpoint_stats()
    return jsonify({'stats': stats})


@baggage_bp.route('/flights', methods=['GET'])
@token_required('admin', 'ground_staff')
def flight_summaries():
    """Return per-flight baggage summary (includes carousel if set)."""
    flights = get_flight_summaries()
    return jsonify({'flights': flights})


@baggage_bp.route('/flights/<flight_id>/carousel', methods=['PUT'])
@token_required('admin', 'ground_staff')
def set_flight_carousel(flight_id):
    """Assign a carousel/belt number to a flight (staff/admin)."""
    body     = request.get_json(silent=True) or {}
    carousel = (body.get('carousel') or '').strip()
    if not carousel:
        return jsonify({'error': 'carousel is required'}), 400
    row = set_carousel(flight_id, carousel, actor=g.user.get('username'))
    return jsonify(row), 200


# ---------------------------------------------------------------------------
# Public passenger tracking - no login required
# ---------------------------------------------------------------------------

# Passenger-friendly anomaly wording. PRIVACY: never expose internal type names
# (especially "security bypass") on this public surface - passengers see a
# neutral "additional check" message; staff still see the real type elsewhere.
_FRIENDLY = {
    'STALL':           ('Your bag is taking a little longer than usual at {cp}. '
                        'Our team is aware and on it.', 'warning'),
    'WRONG_ROUTE':     ('Your bag was briefly misrouted and is being put back on track.', 'warning'),
    'SECURITY_BYPASS': ('Your bag needs an additional check before it continues.', 'info'),
    'LOST':            ("We're actively locating your bag — please contact support.", 'critical'),
}


def _cp_label(cp) -> str:
    return str(cp or '').replace('_', '-').title() if cp else 'a checkpoint'


def _remaining_checkpoints(last_cp) -> list:
    idx = CHECKPOINTS.index(last_cp) if last_cp in CHECKPOINTS else -1
    return CHECKPOINTS[idx + 1:]


def _friendly_messages(anomalies: list, status: str) -> list:
    """Map a bag's unresolved anomalies to calm, jargon-free passenger notes."""
    if status in ('ARRIVED', 'CLAIMED'):
        return []

    out, seen = [], set()
    for a in anomalies:
        tmpl_level = _FRIENDLY.get(a.get('type'))
        if not tmpl_level:
            continue
        tmpl, level = tmpl_level
        msg = tmpl.format(cp=_cp_label(a.get('checkpoint')))
        if msg not in seen:
            seen.add(msg)
            out.append({'message': msg, 'level': level})
    if not out:  # fall back to the FSM state if no anomaly row carried a message
        if status == 'MISROUTED':
            out.append({'message': _FRIENDLY['WRONG_ROUTE'][0], 'level': 'warning'})
        elif status == 'LOST':
            out.append({'message': _FRIENDLY['LOST'][0], 'level': 'critical'})
        elif status == 'FLAGGED':
            out.append({'message': _FRIENDLY['SECURITY_BYPASS'][0], 'level': 'info'})
    return out


def _public_advisory(a: dict) -> dict:
    return {
        'checkpoint':       a.get('checkpoint'),
        'checkpoint_label': _cp_label(a.get('checkpoint')),
        'level':            a.get('level'),
        'message':          a.get('message'),
    }


def _compute_eta(bag: dict, status: str, anomalies: list, has_advisory: bool):
    """
    Estimate minutes until the bag reaches the carousel from historical dwell
    times. Returns None when an ETA would be misleading (misrouted / lost).
    """
    last_cp = bag.get('last_checkpoint')
    if status in ('ARRIVED', 'CLAIMED') or last_cp == 'arrival':
        return {'at_carousel': True, 'remaining_mins': 0, 'eta_iso': None, 'delayed': False}
    if status in ('MISROUTED', 'LOST'):
        return None

    durations = get_expected_durations()
    remaining = sum(durations.get(cp, 5.0) for cp in _remaining_checkpoints(last_cp))

    # Widen the estimate when the bag is delayed (stall/flag) or a checkpoint
    # ahead is degraded - add one extra expected dwell as a simple buffer.
    delayed = has_advisory or status == 'FLAGGED' or any(
        a.get('type') == 'STALL' for a in anomalies)
    if delayed:
        remaining += durations.get(last_cp, 5.0)

    eta_dt = datetime.now(timezone.utc) + timedelta(minutes=remaining)
    return {
        'at_carousel':    False,
        'remaining_mins': round(remaining),
        'eta_iso':        eta_dt.isoformat(),
        'delayed':        delayed,
    }


@baggage_bp.route('/track', methods=['GET'])
def public_track():
    """
    Public bag lookup - no auth required.
    Primary:  ?booking_ref=ABC123  → returns all bags for that booking (handles
              passengers with multiple bags).
    Fallback: ?flight_id=MH370&passenger=Ahmad  → original single-bag lookup.
    """
    booking_ref = request.args.get('booking_ref', '').strip().upper()
    flight_id   = request.args.get('flight_id', '').strip()
    passenger   = request.args.get('passenger', '').strip()

    def _enrich(bag, events):
        status     = normalize_status(bag.get('status'), bag.get('last_checkpoint'))
        anomalies  = get_anomalies_for_bag(bag['tag_id'], only_unresolved=True)
        messages   = _friendly_messages(anomalies, status)
        remaining  = _remaining_checkpoints(bag.get('last_checkpoint'))
        advisories = [_public_advisory(a) for a in get_advisories(active_only=True)
                      if a.get('checkpoint') in remaining]
        eta        = _compute_eta(bag, status, anomalies, has_advisory=bool(advisories))
        carousel   = get_carousel(bag.get('flight_id', ''))
        return {
            'bag':        bag,
            'events':     events,
            'status':     status,
            'eta':        eta,
            'advisories': advisories,
            'messages':   messages,
            'carousel':   carousel,
        }

    if booking_ref:
        if len(booking_ref) != 6:
            return jsonify({'error': 'Booking reference must be exactly 6 characters'}), 400
        bags_data = get_bags_by_booking_ref(booking_ref)
        if not bags_data:
            return jsonify({'error': 'No bags found for that booking reference. Check you entered it correctly.'}), 404
        results = [_enrich(bag, events) for bag, events in bags_data]
        # Return plural form; single-bag callers can read results[0]
        return jsonify({'bags': results, 'booking_ref': booking_ref})

    # Fallback: legacy flight + passenger search
    if not flight_id or not passenger:
        return jsonify({'error': 'Provide booking_ref, or both flight_id and passenger'}), 400
    if len(passenger) < 2:
        return jsonify({'error': 'Please enter at least 2 characters of your name'}), 400

    bag, events = get_bag_by_passenger(flight_id, passenger)
    if not bag:
        return jsonify({'error': 'No bag found. Check your flight ID and name, or wait until check-in.'}), 404

    return jsonify(_enrich(bag, events))


# ---------------------------------------------------------------------------
# Checkpoint advisories - operator-declared service status
# ---------------------------------------------------------------------------

@baggage_bp.route('/advisories', methods=['GET'])
def list_advisories():
    """
    Public: active (degraded/down) advisories for the landing/track pages.
    Pass ?all=true to get every checkpoint's stored level (for the staff panel).
    """
    show_all = request.args.get('all', '').lower() in ('1', 'true', 'yes')
    rows = get_advisories(active_only=not show_all)
    return jsonify({'advisories': rows})


@baggage_bp.route('/advisories/<checkpoint>', methods=['PUT'])
@token_required('admin', 'ground_staff')
def set_advisory(checkpoint):
    """Set a checkpoint's operational level + message (staff/admin)."""
    if checkpoint not in CHECKPOINTS:
        return jsonify({'error': f'checkpoint must be one of {CHECKPOINTS}'}), 400

    body  = request.get_json(silent=True) or {}
    level = (body.get('level') or '').strip().lower()
    if level not in ADVISORY_LEVELS:
        return jsonify({'error': f'level must be one of {sorted(ADVISORY_LEVELS)}'}), 400

    message = (body.get('message') or '').strip() or None
    row = upsert_advisory(checkpoint, level, message, updated_by=g.user.get('username'))
    return jsonify(row), 200


# ---------------------------------------------------------------------------
# Advisory requests - staff propose, admin approves
# ---------------------------------------------------------------------------

@baggage_bp.route('/advisories/request', methods=['POST'])
@token_required('admin', 'ground_staff')
def request_advisory():
    """Staff submit an advisory change request for admin approval."""
    body  = request.get_json(silent=True) or {}
    checkpoint = (body.get('checkpoint') or '').strip().lower()
    level      = (body.get('level')      or '').strip().lower()
    message    = (body.get('message')    or '').strip() or None

    if checkpoint not in CHECKPOINTS:
        return jsonify({'error': f'checkpoint must be one of {CHECKPOINTS}'}), 400
    if level not in ADVISORY_LEVELS:
        return jsonify({'error': f'level must be one of {sorted(ADVISORY_LEVELS)}'}), 400

    row = create_advisory_request(
        checkpoint=checkpoint, level=level,
        message=message, requested_by=g.user.get('username'),
    )
    return jsonify(row), 201


@baggage_bp.route('/advisories/requests', methods=['GET'])
@token_required('admin')
def list_advisory_requests():
    """Admin: list advisory requests (optionally filter by status)."""
    status = request.args.get('status') or None
    return jsonify({'requests': get_advisory_requests(status=status)})


@baggage_bp.route('/advisories/requests/<int:req_id>/approve', methods=['PUT'])
@token_required('admin')
def approve_advisory_request(req_id):
    """Admin: approve a request - immediately applies the advisory."""
    updated = review_advisory_request(req_id, 'approve', reviewed_by=g.user.get('username'))
    if not updated:
        return jsonify({'error': 'Request not found'}), 404
    return jsonify(updated)


@baggage_bp.route('/advisories/requests/<int:req_id>/reject', methods=['PUT'])
@token_required('admin')
def reject_advisory_request(req_id):
    """Admin: reject a request - no advisory change applied."""
    updated = review_advisory_request(req_id, 'reject', reviewed_by=g.user.get('username'))
    if not updated:
        return jsonify({'error': 'Request not found'}), 404
    return jsonify(updated)


# ---------------------------------------------------------------------------
# Arrival notification opt-in - public
# ---------------------------------------------------------------------------

@baggage_bp.route('/track/notify', methods=['POST'])
def subscribe_arrival():
    """Public: register an email to be notified when a bag reaches ARRIVED."""
    body  = request.get_json(silent=True) or {}
    tag   = (body.get('tag_id') or '').strip()
    email = (body.get('email') or '').strip()

    if not tag or '@' not in email:
        return jsonify({'error': 'A valid tag_id and email are required'}), 400
    if not get_bag_by_tag(tag):
        return jsonify({'error': f'Bag tag {tag} does not exist'}), 404

    add_arrival_subscription(tag, email)
    return jsonify({'status': 'subscribed', 'tag_id': tag}), 201


# ---------------------------------------------------------------------------
# Analytics routes - admin only (Step 4 of feature plan)
# ---------------------------------------------------------------------------

@baggage_bp.route('/stats/anomaly-trend', methods=['GET'])
@token_required('admin')
def anomaly_trend():
    days = request.args.get('days', 14, type=int)
    return jsonify(get_anomaly_trend(days))


@baggage_bp.route('/stats/flight-anomalies', methods=['GET'])
@token_required('admin')
def flight_anomalies():
    return jsonify(get_flight_anomaly_counts())


@baggage_bp.route('/stats/avg-resolution', methods=['GET'])
@token_required('admin')
def avg_resolution():
    return jsonify({'avg_mins': get_avg_resolution_time_minutes()})


@baggage_bp.route('/stats/checkpoint-heatmap', methods=['GET'])
@token_required('admin')
def checkpoint_heatmap():
    return jsonify(get_checkpoint_anomaly_counts())
