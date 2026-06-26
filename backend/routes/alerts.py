from flask import Blueprint, jsonify, request

from auth import token_required
from models.database import get_alerts, resolve_alert as db_resolve_alert

alerts_bp = Blueprint('alerts', __name__)


@alerts_bp.route('/alerts', methods=['GET'])
@token_required('admin', 'ground_staff')
def list_alerts():
    limit  = request.args.get('limit', 50, type=int)
    alerts = get_alerts(limit=limit)

    unresolved = sum(1 for a in alerts if not a.get('resolved'))
    return jsonify({'alerts': alerts, 'total': len(alerts), 'unresolved': unresolved})


@alerts_bp.route('/alerts/<int:alert_id>/resolve', methods=['PATCH'])
@token_required('admin', 'ground_staff')
def resolve_alert(alert_id):
    result = db_resolve_alert(alert_id)
    if not result:
        return jsonify({'error': 'Alert not found'}), 404
    return jsonify({'id': alert_id, 'resolved': True})
