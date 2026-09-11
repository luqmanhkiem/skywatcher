"""
SkyWatcher RFID Simulator
Generates fake baggage tag events and publishes them to MQTT.
Simulates both normal flows and anomalies (stalls, wrong routes, security bypasses).
"""
import argparse
import json
import os
import random
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import paho.mqtt.client as mqtt
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MQTT_HOST = os.getenv('MQTT_HOST', 'localhost')
MQTT_PORT = int(os.getenv('MQTT_PORT', 1883))
MQTT_TOPIC = os.getenv('MQTT_TOPIC', 'baggage/events')
# Credentials + TLS for cloud brokers (unset for local Mosquitto).
MQTT_USER = os.getenv('MQTT_USER')
MQTT_PASS = os.getenv('MQTT_PASS')
MQTT_USE_TLS = os.getenv('MQTT_USE_TLS', 'false').lower() == 'true'


def configure_mqtt(client: 'mqtt.Client') -> None:
    """Apply username/password and TLS when connecting to a cloud broker."""
    if MQTT_USER:
        client.username_pw_set(MQTT_USER, MQTT_PASS)
    if MQTT_USE_TLS:
        client.tls_set()

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

# Map demo --scenario values to internal anomaly identifiers
SCENARIO_TO_ANOMALY = {
    'normal':      None,
    'stall':       'stall',
    'wrong-route': 'wrong_route',
    'bypass':      'security_bypass',
}

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


def generate_bags(
    n: int = 10,
    scenario: Optional[str] = None,
    passenger: Optional[str] = None,
    flight: Optional[str] = None,
) -> list[dict]:
    forced = SCENARIO_TO_ANOMALY[scenario] if scenario else None
    bags = []
    for i in range(1, n + 1):
        bags.append({
            'tag_id':    f'TAG-{1000 + i}',
            'flight_id': flight or random.choice(FLIGHTS),
            'passenger': passenger or PASSENGERS[(i - 1) % len(PASSENGERS)],
            'anomaly':   forced if scenario else _pick_anomaly(),
        })
    return bags


def simulate_bag(client: mqtt.Client, bag: dict, speed: float = 1.0):
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
            'timestamp':     datetime.now(timezone.utc).isoformat(),
        }

        client.publish(MQTT_TOPIC, json.dumps(payload))
        print(f'[SIM] Published: {tag_id} → {cp} ({duration}m)')

        # Wait 5-30 s before the bag reaches the next checkpoint (scaled by --speed)
        time.sleep(random.uniform(5, 30) * speed)


def on_connect(client, userdata, flags, reason_code, properties=None):
    if reason_code == 0:
        print(f'[SIM] Connected to MQTT broker at {MQTT_HOST}:{MQTT_PORT}')
    else:
        print(f'[SIM] Connection failed with code {reason_code}')


def simulate_one_bag(
    tag_id: str,
    passenger: str,
    flight_id: str,
    scenario: Optional[str] = 'normal',
    speed: float = 1.0,
) -> None:
    """
    Run a single user-supplied bag through the full checkpoint flow with its
    own MQTT client. Designed to be called from the backend in a background
    thread when an operator submits the dashboard "Inject Bag" form.
    """
    anomaly = SCENARIO_TO_ANOMALY.get(scenario) if scenario else None
    bag = {
        'tag_id':    tag_id,
        'flight_id': flight_id,
        'passenger': passenger,
        'anomaly':   anomaly,
    }

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect
    configure_mqtt(client)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()
    time.sleep(1)  # broker handshake

    try:
        simulate_bag(client, bag, speed)
    finally:
        client.loop_stop()
        client.disconnect()


def parse_args():
    p = argparse.ArgumentParser(description='SkyWatcher RFID simulator')
    p.add_argument('--bags', type=int, default=10,
                   help='Number of bags to simulate (default: 10)')
    p.add_argument('--sequential', action='store_true',
                   help='Process bags one at a time instead of in parallel')
    p.add_argument('--scenario', choices=list(SCENARIO_TO_ANOMALY.keys()),
                   help='Force every bag to follow this scenario instead of a random roll')
    p.add_argument('--passenger',
                   help='Pin all bags to this passenger name (useful for the public-track demo)')
    p.add_argument('--flight',
                   help='Pin all bags to this flight ID')
    p.add_argument('--speed', type=float, default=1.0,
                   help='Scale inter-checkpoint delay (0.3 = faster demo, 2.0 = slower)')
    return p.parse_args()


def main():
    args = parse_args()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.on_connect = on_connect

    print(f'[SIM] Connecting to {MQTT_HOST}:{MQTT_PORT}...')
    configure_mqtt(client)
    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()

    time.sleep(1)  # Wait for broker handshake

    bags = generate_bags(args.bags, args.scenario, args.passenger, args.flight)
    mode = 'sequential' if args.sequential else 'parallel'
    print(f'[SIM] Generated {len(bags)} bags ({mode}, speed={args.speed}x)\n')
    for b in bags:
        print(f'      {b["tag_id"]}  {b["flight_id"]}  {b["passenger"]}  anomaly={b["anomaly"]}')

    if args.sequential:
        for bag in bags:
            simulate_bag(client, bag, args.speed)
    else:
        threads = []
        for bag in bags:
            time.sleep(random.uniform(0.5, 2) * args.speed)
            t = threading.Thread(target=simulate_bag, args=(client, bag, args.speed), daemon=True)
            t.start()
            threads.append(t)

        for t in threads:
            t.join()

    print('\n[SIM] All bags processed. Simulation complete.')
    client.loop_stop()
    client.disconnect()


if __name__ == '__main__':
    main()
