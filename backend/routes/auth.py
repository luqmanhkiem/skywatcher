import os
import time
from collections import defaultdict
from flask import Blueprint, jsonify, request, g

from auth import make_token, token_required
from models.database import (
    verify_password, get_user_by_email,
    create_reset_token, verify_and_consume_reset_token, update_user_password,
)

auth_bp = Blueprint('auth', __name__)

# In-memory brute-force protection: {username: [timestamp, ...]}
_login_attempts: dict = defaultdict(list)
_RATE_LIMIT_MAX     = 5    # max failed attempts
_RATE_LIMIT_WINDOW  = 60   # seconds


def _check_rate_limit(username: str) -> bool:
    """Return True if the username is currently rate-limited."""
    now = time.time()
    attempts = _login_attempts[username]
    # Prune attempts outside the window
    _login_attempts[username] = [t for t in attempts if now - t < _RATE_LIMIT_WINDOW]
    return len(_login_attempts[username]) >= _RATE_LIMIT_MAX


def _record_failed_attempt(username: str) -> None:
    _login_attempts[username].append(time.time())


@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """
    POST /api/auth/login
    Body: { "username": "...", "password": "..." }
    Returns: { "token": "...", "user": { username, role, flight_id, tag_id } }
    """
    body = request.get_json(silent=True) or {}
    username = body.get('username', '').strip()
    password = body.get('password', '')

    if not username or not password:
        return jsonify({'error': 'username and password are required'}), 400

    if _check_rate_limit(username):
        return jsonify({'error': 'Too many login attempts. Please wait 60 seconds.'}), 429

    user = verify_password(username, password)
    if not user:
        _record_failed_attempt(username)
        return jsonify({'error': 'Invalid username or password'}), 401

    token = make_token(user)

    return jsonify({
        'token': token,
        'user': {
            'id':        user['id'],
            'username':  user['username'],
            'name':      user.get('name'),
            'role':      user['role'],
            'email':     user.get('email'),
            'flight_id': user.get('flight_id'),
            'tag_id':    user.get('tag_id'),
        },
    })


@auth_bp.route('/auth/me', methods=['GET'])
@token_required()
def me():
    """
    GET /api/auth/me
    Validates the current token and returns the decoded user payload.
    Used by the frontend on page load to re-hydrate auth state.
    """
    return jsonify({
        'user': {
            'id':        g.user.get('sub'),
            'username':  g.user.get('username'),
            'name':      g.user.get('name'),
            'role':      g.user.get('role'),
            'flight_id': g.user.get('flight_id'),
            'tag_id':    g.user.get('tag_id'),
        }
    })


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    """JWT is stateless — client removes the token from localStorage."""
    return jsonify({'status': 'ok'})


@auth_bp.route('/auth/forgot-password', methods=['POST'])
def forgot_password():
    """
    POST /api/auth/forgot-password
    Body: { "email": "user@example.com" }
    Generates a 1-hour reset token and emails a reset link.
    Always returns 200 to avoid leaking whether an email is registered.
    """
    body  = request.get_json(silent=True) or {}
    email = (body.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'email is required'}), 400

    user = get_user_by_email(email)
    if user:
        token       = create_reset_token(user['id'])
        frontend    = os.getenv('FRONTEND_URL', 'http://localhost:5173')
        reset_url   = f'{frontend}/reset-password?token={token}'
        try:
            from notifier import notify_password_reset
            notify_password_reset(email, user.get('name') or user['username'], reset_url)
        except Exception as exc:
            print(f'[AUTH] Password reset email failed: {exc}')

    # Always return 200 — don't reveal whether the email is registered
    return jsonify({'status': 'ok',
                    'message': 'If that email is registered you will receive a reset link shortly.'}), 200


@auth_bp.route('/auth/reset-password', methods=['POST'])
def reset_password():
    """
    POST /api/auth/reset-password
    Body: { "token": "...", "password": "newpassword" }
    Validates the reset token and updates the user's password.
    """
    body     = request.get_json(silent=True) or {}
    token    = (body.get('token') or '').strip()
    password = body.get('password', '')

    if not token or not password:
        return jsonify({'error': 'token and password are required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    try:
        user = verify_and_consume_reset_token(token)
    except Exception:
        import traceback
        print('[AUTH] reset-password lookup failed:')
        traceback.print_exc()
        return jsonify({'error': 'Reset failed. The link may have expired.'}), 500

    if not user:
        return jsonify({'error': 'Reset link is invalid or has expired'}), 400

    update_user_password(user['id'], password)
    return jsonify({'status': 'ok', 'message': 'Password updated — please sign in with your new password.'}), 200
