import json
import os
import paho.mqtt.client as mqtt
from dotenv import load_dotenv

from models.database import insert_event
from models.anomaly import detect_anomaly, store_anomaly

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_TOPIC = os.getenv('MQTT_TOPIC', 'baggage/events')


def on_connect(client, userdata, flags, reason_code, properties=None):
    print(f'[MQTT] Connected to broker at {MQTT_HOST}:{MQTT_PORT}')
    client.subscribe(MQTT_TOPIC)
    print(f'[MQTT] Subscribed to topic: {MQTT_TOPIC}')


def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode('utf-8'))
        print(f'[MQTT] Event received: {payload}')

        # Store event in DB
        insert_event(payload)

        # Run anomaly detection
        anomaly = detect_anomaly(payload)
        if anomaly:
            store_anomaly(anomaly)
            print(f'[ANOMALY] {anomaly["type"]} detected for bag {payload.get("tag_id")}')

    except Exception as e:
        print(f'[MQTT] Error processing message: {e}')


def on_disconnect(client, userdata, flags, reason_code, properties=None):
    print(f'[MQTT] Disconnected. Reason: {reason_code}')


def start_mqtt_client():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        client.loop_forever()
    except Exception as e:
        print(f'[MQTT] Failed to connect to broker: {e}')
        print('[MQTT] Make sure Mosquitto is running.')
