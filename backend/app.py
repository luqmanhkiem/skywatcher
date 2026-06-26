import os
import threading
import time
from datetime import datetime, timezone
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from models.database import (
    init_db, seed_users, get_db, insert_anomaly, get_anomalies_for_bag,
    _insert_status_history,
)
from notifier import notify_anomaly
from mqtt_client import start_mqtt_client
from routes.baggage import baggage_bp
from routes.alerts import alerts_bp
from routes.auth import auth_bp
from routes.admin import admin_bp
from routes.feedback import feedback_bp

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app, supports_credentials=True)

app.register_blueprint(baggage_bp, url_prefix='/api')
app.register_blueprint(alerts_bp, url_prefix='/api')
app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')
app.register_blueprint(feedback_bp, url_prefix='/api')


STALL_THRESHOLD_MINS = float(os.getenv('ANOMALY_STALL_THRESHOLD_MINUTES', 20))
# Non-terminal, non-exception states where a bag can go idle
_ACTIVE_STATES = {'REGISTERED', 'SCREENED', 'SORTED', 'LOADED'}


def _stall_checker():
    """Background thread: flag bags idle at a checkpoint longer than the stall threshold."""
    while True:
        time.sleep(60)
        try:
            db = get_db()
            resp = (db.table('bags')
                      .select('tag_id, status, last_checkpoint, last_seen')
                      .execute())
            now = datetime.now(timezone.utc)
            for bag in (resp.data or []):
                status = (bag.get('status') or '').upper()
                if status not in _ACTIVE_STATES:
                    continue
                last_seen_raw = bag.get('last_seen')
                if not last_seen_raw:
                    continue
                try:
                    last_seen = datetime.fromisoformat(last_seen_raw.replace('Z', '+00:00'))
                    if last_seen.tzinfo is None:
                        last_seen = last_seen.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
                idle_mins = (now - last_seen).total_seconds() / 60
                if idle_mins < STALL_THRESHOLD_MINS:
                    continue
                tag_id = bag['tag_id']
                checkpoint = bag.get('last_checkpoint') or 'unknown'
                # Only raise one unresolved STALL per bag
                if any(a.get('type') == 'STALL'
                       for a in get_anomalies_for_bag(tag_id, only_unresolved=True)):
                    continue
                description = (
                    f'Bag idle at {checkpoint} for {idle_mins:.0f} min '
                    f'(threshold: {STALL_THRESHOLD_MINS:.0f} min).'
                )
                insert_anomaly(tag_id, 'STALL', description, checkpoint, 0.95)
                # Transition bag to FLAGGED
                db.table('bags').update({'status': 'FLAGGED'}).eq('tag_id', tag_id).execute()
                _insert_status_history(
                    tag_id, status, 'FLAGGED',
                    trigger='stall:timeout', actor='system', checkpoint=checkpoint,
                )
                anomaly_payload = {
                    'tag_id': tag_id, 'type': 'STALL',
                    'checkpoint': checkpoint, 'score': 0.95,
                    'description': description,
                }
                try:
                    notify_anomaly(anomaly_payload)
                except Exception as notify_exc:
                    print(f'[SkyWatcher] stall notify error: {notify_exc}')
                print(f'[SkyWatcher] STALL: {tag_id} idle {idle_mins:.0f} min at {checkpoint} → FLAGGED')
        except Exception as exc:
            print(f'[SkyWatcher] stall-checker error: {exc}')


@app.route('/api/health')
def health():
    return {'status': 'ok', 'service': 'SkyWatcher API'}


# Start background stall checker regardless of how Flask is invoked
_stall_thread = threading.Thread(target=_stall_checker, daemon=True)
_stall_thread.start()
print('[SkyWatcher] Stall checker started.')


if __name__ == '__main__':
    init_db()
    print('[SkyWatcher] Database initialised.')

    seed_users()

    mqtt_thread = threading.Thread(target=start_mqtt_client, daemon=True)
    mqtt_thread.start()
    print('[SkyWatcher] MQTT client started.')

    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    print(f'[SkyWatcher] Flask running on http://localhost:{port}')
    app.run(host='0.0.0.0', port=port, debug=debug, use_reloader=False)
