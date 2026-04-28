from flask import Blueprint, jsonify, request, g

from auth import token_required
from models.database import get_alerts, get_db, resolve_alert as db_resolve_alert

alerts_bp = Blueprint('alerts', __name__)


@alerts_bp.route('/alerts', methods=['GET'])
@token_required('admin', 'ground_staff')
def list_alerts():
    limit  = request.args.get('limit', 50, type=int)
    alerts = get_alerts(limit=limit)

    if g.user['role'] == 'ground_staff':
        cp     = g.user.get('checkpoint')
        alerts = [a for a in alerts if a.get('checkpoint') == cp]

    unresolved = sum(1 for a in alerts if not a.get('resolved'))
    return jsonify({'alerts': alerts, 'total': len(alerts), 'unresolved': unresolved})


@alerts_bp.route('/alerts/<int:alert_id>/resolve', methods=['PATCH'])
@token_required('admin', 'ground_staff')
def resolve_alert(alert_id):
    if g.user['role'] == 'ground_staff':
        db   = get_db()
        resp = db.table('anomalies').select('checkpoint').eq('id', alert_id).limit(1).execute()
        if not resp.data:
            return jsonify({'error': 'Alert not found'}), 404
        if resp.data[0]['checkpoint'] != g.user.get('checkpoint'):
            return jsonify({'error': 'You can only resolve alerts for your checkpoint'}), 403

    result = db_resolve_alert(alert_id)
    if not result:
        return jsonify({'error': 'Alert not found'}), 404
    return jsonify({'id': alert_id, 'resolved': True})
