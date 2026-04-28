import os
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY: str = os.getenv('SUPABASE_KEY', '')

CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']


def get_db() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def init_db():
    """Verify Supabase connection (schema managed via Supabase dashboard)."""
    db = get_db()
    db.table('bags').select('tag_id').limit(1).execute()
    print('[SkyWatcher] Connected to Supabase.')


# ── Events ───────────────────────────────────────────────────────────────────

def insert_event(payload: dict):
    tag_id        = payload.get('tag_id')
    checkpoint    = payload.get('checkpoint')
    flight_id     = payload.get('flight_id', 'FL000')
    passenger     = payload.get('passenger', 'Unknown')
    timestamp     = payload.get('timestamp', datetime.utcnow().isoformat())
    duration_mins = payload.get('duration_mins', 0)
    status        = 'arrived' if checkpoint == 'arrival' else 'in_transit'

    db = get_db()

    # Upsert bag
    db.table('bags').upsert({
        'tag_id':          tag_id,
        'flight_id':       flight_id,
        'passenger':       passenger,
        'last_checkpoint': checkpoint,
        'last_seen':       timestamp,
        'status':          status,
    }, on_conflict='tag_id').execute()

    # Insert event — ignore duplicate (tag_id, checkpoint, timestamp)
    db.table('events').upsert({
        'tag_id':        tag_id,
        'checkpoint':    checkpoint,
        'flight_id':     flight_id,
        'timestamp':     timestamp,
        'duration_mins': duration_mins,
    }, on_conflict='tag_id,checkpoint,timestamp', ignore_duplicates=True).execute()


def get_all_bags() -> list:
    db   = get_db()
    resp = db.table('bags').select('*').order('last_seen', desc=True).execute()
    return resp.data or []


def get_bag_history(tag_id: str) -> list:
    db   = get_db()
    resp = db.table('events').select('*').eq('tag_id', tag_id).order('timestamp').execute()
    return resp.data or []


def get_recent_events_for_bag(tag_id: str, limit: int = 10) -> list:
    db   = get_db()
    resp = (db.table('events').select('*')
              .eq('tag_id', tag_id)
              .order('timestamp', desc=True)
              .limit(limit)
              .execute())
    return resp.data or []


# ── Alerts ────────────────────────────────────────────────────────────────────

def get_alerts(limit: int = 50) -> list:
    db   = get_db()
    resp = db.table('anomalies').select('*').order('created_at', desc=True).limit(limit).execute()
    return resp.data or []


# ── Stats ─────────────────────────────────────────────────────────────────────

def get_checkpoint_stats() -> list:
    db   = get_db()
    resp = db.rpc('get_checkpoint_stats').execute()
    return resp.data or []


# ── Users ─────────────────────────────────────────────────────────────────────

def seed_users():
    """Insert default demo accounts if the users table is empty."""
    db    = get_db()
    count = db.table('users').select('id', count='exact').execute().count

    if count and count > 0:
        return

    accounts = [
        {'username': 'admin',          'password_hash': generate_password_hash(method='pbkdf2:sha256', password='admin123'), 'role': 'admin',        'checkpoint': None,       'flight_id': None,    'tag_id': None},
        {'username': 'staff_checkin',  'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'checkpoint': 'check_in', 'flight_id': None,    'tag_id': None},
        {'username': 'staff_security', 'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'checkpoint': 'security', 'flight_id': None,    'tag_id': None},
        {'username': 'staff_sorting',  'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'checkpoint': 'sorting',  'flight_id': None,    'tag_id': None},
        {'username': 'staff_loading',  'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'checkpoint': 'loading',  'flight_id': None,    'tag_id': None},
        {'username': 'staff_arrival',  'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'checkpoint': 'arrival',  'flight_id': None,    'tag_id': None},
        {'username': 'passenger_test', 'password_hash': generate_password_hash(method='pbkdf2:sha256', password='pass123'),  'role': 'passenger',    'checkpoint': None,       'flight_id': 'MH370', 'tag_id': 'TAG-1001'},
    ]

    db.table('users').insert(accounts).execute()
    print('[SkyWatcher] Demo accounts seeded.')


def get_user_by_username(username: str) -> Optional[dict]:
    db   = get_db()
    resp = db.table('users').select('*').eq('username', username).limit(1).execute()
    return resp.data[0] if resp.data else None


def get_user_by_id(user_id: int) -> Optional[dict]:
    db   = get_db()
    resp = db.table('users').select('*').eq('id', user_id).limit(1).execute()
    return resp.data[0] if resp.data else None


def verify_password(username: str, password: str) -> Optional[dict]:
    user = get_user_by_username(username)
    if user and user.get('active', 1) and check_password_hash(user['password_hash'], password):
        return user
    return None


def get_bag_by_tag(tag_id: str) -> Optional[dict]:
    db   = get_db()
    resp = db.table('bags').select('*').eq('tag_id', tag_id).limit(1).execute()
    return resp.data[0] if resp.data else None


def get_bag_by_passenger(flight_id: str, passenger: str):
    db   = get_db()
    resp = (db.table('bags').select('*')
              .eq('flight_id', flight_id.strip().upper())
              .ilike('passenger', f'%{passenger.strip()}%')
              .limit(1)
              .execute())
    if not resp.data:
        return None, []
    bag    = resp.data[0]
    events = (db.table('events').select('*')
                .eq('tag_id', bag['tag_id'])
                .order('timestamp')
                .execute()).data or []
    return bag, events


def get_all_users() -> list:
    db   = get_db()
    resp = (db.table('users')
              .select('id, username, role, checkpoint, flight_id, tag_id, active, created_at')
              .order('id')
              .execute())
    return resp.data or []


def create_user(username: str, password: str, role: str,
                checkpoint: Optional[str] = None,
                flight_id: Optional[str] = None,
                tag_id: Optional[str] = None) -> dict:
    pw_hash = generate_password_hash(method='pbkdf2:sha256', password=password)
    db      = get_db()
    resp    = db.table('users').insert({
        'username':      username,
        'password_hash': pw_hash,
        'role':          role,
        'checkpoint':    checkpoint,
        'flight_id':     flight_id,
        'tag_id':        tag_id,
    }).execute()
    row = resp.data[0]
    row.pop('password_hash', None)
    return row


def update_user(user_id: int, fields: dict) -> Optional[dict]:
    allowed = {'username', 'role', 'checkpoint', 'flight_id', 'tag_id'}
    updates = {}
    for k, v in fields.items():
        if k == 'password' and v:
            updates['password_hash'] = generate_password_hash(method='pbkdf2:sha256', password=v)
        elif k in allowed:
            updates[k] = v

    if not updates:
        return None

    db   = get_db()
    resp = db.table('users').update(updates).eq('id', user_id).execute()
    if not resp.data:
        return None
    row = resp.data[0]
    row.pop('password_hash', None)
    return row


def deactivate_user(user_id: int) -> bool:
    db   = get_db()
    resp = db.table('users').update({'active': 0}).eq('id', user_id).execute()
    return bool(resp.data)


# ── Analytics (via PostgreSQL functions) ─────────────────────────────────────

def get_flight_summaries() -> list:
    db   = get_db()
    resp = db.rpc('get_flight_summaries').execute()
    return resp.data or []


def get_anomaly_trend(days: int = 14) -> list:
    db   = get_db()
    resp = db.rpc('get_anomaly_trend', {'days_back': days}).execute()
    return [{'date': str(r['date']), 'count': r['count']} for r in (resp.data or [])]


def get_flight_anomaly_counts() -> list:
    db   = get_db()
    resp = db.rpc('get_flight_anomaly_counts').execute()
    return resp.data or []


def get_avg_resolution_time_minutes() -> Optional[float]:
    db   = get_db()
    resp = db.rpc('get_avg_resolution_time').execute()
    val  = resp.data
    if isinstance(val, list):
        val = val[0] if val else None
    return round(float(val), 1) if val is not None else None


def get_checkpoint_anomaly_counts() -> list:
    db   = get_db()
    resp = db.rpc('get_checkpoint_anomaly_counts').execute()
    return resp.data or []


# ── Anomaly persistence (called from anomaly detector) ───────────────────────

def insert_anomaly(tag_id: str, anomaly_type: str, description: str,
                   checkpoint: str, score: float):
    db = get_db()
    db.table('anomalies').insert({
        'tag_id':      tag_id,
        'type':        anomaly_type,
        'description': description,
        'checkpoint':  checkpoint,
        'score':       score,
    }).execute()


def resolve_alert(alert_id: int) -> Optional[dict]:
    db   = get_db()
    resp = db.table('anomalies').update({
        'resolved':    1,
        'resolved_at': datetime.utcnow().isoformat(),
    }).eq('id', alert_id).execute()
    return resp.data[0] if resp.data else None
