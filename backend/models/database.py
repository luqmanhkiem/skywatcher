import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
from werkzeug.security import generate_password_hash, check_password_hash

from models import state_machine
from models.state_machine import InvalidTransition  # re-exported for callers

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

SUPABASE_URL: str = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY: str = os.getenv('SUPABASE_KEY', '')

CHECKPOINTS = ['check_in', 'security', 'sorting', 'loading', 'arrival']

# Read here (not imported from anomaly.py, which would create a circular import)
# so the state machine and the anomaly detector share the same stall threshold.
STALL_THRESHOLD = float(os.getenv('ANOMALY_STALL_THRESHOLD_MINUTES', 20))


@lru_cache(maxsize=1)
def _create_client() -> Client:
    """Build the Supabase client once (see get_db)."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_db() -> Client:
    """
    Return a shared Supabase client.

    The client is created once and reused for the lifetime of the process.
    Previously a new client (and therefore a new HTTP connection pool) was
    built on every call; with ~5 calls per baggage scan this dominated the
    end-to-end request latency. Reusing one client also lets keep-alive
    connections be reused across queries.
    """
    return _create_client()


def init_db():
    """Verify Supabase connection (schema managed via Supabase dashboard)."""
    db = get_db()
    db.table('bags').select('tag_id').limit(1).execute()
    print('[SkyWatcher] Connected to Supabase.')


# ── Events ───────────────────────────────────────────────────────────────────

def insert_event(payload: dict, actor: str = 'device') -> dict:
    """
    Record a checkpoint scan and run it through the bag state machine.

    The bag's status is now a *decided outcome* of the FSM (advance, or an
    exception state) rather than the old two-value (in_transit/arrived) flag.
    Every status change is appended to ``bag_status_history`` for an auditable
    trail. ``actor`` labels the input source ('device' for the simulator/MQTT
    bridge, or an operator username for a dashboard/mobile scan).

    Returns {'status': new_status, 'anomaly': anomaly|None} for the caller.
    """
    tag_id        = payload.get('tag_id')
    checkpoint    = payload.get('checkpoint')
    flight_id     = payload.get('flight_id', 'FL000')
    passenger     = payload.get('passenger', 'Unknown')
    booking_ref   = (payload.get('booking_ref') or '').strip().upper() or None
    timestamp     = payload.get('timestamp', datetime.now(timezone.utc).isoformat())

    db = get_db()

    # Gather the FSM context from the bag + its prior events (DESC; index 0 is the
    # previous checkpoint, since the current event has not been inserted yet).
    existing       = get_bag_by_tag(tag_id)
    prior_events   = get_recent_events_for_bag(tag_id)
    prev_checkpoint = prior_events[0]['checkpoint'] if prior_events else None
    visited        = [e.get('checkpoint') for e in prior_events]

    # Compute real-time dwell duration from when the bag was last seen
    duration_mins = 0.0
    if existing:
        last_seen_raw = existing.get('last_seen')
        if last_seen_raw:
            try:
                last_seen_dt = datetime.fromisoformat(last_seen_raw.replace('Z', '+00:00'))
                if last_seen_dt.tzinfo is None:
                    last_seen_dt = last_seen_dt.replace(tzinfo=timezone.utc)
                duration_mins = (datetime.now(timezone.utc) - last_seen_dt).total_seconds() / 60
            except (ValueError, TypeError):
                pass

    current_status = state_machine.normalize_status(
        existing.get('status') if existing else None,
        existing.get('last_checkpoint') if existing else None,
    )

    # ── Operator-scan enforcement ─────────────────────────────────────────────
    # Device events (MQTT / simulator) may ONLY create a bag (first check-in).
    # Once a bag exists, every checkpoint advancement must come from an
    # authenticated operator scan (actor != 'device').  The raw event is still
    # logged for analytics and the live-map heatmap; only the FSM is bypassed.
    if actor == 'device' and existing is not None:
        db.table('events').upsert({
            'tag_id':        tag_id,
            'checkpoint':    checkpoint,
            'flight_id':     flight_id,
            'timestamp':     timestamp,
            'duration_mins': duration_mins,
        }, on_conflict='tag_id,checkpoint,timestamp', ignore_duplicates=True).execute()
        db.table('bags').update({'last_seen': timestamp}).eq('tag_id', tag_id).execute()
        return {'status': current_status, 'anomaly': None}

    new_status, anomalies = state_machine.decide(current_status, checkpoint, {
        'prev_checkpoint': prev_checkpoint,
        'visited':         visited,
        'duration_mins':   duration_mins,
        'stall_threshold': STALL_THRESHOLD,
    })
    # Back-compat: expose the first anomaly (or None) as 'anomaly' for callers
    # that only act on one; baggage.py iterates the full list.
    anomaly = anomalies[0] if anomalies else None

    now_iso = datetime.now(timezone.utc).isoformat()

    # Upsert bag with the decided status
    bag_row = {
        'tag_id':            tag_id,
        'flight_id':         flight_id,
        'passenger':         passenger,
        'last_checkpoint':   checkpoint,
        'last_seen':         timestamp,
        'status':            new_status,
        'status_updated_at': now_iso,
    }
    if booking_ref:
        bag_row['booking_ref'] = booking_ref
    db.table('bags').upsert(bag_row, on_conflict='tag_id').execute()

    # Insert event - ignore duplicate (tag_id, checkpoint, timestamp)
    db.table('events').upsert({
        'tag_id':        tag_id,
        'checkpoint':    checkpoint,
        'flight_id':     flight_id,
        'timestamp':     timestamp,
        'duration_mins': duration_mins,
    }, on_conflict='tag_id,checkpoint,timestamp', ignore_duplicates=True).execute()

    # Audit the transition (skip a no-op so the trail stays meaningful)
    if new_status != current_status:
        _insert_status_history(
            tag_id, current_status, new_status,
            trigger=f'scan:{checkpoint}', actor=actor, checkpoint=checkpoint,
        )

    # Loop closure: email opt-in passengers the moment the bag reaches ARRIVED.
    # Lazy import - notifier imports this module, so avoid a top-level cycle.
    if new_status == 'ARRIVED' and current_status != 'ARRIVED':
        try:
            from notifier import notify_arrival
            notify_arrival(tag_id)
        except Exception as exc:  # never let notification break ingestion
            print(f'[SkyWatcher] arrival-notify skipped for {tag_id}: {exc}')

    return {'status': new_status, 'anomaly': anomaly, 'anomalies': anomalies}


def get_all_bags() -> list:
    db   = get_db()
    resp = db.table('bags').select('*').order('last_seen', desc=True).execute()
    bags = resp.data or []
    try:
        cr   = db.table('flight_carousels').select('flight_id, carousel').execute()
        cmap = {r['flight_id']: r['carousel'] for r in (cr.data or [])}
    except Exception:
        cmap = {}
    for bag in bags:
        bag['carousel'] = cmap.get(bag.get('flight_id'))
    return bags


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


# ── Bag status / FSM ─────────────────────────────────────────────────────────

def _insert_status_history(tag_id: str, from_status: Optional[str],
                           to_status: str, trigger: str,
                           actor: Optional[str] = None,
                           checkpoint: Optional[str] = None):
    """Append one row to the auditable bag_status_history trail."""
    db = get_db()
    db.table('bag_status_history').insert({
        'tag_id':      tag_id,
        'from_status': from_status,
        'to_status':   to_status,
        'trigger':     trigger,
        'actor':       actor,
        'checkpoint':  checkpoint,
        'created_at':  datetime.now(timezone.utc).isoformat(),
    }).execute()


def get_bag_status_history(tag_id: str) -> list:
    """Full state-transition trail for a bag, oldest first."""
    db   = get_db()
    resp = (db.table('bag_status_history').select('*')
              .eq('tag_id', tag_id)
              .order('created_at')
              .execute())
    return resp.data or []


def apply_operator_action(tag_id: str, action: str,
                          actor: str = 'staff') -> Optional[dict]:
    """
    Apply an operator action (hold/release/reroute/claim/report_lost/found)
    through the state machine and persist the result.

    Returns the transition dict, or None if the bag does not exist. Raises
    ``InvalidTransition`` (from state_machine) if the action is illegal from the
    bag's current state - the route layer maps that to HTTP 409.
    """
    bag = get_bag_by_tag(tag_id)
    if not bag:
        return None

    current_status = state_machine.normalize_status(
        bag.get('status'), bag.get('last_checkpoint'),
    )
    new_status, _ = state_machine.decide(current_status, action, {})

    now_iso = datetime.now(timezone.utc).isoformat()
    db = get_db()
    db.table('bags').update({
        'status':            new_status,
        'status_updated_at': now_iso,
    }).eq('tag_id', tag_id).execute()

    _insert_status_history(
        tag_id, current_status, new_status,
        trigger=f'action:{action}', actor=actor, checkpoint=bag.get('last_checkpoint'),
    )

    return {
        'tag_id':      tag_id,
        'from_status': current_status,
        'status':      new_status,
        'action':      action,
    }


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
        {'username': 'admin',  'password_hash': generate_password_hash(method='pbkdf2:sha256', password='admin123'), 'role': 'admin',        'name': 'Admin',   'checkpoint': None, 'email': None, 'flight_id': None, 'tag_id': None},
        {'username': 'staff1', 'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'name': 'Staff 1', 'checkpoint': None, 'email': None, 'flight_id': None, 'tag_id': None},
        {'username': 'staff2', 'password_hash': generate_password_hash(method='pbkdf2:sha256', password='staff123'), 'role': 'ground_staff', 'name': 'Staff 2', 'checkpoint': None, 'email': None, 'flight_id': None, 'tag_id': None},
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


def get_bags_by_booking_ref(booking_ref: str) -> list:
    """Return all bags + events for a booking reference (one passenger, possibly multiple bags)."""
    db   = get_db()
    resp = (db.table('bags').select('*')
              .eq('booking_ref', booking_ref.strip().upper())
              .order('tag_id')
              .execute())
    result = []
    for bag in (resp.data or []):
        events = (db.table('events').select('*')
                    .eq('tag_id', bag['tag_id'])
                    .order('timestamp')
                    .execute()).data or []
        result.append((bag, events))
    return result


def get_all_users() -> list:
    db   = get_db()
    resp = (db.table('users')
              .select('id, username, name, role, email, flight_id, tag_id, active, created_at')
              .order('id')
              .execute())
    return resp.data or []


def get_user_by_email(email: str) -> Optional[dict]:
    db   = get_db()
    resp = (db.table('users').select('*')
              .eq('active', 1)
              .ilike('email', email.strip())
              .limit(1).execute())
    return resp.data[0] if resp.data else None


def create_user(username: str, password: str, role: str,
                checkpoint: Optional[str] = None,
                flight_id: Optional[str] = None,
                tag_id: Optional[str] = None,
                email: Optional[str] = None,
                name: Optional[str] = None) -> dict:
    pw_hash = generate_password_hash(method='pbkdf2:sha256', password=password)
    db      = get_db()
    resp    = db.table('users').insert({
        'username':      username,
        'password_hash': pw_hash,
        'role':          role,
        'name':          name,
        'checkpoint':    checkpoint,
        'email':         email,
        'flight_id':     flight_id,
        'tag_id':        tag_id,
    }).execute()
    row = resp.data[0]
    row.pop('password_hash', None)
    return row


def get_alert_recipient_emails() -> list:
    """
    Emails of all active admin / ground_staff accounts that have an email set.
    Used by the notifier to address critical-anomaly alerts to real staff.
    """
    db   = get_db()
    resp = (db.table('users')
              .select('email')
              .eq('active', 1)   # `active` is an integer flag (0/1), not a boolean
              .in_('role', ['admin', 'ground_staff'])
              .execute())
    return [r['email'].strip() for r in (resp.data or [])
            if r.get('email') and r['email'].strip()]


def create_reset_token(user_id: int) -> str:
    """Generate a one-time password-reset token valid for 1 hour."""
    import secrets
    from datetime import datetime, timezone, timedelta
    token = secrets.token_urlsafe(32)
    db    = get_db()
    # Invalidate any existing unused tokens for this user
    db.table('password_reset_tokens').update({'used': True}).eq('user_id', user_id).eq('used', False).execute()
    db.table('password_reset_tokens').insert({
        'user_id':    user_id,
        'token':      token,
        'expires_at': (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        'used':       False,
    }).execute()
    return token


def verify_and_consume_reset_token(token: str) -> Optional[dict]:
    """
    Validate a reset token (must be unused and not expired).
    Returns the user dict if valid, marks token used, returns None if invalid.
    """
    from datetime import datetime, timezone
    db   = get_db()
    resp = (db.table('password_reset_tokens')
              .select('*')
              .eq('token', token)
              .eq('used', False)
              .limit(1).execute())
    if not resp.data:
        return None
    row = resp.data[0]
    expires_at = datetime.fromisoformat(row['expires_at'].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) > expires_at:
        return None
    # Mark used
    db.table('password_reset_tokens').update({'used': True}).eq('id', row['id']).execute()
    # Fetch the user separately - avoids relying on PostgREST's embedded-resource
    # FK relationship lookup, which can lag behind the schema cache.
    user_resp = db.table('users').select('*').eq('id', row['user_id']).limit(1).execute()
    return user_resp.data[0] if user_resp.data else None


def update_user_password(user_id: int, new_password: str) -> bool:
    db      = get_db()
    pw_hash = generate_password_hash(method='pbkdf2:sha256', password=new_password)
    resp    = db.table('users').update({'password_hash': pw_hash}).eq('id', user_id).execute()
    return bool(resp.data)


def update_user(user_id: int, fields: dict) -> Optional[dict]:
    allowed = {'username', 'role', 'email', 'name', 'flight_id', 'tag_id'}
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
    """
    Per-flight baggage summary.  Computed in Python rather than an RPC so that
    the 'arrived' count matches the FSM status values (ARRIVED / CLAIMED) and
    not the legacy 'arrived' string.
    """
    db   = get_db()
    bags = (db.table('bags').select('flight_id, status').execute()).data or []

    # Statuses that mean "bag reached the carousel" (FSM + legacy).
    _ARRIVED = {'ARRIVED', 'CLAIMED', 'arrived'}

    # Aggregate per flight.
    flights: dict[str, dict] = {}
    for b in bags:
        fid = b.get('flight_id')
        if not fid:
            continue
        if fid not in flights:
            flights[fid] = {'flight_id': fid, 'total_bags': 0, 'arrived': 0, 'bags_with_anomalies': 0}
        flights[fid]['total_bags'] += 1
        if b.get('status') in _ARRIVED:
            flights[fid]['arrived'] += 1

    # Anomaly counts (unresolved) per flight.
    anomalies = (db.table('anomalies')
                   .select('tag_id')
                   .is_('resolved_at', 'null')
                   .execute()).data or []
    anom_tags = {a['tag_id'] for a in anomalies}
    # Map tag → flight for anomaly counting.
    tag_flights = {b.get('tag_id'): b.get('flight_id') for b in
                   (db.table('bags').select('tag_id, flight_id').execute()).data or []}
    for t in anom_tags:
        fid = tag_flights.get(t)
        if fid and fid in flights:
            flights[fid]['bags_with_anomalies'] += 1

    result = sorted(flights.values(), key=lambda f: f['flight_id'])

    # Attach carousel assignment.
    try:
        cr   = db.table('flight_carousels').select('flight_id, carousel').execute()
        cmap = {r['flight_id']: r['carousel'] for r in (cr.data or [])}
    except Exception:
        cmap = {}
    for f in result:
        f['carousel'] = cmap.get(f.get('flight_id'))
    return result


def auto_assign_carousel(flight_id: str, actor: Optional[str] = None) -> str:
    """
    Return the belt number for a flight, auto-assigning one if needed.
    Belts cycle 1→5 based on the total count of distinct flight assignments.
    """
    existing = get_carousel(flight_id)
    if existing:
        return existing
    try:
        db    = get_db()
        count = db.table('flight_carousels').select('flight_id', count='exact').execute().count or 0
        belt  = str((count % 5) + 1)
        set_carousel(flight_id, belt, actor=actor)
        return belt
    except Exception:
        return str((abs(hash(flight_id)) % 5) + 1)


def get_carousel(flight_id: str) -> Optional[str]:
    try:
        db   = get_db()
        resp = (db.table('flight_carousels').select('carousel')
                  .eq('flight_id', flight_id).maybe_single().execute())
        return resp.data['carousel'] if resp.data else None
    except Exception:
        return None


def set_carousel(flight_id: str, carousel: str, actor: Optional[str] = None) -> dict:
    db  = get_db()
    row = {
        'flight_id': flight_id,
        'carousel':  carousel,
        'set_by':    actor,
        'set_at':    datetime.now(timezone.utc).isoformat(),
    }
    resp = db.table('flight_carousels').upsert(row, on_conflict='flight_id').execute()
    return resp.data[0] if resp.data else row


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


def get_anomalies_for_bag(tag_id: str, only_unresolved: bool = True) -> list:
    db   = get_db()
    resp = (db.table('anomalies').select('*')
              .eq('tag_id', tag_id)
              .order('created_at', desc=True)
              .execute())
    rows = resp.data or []
    if only_unresolved:
        rows = [r for r in rows if not r.get('resolved')]
    return rows


def resolve_alert(alert_id: int) -> Optional[dict]:
    db   = get_db()
    resp = db.table('anomalies').update({
        'resolved':    1,
        'resolved_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', alert_id).execute()
    if not resp.data:
        return None
    anomaly = resp.data[0]
    _recover_bag_after_resolution(anomaly.get('tag_id'))
    return anomaly


def _recover_bag_after_resolution(tag_id: Optional[str]) -> None:
    """
    Closing the loop: once a bag's last anomaly is resolved, transition it back
    onto the happy path (FLAGGED → SCREENED, MISROUTED → SORTED). No-op if the
    bag isn't in a recoverable state or still has other unresolved anomalies.
    """
    if not tag_id:
        return
    bag = get_bag_by_tag(tag_id)
    if not bag:
        return
    if get_anomalies_for_bag(tag_id, only_unresolved=True):
        return  # other anomalies still open - leave the bag flagged

    current = state_machine.normalize_status(bag.get('status'), bag.get('last_checkpoint'))
    target  = state_machine.RESOLUTION_TRANSITIONS.get(current)
    if not target:
        return

    db = get_db()
    db.table('bags').update({
        'status':            target,
        'status_updated_at': datetime.now(timezone.utc).isoformat(),
    }).eq('tag_id', tag_id).execute()
    _insert_status_history(
        tag_id, current, target,
        trigger='resolve', actor='staff', checkpoint=bag.get('last_checkpoint'),
    )


# ── Customer feedback ────────────────────────────────────────────────────────

def insert_feedback(payload: dict) -> dict:
    """Insert a passenger-submitted feedback / issue report. Returns the new row."""
    db   = get_db()
    resp = db.table('feedback').insert({
        'name':       payload.get('name'),
        'email':      payload.get('email'),
        'flight_id':  payload.get('flight_id'),
        'tag_id':     payload.get('tag_id'),
        'category':   payload.get('category'),
        'message':    payload.get('message'),
        'status':     'new',
        'created_at': datetime.now(timezone.utc).isoformat(),
    }).execute()
    return resp.data[0] if resp.data else {}


def get_feedback(limit: int = 100) -> list:
    db   = get_db()
    resp = (db.table('feedback').select('*')
              .order('created_at', desc=True)
              .limit(limit)
              .execute())
    return resp.data or []


def update_feedback(feedback_id: int, fields: dict) -> Optional[dict]:
    """Update status / staff_notes / resolved_by on a feedback ticket."""
    allowed = {'status', 'staff_notes', 'resolved_by'}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return None
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()

    db   = get_db()
    resp = db.table('feedback').update(updates).eq('id', feedback_id).execute()
    return resp.data[0] if resp.data else None


# ── Passenger experience: ETA, advisories, arrival emails ────────────────────

# Sensible per-checkpoint dwell defaults (minutes), used when historical data is
# thin. These mirror the simulator's normal ranges.
DEFAULT_DURATIONS = {
    'check_in': 5.0, 'security': 4.0, 'sorting': 6.0, 'loading': 8.0, 'arrival': 3.0,
}

ADVISORY_LEVELS = {'operational', 'degraded', 'down'}


def get_expected_durations() -> dict:
    """
    Average dwell time per checkpoint from historical events.duration_mins,
    falling back to DEFAULT_DURATIONS where there's no data. Used for ETA.
    """
    db   = get_db()
    resp = db.table('events').select('checkpoint, duration_mins').execute()
    sums, counts = {}, {}
    for r in (resp.data or []):
        cp = r.get('checkpoint')
        d  = r.get('duration_mins')
        # Ignore 0-duration events (usually test/injected data) from the average
        if cp in DEFAULT_DURATIONS and isinstance(d, (int, float)) and d > 0:
            sums[cp]   = sums.get(cp, 0) + d
            counts[cp] = counts.get(cp, 0) + 1
    return {
        # Enforce a minimum expected duration of 1.0 minute per checkpoint
        cp: max(1.0, round(sums[cp] / counts[cp], 1)) if counts.get(cp) else float(default)
        for cp, default in DEFAULT_DURATIONS.items()
    }


def get_advisories(active_only: bool = True) -> list:
    """Checkpoint advisories. active_only → just degraded/down ones (for passengers)."""
    db   = get_db()
    resp = db.table('checkpoint_advisories').select('*').execute()
    rows = resp.data or []
    if active_only:
        rows = [r for r in rows
                if r.get('active') and r.get('level', 'operational') != 'operational']
    return rows


def upsert_advisory(checkpoint: str, level: str, message: Optional[str],
                    updated_by: Optional[str]) -> Optional[dict]:
    """Set a checkpoint's operational level + message (operator-declared)."""
    active = level in ('degraded', 'down')
    db   = get_db()
    resp = db.table('checkpoint_advisories').upsert({
        'checkpoint': checkpoint,
        'level':      level,
        'message':    message,
        'active':     active,
        'updated_by': updated_by,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }, on_conflict='checkpoint').execute()
    return resp.data[0] if resp.data else None


def create_advisory_request(checkpoint: str, level: str,
                            message: Optional[str],
                            requested_by: str) -> dict:
    db  = get_db()
    row = {
        'checkpoint':   checkpoint,
        'level':        level,
        'message':      message,
        'requested_by': requested_by,
        'status':       'pending',
        'created_at':   datetime.now(timezone.utc).isoformat(),
    }
    resp = db.table('advisory_requests').insert(row).execute()
    return resp.data[0] if resp.data else row


def get_advisory_requests(status: Optional[str] = None) -> list:
    db = get_db()
    q  = db.table('advisory_requests').select('*').order('created_at', desc=True)
    if status:
        q = q.eq('status', status)
    return q.execute().data or []


def review_advisory_request(request_id: int, action: str,
                             reviewed_by: str) -> Optional[dict]:
    """
    action: 'approve' | 'reject'
    Approving also calls upsert_advisory so the change takes effect immediately.
    """
    db  = get_db()
    req = db.table('advisory_requests').select('*').eq('id', request_id).maybe_single().execute()
    if not req.data:
        return None

    now_iso = datetime.now(timezone.utc).isoformat()
    new_status = 'approved' if action == 'approve' else 'rejected'
    db.table('advisory_requests').update({
        'status':      new_status,
        'reviewed_by': reviewed_by,
        'reviewed_at': now_iso,
    }).eq('id', request_id).execute()

    if action == 'approve':
        r = req.data
        upsert_advisory(r['checkpoint'], r['level'],
                        r.get('message'), updated_by=reviewed_by)

    updated = db.table('advisory_requests').select('*').eq('id', request_id).maybe_single().execute()
    return updated.data


def add_arrival_subscription(tag_id: str, email: str) -> Optional[dict]:
    """Register an opt-in email to notify when this bag reaches ARRIVED."""
    db   = get_db()
    resp = db.table('arrival_subscriptions').upsert({
        'tag_id':     tag_id,
        'email':      email.strip().lower(),
        'notified':   False,
        'created_at': datetime.now(timezone.utc).isoformat(),
    }, on_conflict='tag_id,email').execute()
    return resp.data[0] if resp.data else None


def get_pending_arrival_subscriptions(tag_id: str) -> list:
    db   = get_db()
    resp = (db.table('arrival_subscriptions').select('*')
              .eq('tag_id', tag_id)
              .execute())
    return [r for r in (resp.data or []) if not r.get('notified')]


def mark_arrival_notified(sub_id: int) -> None:
    db = get_db()
    db.table('arrival_subscriptions').update({
        'notified':    True,
        'notified_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', sub_id).execute()
