"""
JWT authentication decorator for SkyWatcher.

Usage:
    @token_required('admin', 'ground_staff')
    def my_route():
        # g.user = { 'sub': 1, 'username': '...', 'role': '...' }
        ...

Passing no roles allows any authenticated user:
    @token_required()
    def open_to_all_logged_in():
        ...
"""
import os
from functools import wraps

import jwt
from flask import g, jsonify, request

SECRET = os.getenv('JWT_SECRET', 'dev-secret-skywatcher')
ALGO = 'HS256'


def token_required(*allowed_roles):
    """
    Decorator factory that validates the Bearer JWT and enforces role access.
    Sets flask.g.user to the decoded token payload on success.
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Authentication required'}), 401

            token = auth_header[7:]
            try:
                payload = jwt.decode(token, SECRET, algorithms=[ALGO])
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired — please log in again'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token'}), 401

            if allowed_roles and payload.get('role') not in allowed_roles:
                return jsonify({'error': 'You do not have permission to access this resource'}), 403

            g.user = payload
            return f(*args, **kwargs)
        return wrapper
    return decorator


def make_token(user: dict) -> str:
    """
    Issue a signed JWT for the given user dict.
    Token expires after JWT_EXPIRY_HOURS hours (default 8).
    """
    import datetime

    expiry_hours = int(os.getenv('JWT_EXPIRY_HOURS', 8))
    payload = {
        'sub':       str(user['id']),
        'username':  user['username'],
        'role':      user['role'],
        'flight_id': user.get('flight_id'),
        'tag_id':    user.get('tag_id'),
        'exp':       datetime.datetime.utcnow() + datetime.timedelta(hours=expiry_hours),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)
