from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.database import (
    get_all_users,
    create_user,
    update_user,
    deactivate_user,
    get_user_by_id,
)

admin_bp = Blueprint('admin', __name__)

VALID_ROLES = {'admin', 'ground_staff', 'passenger'}
VALID_CHECKPOINTS = {'check_in', 'security', 'sorting', 'loading', 'arrival'}


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

    username   = (data.get('username') or '').strip()
    password   = data.get('password', '')
    role       = data.get('role', '')
    checkpoint = data.get('checkpoint') or None
    flight_id  = (data.get('flight_id') or '').strip() or None
    tag_id     = (data.get('tag_id') or '').strip() or None

    if not username:
        return jsonify({'error': 'username is required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'password must be at least 6 characters'}), 400
    if role not in VALID_ROLES:
        return jsonify({'error': f'role must be one of {sorted(VALID_ROLES)}'}), 400
    if role == 'ground_staff' and checkpoint and checkpoint not in VALID_CHECKPOINTS:
        return jsonify({'error': f'checkpoint must be one of {sorted(VALID_CHECKPOINTS)}'}), 400

    try:
        user = create_user(
            username=username,
            password=password,
            role=role,
            checkpoint=checkpoint,
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
