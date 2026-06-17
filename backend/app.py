import os
import threading
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from models.database import init_db, seed_users
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


@app.route('/api/health')
def health():
    return {'status': 'ok', 'service': 'SkyWatcher API'}


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
