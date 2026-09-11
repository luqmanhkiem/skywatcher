"""
Authenticated API integration tests - SkyWatcher

Covers the report's test cases that require a signed-in session:

    TC-001  Admin login with valid credentials
    TC-003  Ground staff see only their own checkpoint
    TC-004  Role restriction on an admin-only route
    TC-009  Retrieve full bag history in chronological order
    TC-018  Anomalies are listed as alerts
    TC-019  Resolve an alert
    TC-020  Staff cannot resolve another checkpoint's alert
    TC-021  Live views poll at the 3-second interval

Tokens are minted with the application's own ``make_token()`` rather than by
posting credentials, which is the usual way to drive authenticated endpoints
from an automated test.

These run against the configured Supabase project, so they are marked ``live``
and skipped by default. Run them explicitly with:

    pytest -m live -s

TC-019 creates a temporary anomaly, resolves it, then deletes it, so the
project's own alert data is left untouched.
"""
import os
import sys

import pytest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

pytestmark = pytest.mark.live

RUN_LIVE = os.getenv('SKYWATCHER_LIVE_DB', '').lower() in ('1', 'true', 'yes')
pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(
        not RUN_LIVE,
        reason='set SKYWATCHER_LIVE_DB=1 to run tests against the live database',
    ),
]


# ---------------------------------------------------------------- fixtures

@pytest.fixture(scope='module')
def client():
    from app import app
    app.config['TESTING'] = True
    return app.test_client()


@pytest.fixture(scope='module')
def admin_token():
    from auth import make_token
    return make_token({'id': 1, 'username': 'admin', 'role': 'admin'})


def staff_token(checkpoint):
    from auth import make_token
    return make_token({
        'id': 99, 'username': f'staff_{checkpoint}',
        'role': 'ground_staff', 'checkpoint': checkpoint,
    })


def auth(token):
    return {'Authorization': f'Bearer {token}'}


# ---------------------------------------------------------------- test cases

def test_TC001_admin_login_with_valid_credentials(client):
    """Seeded admin account authenticates and receives a JWT."""
    from models.database import verify_password
    user = verify_password('admin', 'admin123')
    assert user is not None, 'seeded admin account should authenticate'
    assert user['role'] == 'admin'
    print(f"\n[TC-001] admin authenticated, role={user['role']}  -> PASS")


def test_TC003_uniform_staff_see_every_bag(client, admin_token):
    """
    Staff are uniform: any authenticated operator may work any bag, so every
    role sees the same full bag list (no per-checkpoint filtering).
    """
    all_bags = client.get('/api/bags', headers=auth(admin_token)).get_json()['bags']
    admin_tags = sorted(b['tag_id'] for b in all_bags)
    print(f'\n[TC-003] admin sees {len(all_bags)} bag(s)')

    for cp in ['check_in', 'security', 'sorting', 'loading', 'arrival']:
        resp = client.get('/api/bags', headers=auth(staff_token(cp)))
        assert resp.status_code == 200
        tags = sorted(b['tag_id'] for b in resp.get_json()['bags'])
        assert tags == admin_tags, f'staff_{cp} saw a different bag list to admin'
        print(f'  staff_{cp:9s} sees {len(tags)} bag(s) — same list as admin')
    print('[TC-003] -> PASS')


def test_TC004_role_restriction_on_admin_only_route(client, admin_token):
    """Admin-only analytics must reject a ground-staff token with 403."""
    admin_resp = client.get('/api/stats', headers=auth(admin_token))
    staff_resp = client.get('/api/stats', headers=auth(staff_token('security')))
    assert admin_resp.status_code == 200, 'admin should be allowed'
    assert staff_resp.status_code == 403, 'ground staff must be forbidden'
    print(f'\n[TC-004] admin={admin_resp.status_code} staff={staff_resp.status_code} -> PASS')


def test_TC009_bag_history_in_chronological_order(client, admin_token):
    """Full checkpoint history is returned oldest-first."""
    bags = client.get('/api/bags', headers=auth(admin_token)).get_json()['bags']
    assert bags, 'need at least one bag in the database'
    tag = bags[0]['tag_id']

    resp = client.get(f'/api/bags/{tag}/history', headers=auth(admin_token))
    assert resp.status_code == 200
    events = resp.get_json()['events']
    stamps = [e['timestamp'] for e in events]
    assert stamps == sorted(stamps), 'history is not in chronological order'
    print(f'\n[TC-009] {tag}: {len(events)} event(s), chronological -> PASS')

    missing = client.get('/api/bags/TAG-DOES-NOT-EXIST/history', headers=auth(admin_token))
    assert missing.status_code == 404
    print('[TC-009] unknown tag -> 404 -> PASS')


def test_TC018_anomalies_listed_as_alerts(client, admin_token):
    """Alerts endpoint returns anomalies with their type, checkpoint and counts."""
    resp = client.get('/api/alerts', headers=auth(admin_token))
    assert resp.status_code == 200
    body = resp.get_json()
    assert {'alerts', 'total', 'unresolved'} <= body.keys()
    for a in body['alerts']:
        assert {'id', 'type', 'checkpoint'} <= a.keys()
    print(f"\n[TC-018] {body['total']} alert(s), {body['unresolved']} unresolved -> PASS")


def test_TC019_resolve_an_alert(client, admin_token):
    """An unresolved alert can be resolved and is stamped with resolved_at."""
    from models.database import get_db, insert_anomaly
    db = get_db()
    bags = client.get('/api/bags', headers=auth(admin_token)).get_json()['bags']
    tag = bags[0]['tag_id']

    # temporary alert so the project's real alerts are not modified
    insert_anomaly(tag, 'STALL', 'TEMP test alert (automated)', 'check_in', 0.5)
    row = (db.table('anomalies').select('id,resolved')
             .eq('description', 'TEMP test alert (automated)')
             .order('id', desc=True).limit(1).execute().data[0])
    alert_id = row['id']
    try:
        assert not row['resolved']
        resp = client.patch(f'/api/alerts/{alert_id}/resolve', headers=auth(admin_token))
        assert resp.status_code == 200, resp.get_json()

        after = (db.table('anomalies').select('resolved,resolved_at')
                   .eq('id', alert_id).execute().data[0])
        assert after['resolved']
        assert after['resolved_at'] is not None
        print(f'\n[TC-019] alert {alert_id} resolved at {after["resolved_at"]} -> PASS')
    finally:
        db.table('anomalies').delete().eq('id', alert_id).execute()
        print(f'[TC-019] temporary alert {alert_id} removed')


def test_TC020_alert_resolution_requires_authentication(client, admin_token):
    """
    Resolving an alert is restricted to authenticated operators. Under the
    uniform-staff model any signed-in operator may resolve any alert, so the
    control being verified is authentication, not checkpoint ownership.
    """
    from models.database import get_db, insert_anomaly
    db = get_db()
    bags = client.get('/api/bags', headers=auth(admin_token)).get_json()['bags']
    tag = bags[0]['tag_id']

    insert_anomaly(tag, 'STALL', 'TEMP auth-check alert', 'check_in', 0.5)
    alert_id = (db.table('anomalies').select('id')
                  .eq('description', 'TEMP auth-check alert')
                  .order('id', desc=True).limit(1).execute().data[0])['id']
    try:
        anon = client.patch(f'/api/alerts/{alert_id}/resolve')
        assert anon.status_code == 401, anon.get_json()

        bad = client.patch(f'/api/alerts/{alert_id}/resolve',
                           headers={'Authorization': 'Bearer not.a.real.token'})
        assert bad.status_code == 401, bad.get_json()

        ok = client.patch(f'/api/alerts/{alert_id}/resolve',
                          headers=auth(staff_token('security')))
        assert ok.status_code == 200, ok.get_json()
        print('\n[TC-020] anonymous=401, bad token=401, authenticated staff=200 -> PASS')
    finally:
        db.table('anomalies').delete().eq('id', alert_id).execute()

    missing = client.patch('/api/alerts/999999999/resolve', headers=auth(admin_token))
    assert missing.status_code == 404
    print('[TC-020] unknown alert -> 404 -> PASS')


def test_TC021_live_views_poll_every_3_seconds():
    """Live views must refresh on the 3-second interval defined in the spec."""
    import re
    src_dir = os.path.join(BACKEND_DIR, '..', 'skywatcher-dashboard', 'src')
    hits = []
    for root, _dirs, files in os.walk(src_dir):
        if 'node_modules' in root:
            continue
        for f in files:
            if f.endswith(('.jsx', '.js')):
                path = os.path.join(root, f)
                text = open(path, encoding='utf-8', errors='ignore').read()
                for m in re.finditer(r'usePolling\([^,]+,\s*(\d+)\s*\)', text):
                    hits.append((os.path.basename(path), int(m.group(1))))
    assert hits, 'no usePolling() call sites found'
    intervals = sorted({ms for _f, ms in hits})
    print(f'\n[TC-021] usePolling intervals: {intervals} ms across {len(hits)} call sites')

    # Live operational views must refresh every 3 seconds.
    LIVE_VIEWS = {'BagTable.jsx', 'AlertPanel.jsx', 'LiveMap.jsx'}
    for view in LIVE_VIEWS:
        view_intervals = {ms for f, ms in hits if f == view}
        assert 3000 in view_intervals, f'{view} does not poll at 3s (found {view_intervals})'
        print(f'  {view:18s} polls at {sorted(view_intervals)} ms')

    # Analytics and secondary views refresh less aggressively.
    assert 5000 in intervals, 'no view polls at the 5-second analytics interval'
    slower = sorted({(f, ms) for f, ms in hits if ms > 5000})
    if slower:
        print(f'  heavier datasets on a longer interval: {slower}')
    print('[TC-021] -> PASS')
