"""
SkyWatcher RFID Simulator
Generates fake baggage tag events and publishes them to MQTT.
Simulates both normal flows and anomalies (stalls, wrong routes, security bypasses).
"""
import json
import os
import random
import threading
import time
from datetime import datetime
from typing import Optional

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_TOPIC = os.getenv('MQTT_TOPIC', 'baggage/events')

CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

FLIGHTS = ['MH370', 'AK802', 'MH122', 'D7201', 'FY103']

PASSENGERS = [
    'Ahmad Luqmanul', 'Siti Nabilah', 'Raj Kumar', 'Nurul Ain',
    'Wei Liang', 'Fatimah Zahra', 'Kevin Tan', 'Amirah Husna',
    'Danial Aqil', 'Priya Nair',
]

# Normal duration range at each checkpoint (minutes)
NORMAL_DURATIONS = {
    'check_in': (3, 8),
    'security': (2, 6),
    'sorting':  (4, 10),
    'loading':  (5, 12),
    'arrival':  (1, 4),
}

# Anomaly injection probabilities per bag
ANOMALY_STALL_PROB       = 0.15   # 15% chance bag stalls at some checkpoint
ANOMALY_WRONG_ROUTE_PROB = 0.10   # 10% chance bag skips sorting (wrong route)
ANOMALY_BYPASS_PROB      = 0.10   # 10% chance bag skips security entirely

# ---------------------------------------------------------------------------


def _pick_anomaly() -> Optional[str]:
    r = random.random()
    if r < ANOMALY_BYPASS_PROB:
        return 'security_bypass'
    if r < ANOMALY_BYPASS_PROB + ANOMALY_STALL_PROB:
        return 'stall'
    if r < ANOMALY_BYPASS_PROB + ANOMALY_STALL_PROB + ANOMALY_WRONG_ROUTE_PROB:
        return 'wrong_route'
    return None


def generate_bags(n: int = 10) -> list[dict]:
    bags = []
    for i in range(1, n + 1):
        bags.append({
            'tag_id':    f'TAG-{1000 + i}',
            'flight_id': random.choice(FLIGHTS),
            'passenger': PASSENGERS[i - 1],
            'anomaly':   _pick_anomaly(),
        })
    return bags


def simulate_bag(client: mqtt.Client, bag: dict):
    tag_id    = bag['tag_id']
    flight_id = bag['flight_id']
    passenger = bag['passenger']
    anomaly   = bag['anomaly']

    print(f'\n[SIM] Starting {tag_id} ({passenger}) on {flight_id} | anomaly={anomaly}')

    checkpoints = CHECKPOINTS.copy()

    # Inject wrong_route: skip sorting, go straight to loading
    if anomaly == 'wrong_route':
        checkpoints = ['check_in', 'security', 'loading', 'arrival']
        print(f'[SIM] {tag_id} will skip sorting (wrong route)')

    # Inject security_bypass: skip security step entirely
    elif anomaly == 'security_bypass':
        checkpoints = ['check_in', 'sorting', 'loading', 'arrival']
        print(f'[SIM] {tag_id} will skip security (bypass)')

    # Pre-select the one checkpoint that will stall (fixes multi-stall bug)
    stall_at = random.choice(checkpoints) if anomaly == 'stall' else None

    for cp in checkpoints:
        low, high = NORMAL_DURATIONS.get(cp, (3, 8))
        duration  = round(random.uniform(low, high), 1)

        if cp == stall_at:
            duration = round(random.uniform(22, 35), 1)
            print(f'[SIM] {tag_id} STALL at {cp} for {duration}m')

        payload = {
            'tag_id':        tag_id,
            'flight_id':     flight_id,
            'passenger':     passenger,
            'checkpoint':    cp,
            'duration_mins': duration,
            'timestamp':     datetime.utcnow().isoformat(),
        }

        client.publish(MQTT_TOPIC, json.dumps(payload))
        print(f'[SIM] Published: {tag_id} → {cp} ({duration}m)')

        # Wait 5–30 s before the bag reaches the next checkpoint
        time.sleep(random.uniform(5, 30))


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f'[SIM] Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}')
    else:
        print(f'[SIM] Connection failed with code {reason_code}')


def main():
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect

    print(f'[SIM] Connecting to {MQTT_HOST}:{MQTT_PORT}...')
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    time.sleep(1)  # Wait for broker handshake

    bags = generate_bags(10)
    print(f'[SIM] Generated {len(bags)} bags\n')
    for b in bags:
        print(f'      {b["tag_id"]}  {b["flight_id"]}  {b["passenger"]}  anomaly={b["anomaly"]}')

    threads = []
    for i, bag in enumerate(bags):
        time.sleep(random.uniform(0.5, 2))  # Stagger bag start times
        t = threading.Thread(target=simulate_bag, args=(client, bag), daemon=True)
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    print('\n[SIM] All bags processed. Simulation complete.')
    client.loop_stop()
    client.disconnect()


if __name__ == '__main__':
    main()
