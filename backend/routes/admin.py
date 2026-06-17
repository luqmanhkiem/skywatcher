import os
import sys
import threading

from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.database import (
    get_all_users,
    create_user,
    update_user,
    deactivate_user,
    get_user_by_id,
    get_bag_by_tag,
)

# Make the simulator package importable so the dashboard can inject bags
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'simulator'))
from rfid_sim import simulate_one_bag  # noqa: E402

admin_bp = Blueprint('admin', __name__)

VALID_ROLES = {'admin', 'ground_staff'}
VALID_SCENARIOS = {'normal', 'stall', 'wrong-route', 'bypass'}


@admin_bp.route('/admin/users', methods=['GET'])
@token_required('admin')
def list_users():
    """Return all users (no password_hash). Admin only."""
    return jsonify(get_all_users())


@admin_bp.route('/admin/users', methods=['POST'])
@token_required('admin')
def add_user():
    """Create a new user account."""
    data = request.get_json(silent=True) or {}

    username  = (data.get('username') or '').strip()
    password  = data.get('password', '')
    role      = data.get('role', '')
    email     = (data.get('email') or '').strip() or None
    flight_id = (data.get('flight_id') or '').strip() or None
    tag_id    = (data.get('tag_id') or '').strip() or None

    if not username:
        return jsonify({'error': 'username is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400
    if role not in VALID_ROLES:
        return jsonify({'error': f'role must be one of {sorted(VALID_ROLES)}'}), 400
    if email and '@' not in email:
        return jsonify({'error': 'email looks invalid'}), 400

    try:
        user = create_user(
            username=username,
            password=password,
            role=role,
            checkpoint=None,
            email=email,
            flight_id=flight_id,
            tag_id=tag_id,
        )
    except Exception as exc:
        if 'UNIQUE constraint' in str(exc):
            return jsonify({'error': f'Username "{username}" already exists'}), 409
        raise

    return jsonify(user), 201


@admin_bp.route('/admin/users/<int:user_id>', methods=['PATCH'])
@token_required('admin')
def edit_user(user_id):
    """Update mutable fields on a user."""
    data = request.get_json(silent=True) or {}

    # Guard: prevent demoting the last admin
    if data.get('role') and data['role'] != 'admin':
        target = get_user_by_id(user_id)
        if target and target['role'] == 'admin':
            all_users = get_all_users()
            admin_count = sum(1 for u in all_users if u['role'] == 'admin' and u['active'])
            if admin_count <= 1:
                return jsonify({'error': 'Cannot change role: this is the only active admin'}), 409

    updated = update_user(user_id, data)
    if updated is None:
        return jsonify({'error': 'User not found or no valid fields to update'}), 404

    return jsonify(updated)


@admin_bp.route('/admin/users/<int:user_id>/deactivate', methods=['PATCH'])
@token_required('admin')
def disable_user(user_id):
    """Soft-delete a user (set active = 0)."""
    # Guard: no self-deactivation
    if g.user['sub'] == user_id:
        return jsonify({'error': 'You cannot deactivate your own account'}), 409

    # Guard: cannot remove last active admin
    target = get_user_by_id(user_id)
    if target and target['role'] == 'admin':
        all_users = get_all_users()
        admin_count = sum(1 for u in all_users if u['role'] == 'admin' and u['active'])
        if admin_count <= 1:
            return jsonify({'error': 'Cannot deactivate: this is the only active admin'}), 409

    ok = deactivate_user(user_id)
    if not ok:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'id': user_id, 'active': False})


@admin_bp.route('/admin/simulate', methods=['POST'])
@token_required('admin')
def simulate_inject_bag():
    """
    Inject a single operator-supplied bag into the live MQTT stream.
    Runs the simulation in a background thread so the request returns
    immediately; events flow through the existing MQTT → DB → ML pipeline.
    """
    data = request.get_json(silent=True) or {}

    tag_id    = (data.get('tag_id')    or '').strip()
    passenger = (data.get('passenger') or '').strip()
    flight_id = (data.get('flight_id') or '').strip()
    scenario  = (data.get('scenario')  or 'normal').strip()

    try:
        speed = float(data.get('speed', 1.0))
    except (TypeError, ValueError):
        return jsonify({'error': 'speed must be a number'}), 400

    if not tag_id:
        return jsonify({'error': 'tag_id is required'}), 400
    if not passenger:
        return jsonify({'error': 'passenger is required'}), 400
    if not flight_id:
        return jsonify({'error': 'flight_id is required'}), 400
    if scenario not in VALID_SCENARIOS:
        return jsonify({'error': f'scenario must be one of {sorted(VALID_SCENARIOS)}'}), 400
    if speed < 0.1 or speed > 5.0:
        return jsonify({'error': 'speed must be between 0.1 and 5.0'}), 400

    if get_bag_by_tag(tag_id):
        return jsonify({'error': f'Tag "{tag_id}" already exists in the system'}), 409

    threading.Thread(
        target=simulate_one_bag,
        args=(tag_id, passenger, flight_id, scenario, speed),
        daemon=True,
    ).start()

    return jsonify({
        'status':    'queued',
        'tag_id':    tag_id,
        'passenger': passenger,
        'flight_id': flight_id,
        'scenario':  scenario,
        'speed':     speed,
    }), 202
