import time
from collections import defaultdict
from flask import Blueprint, jsonify, request, g

from auth import make_token, token_required
from models.database import verify_password

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
    Returns: { "token": "...", "user": { username, role, checkpoint, flight_id, tag_id } }
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
            'id':         user['id'],
            'username':   user['username'],
            'role':       user['role'],
            'checkpoint': user.get('checkpoint'),
            'flight_id':  user.get('flight_id'),
            'tag_id':     user.get('tag_id'),
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
            'id':         g.user.get('sub'),
            'username':   g.user.get('username'),
            'role':       g.user.get('role'),
            'checkpoint': g.user.get('checkpoint'),
            'flight_id':  g.user.get('flight_id'),
            'tag_id':     g.user.get('tag_id'),
        }
    })


@auth_bp.route('/auth/logout', methods=['POST'])
def logout():
    """
    POST /api/auth/logout
    JWT is stateless — the server has nothing to invalidate.
    The client removes the token from localStorage on receiving this response.
    """
    return jsonify({'status': 'ok'})
