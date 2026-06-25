import random
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.database import (
    auto_assign_carousel,
    get_all_users,
    create_user,
    update_user,
    deactivate_user,
    get_user_by_id,
    get_bag_by_tag,
    insert_event,
)

admin_bp = Blueprint('admin', __name__)

_BOOKING_REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/O/1/I

def _gen_booking_ref() -> str:
    return ''.join(random.choices(_BOOKING_REF_CHARS, k=6))


@admin_bp.route('/admin/booking-ref', methods=['GET'])
@token_required('admin', 'ground_staff')
def gen_booking_ref():
    """Generate a fresh 6-character booking reference."""
    return jsonify({'booking_ref': _gen_booking_ref()})

VALID_ROLES = {'admin', 'ground_staff'}


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
    name      = (data.get('name') or '').strip() or None
    email     = (data.get('email') or '').strip() or None
    flight_id = (data.get('flight_id') or '').strip() or None
    tag_id    = (data.get('tag_id') or '').strip() or None

    if not username:
        return jsonify({'error': 'username is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400
    if role not in VALID_ROLES:
        return jsonify({'error': f'role must be one of {sorted(VALID_ROLES)}'}), 400
    if not email:
        return jsonify({'error': 'email is required'}), 400
    if '@' not in email:
        return jsonify({'error': 'email looks invalid'}), 400

    try:
        user = create_user(
            username=username,
            password=password,
            role=role,
            name=name,
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
    Register one bag at check_in and auto-assign a belt.
    The bag then waits for operator scans at each subsequent checkpoint.
    """
    data = request.get_json(silent=True) or {}

    tag_id      = (data.get('tag_id')      or '').strip()
    passenger   = (data.get('passenger')   or '').strip()
    flight_id   = (data.get('flight_id')   or '').strip().upper()
    booking_ref = (data.get('booking_ref') or '').strip().upper() or _gen_booking_ref()

    if not tag_id:
        return jsonify({'error': 'tag_id is required'}), 400
    if not passenger:
        return jsonify({'error': 'passenger is required'}), 400
    if not flight_id:
        return jsonify({'error': 'flight_id is required'}), 400

    if get_bag_by_tag(tag_id):
        return jsonify({'error': f'Tag "{tag_id}" already exists in the system'}), 409

    actor = g.user.get('username', 'admin')

    insert_event({
        'tag_id':       tag_id,
        'flight_id':    flight_id,
        'passenger':    passenger,
        'booking_ref':  booking_ref,
        'checkpoint':   'check_in',
        'timestamp':    datetime.now(timezone.utc).isoformat(),
    }, actor=actor)

    belt = auto_assign_carousel(flight_id, actor=actor)

    return jsonify({
        'status':       'registered',
        'tag_id':       tag_id,
        'passenger':    passenger,
        'flight_id':    flight_id,
        'booking_ref':  booking_ref,
        'belt':         belt,
    }), 201
