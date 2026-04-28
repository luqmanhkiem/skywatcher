from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.anomaly import detect_anomaly, store_anomaly
from models.database import (
    get_all_bags,
    get_bag_by_passenger,
    get_bag_by_tag,
    get_bag_history,
    get_checkpoint_stats,
    get_flight_summaries,
    get_anomaly_trend,
    get_flight_anomaly_counts,
    get_avg_resolution_time_minutes,
    get_checkpoint_anomaly_counts,
    insert_event,
)

baggage_bp = Blueprint('baggage', __name__)


# ---------------------------------------------------------------------------
# Internal / machine-to-machine — no auth required (MQTT bridge + simulator)
# ---------------------------------------------------------------------------

@baggage_bp.route('/events', methods=['POST'])
def ingest_event():
    """Accept a baggage event via HTTP POST and run anomaly detection."""
    payload = request.get_json(silent=True)
    if not payload or not payload.get('tag_id') or not payload.get('checkpoint'):
        return jsonify({'error': 'tag_id and checkpoint are required'}), 400

    insert_event(payload)

    anomaly = detect_anomaly(payload)
    if anomaly:
        store_anomaly(anomaly)

    return jsonify({'status': 'ok', 'tag_id': payload['tag_id'], 'anomaly': anomaly}), 201


# ---------------------------------------------------------------------------
# Admin + Ground Staff routes
# ---------------------------------------------------------------------------

@baggage_bp.route('/bags', methods=['GET'])
@token_required('admin', 'ground_staff')
def list_bags():
    """
    Return all bags with current status and last checkpoint.
    Ground staff only see bags currently at their assigned checkpoint.
    """
    bags = get_all_bags()
    if g.user['role'] == 'ground_staff':
        cp = g.user.get('checkpoint')
        bags = [b for b in bags if b.get('last_checkpoint') == cp]
    return jsonify({'bags': bags, 'count': len(bags)})


@baggage_bp.route('/bags/<tag_id>/history', methods=['GET'])
@token_required('admin', 'ground_staff')
def bag_history(tag_id):
    """Return the full checkpoint history for a single bag."""
    if not get_bag_by_tag(tag_id):
        return jsonify({'error': f'Bag tag {tag_id} does not exist'}), 404
    events = get_bag_history(tag_id)
    return jsonify({'tag_id': tag_id, 'events': events, 'count': len(events)})


@baggage_bp.route('/stats', methods=['GET'])
@token_required('admin')
def checkpoint_stats():
    """Return event counts per checkpoint. Admin only."""
    stats = get_checkpoint_stats()
    return jsonify({'stats': stats})


@baggage_bp.route('/flights', methods=['GET'])
@token_required('admin', 'ground_staff')
def flight_summaries():
    """Return per-flight baggage summary."""
    flights = get_flight_summaries()
    return jsonify({'flights': flights})


# ---------------------------------------------------------------------------
# Passenger routes — scoped to g.user['tag_id'] only
# ---------------------------------------------------------------------------

@baggage_bp.route('/passenger/bag', methods=['GET'])
@token_required('passenger')
def passenger_bag():
    """Return the single bag belonging to the logged-in passenger."""
    tag_id = g.user.get('tag_id')
    if not tag_id:
        return jsonify({'error': 'No bag tag linked to this account'}), 404

    bag = get_bag_by_tag(tag_id)
    if not bag:
        return jsonify({'error': 'Bag not found — tracking will begin once your bag is scanned'}), 404

    return jsonify({'bag': bag})


@baggage_bp.route('/passenger/bag/history', methods=['GET'])
@token_required('passenger')
def passenger_bag_history():
    """Return the full checkpoint history for the passenger's own bag."""
    tag_id = g.user.get('tag_id')
    if not tag_id:
        return jsonify({'error': 'No bag tag linked to this account'}), 404

    events = get_bag_history(tag_id)
    return jsonify({'tag_id': tag_id, 'events': events, 'count': len(events)})


# ---------------------------------------------------------------------------
# Public passenger tracking — no login required
# ---------------------------------------------------------------------------

@baggage_bp.route('/track', methods=['GET'])
def public_track():
    """
    Public endpoint: look up a bag by flight_id + passenger name.
    No authentication required — designed for the passenger self-service page.
    Query params: ?flight_id=MH370&passenger=Ahmad
    """
    flight_id = request.args.get('flight_id', '').strip()
    passenger = request.args.get('passenger', '').strip()

    if not flight_id or not passenger:
        return jsonify({'error': 'flight_id and passenger are required'}), 400

    if len(passenger) < 2:
        return jsonify({'error': 'Please enter at least 2 characters of your name'}), 400

    bag, events = get_bag_by_passenger(flight_id, passenger)

    if not bag:
        return jsonify({'error': 'No bag found. Check your flight ID and name, or wait until check-in.'}), 404

    return jsonify({'bag': bag, 'events': events})


# ---------------------------------------------------------------------------
# Analytics routes — admin only (Step 4 of feature plan)
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
