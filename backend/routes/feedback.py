import time
from collections import defaultdict

from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.database import insert_feedback, get_feedback, update_feedback

feedback_bp = Blueprint('feedback', __name__)

VALID_CATEGORIES = {
    'lost_bag', 'damaged_bag', 'delayed_bag', 'complaint', 'suggestion', 'other',
}
VALID_STATUSES = {'new', 'in_review', 'resolved'}

MAX_MESSAGE_LEN = 2000

# In-memory per-IP rate limit for the public submit endpoint: {ip: [timestamps]}
_submit_history: dict = defaultdict(list)
_RATE_LIMIT_MAX    = 5    # max submissions
_RATE_LIMIT_WINDOW = 60   # seconds


def _is_rate_limited(ip: str) -> bool:
    now = time.time()
    _submit_history[ip] = [t for t in _submit_history[ip] if now - t < _RATE_LIMIT_WINDOW]
    return len(_submit_history[ip]) >= _RATE_LIMIT_MAX


@feedback_bp.route('/feedback', methods=['POST'])
def submit_feedback():
    """
    Public endpoint - a passenger submits a feedback / issue report.
    No authentication required, but rate-limited per IP to deter spam.
    """
    ip = request.headers.get('X-Forwarded-For', request.remote_addr or 'unknown').split(',')[0].strip()
    if _is_rate_limited(ip):
        return jsonify({'error': 'Too many submissions. Please wait a minute and try again.'}), 429

    data = request.get_json(silent=True) or {}

    name     = (data.get('name')     or '').strip()
    email    = (data.get('email')    or '').strip() or None
    flight   = (data.get('flight_id') or '').strip() or None
    tag      = (data.get('tag_id')    or '').strip() or None
    category = (data.get('category') or '').strip()
    message  = (data.get('message')  or '').strip()

    if not name:
        return jsonify({'error': 'name is required'}), 400
    if category not in VALID_CATEGORIES:
        return jsonify({'error': f'category must be one of {sorted(VALID_CATEGORIES)}'}), 400
    if not message:
        return jsonify({'error': 'message is required'}), 400
    if len(message) > MAX_MESSAGE_LEN:
        return jsonify({'error': f'message must be {MAX_MESSAGE_LEN} characters or fewer'}), 400

    row = insert_feedback({
        'name':      name,
        'email':     email,
        'flight_id': flight,
        'tag_id':    tag,
        'category':  category,
        'message':   message,
    })

    _submit_history[ip].append(time.time())

    return jsonify({
        'status':  'received',
        'id':      row.get('id'),
        'message': 'Thank you — your report has been received. Our team will follow up.',
    }), 201


@feedback_bp.route('/feedback', methods=['GET'])
@token_required('admin', 'ground_staff')
def list_feedback():
    """Staff inbox - all tickets newest-first plus per-status counts."""
    limit   = request.args.get('limit', 100, type=int)
    tickets = get_feedback(limit=limit)

    counts = {
        'new':       sum(1 for t in tickets if t.get('status') == 'new'),
        'in_review': sum(1 for t in tickets if t.get('status') == 'in_review'),
        'resolved':  sum(1 for t in tickets if t.get('status') == 'resolved'),
    }
    return jsonify({'feedback': tickets, 'total': len(tickets), 'counts': counts})


@feedback_bp.route('/feedback/<int:feedback_id>', methods=['PATCH'])
@token_required('admin', 'ground_staff')
def patch_feedback(feedback_id):
    """Staff update a ticket's status and/or notes."""
    data = request.get_json(silent=True) or {}

    fields = {}
    if 'status' in data:
        status = (data.get('status') or '').strip()
        if status not in VALID_STATUSES:
            return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400
        fields['status'] = status
        # Stamp who resolved it
        if status == 'resolved':
            fields['resolved_by'] = g.user.get('username')
    if 'staff_notes' in data:
        fields['staff_notes'] = (data.get('staff_notes') or '').strip()

    if not fields:
        return jsonify({'error': 'No valid fields to update'}), 400

    updated = update_feedback(feedback_id, fields)
    if updated is None:
        return jsonify({'error': 'Feedback ticket not found'}), 404

    return jsonify(updated)
