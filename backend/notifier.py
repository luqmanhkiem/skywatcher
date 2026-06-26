"""
Email notifications for SkyWatcher anomalies.

Sends an email whenever any anomaly (STALL / WRONG_ROUTE / SECURITY_BYPASS) is
detected, so the ops team is alerted even when nobody is watching the dashboard.
The subject line carries a severity label per type.

Configuration (all via .env — see .env.example):
    SMTP_HOST       e.g. smtp.gmail.com
    SMTP_PORT       e.g. 587
    SMTP_USER       sending account username
    SMTP_PASS       sending account password / app password
    ALERT_EMAIL_TO  recipient address for alerts

If any required variable is unset, sending is skipped with a log line — the
system runs fine without SMTP configured (useful for local development/demo).
"""
import os
import smtplib
import ssl
import threading
from email.message import EmailMessage

from models.database import (
    get_alert_recipient_emails,
    get_pending_arrival_subscriptions,
    mark_arrival_notified,
    get_bag_by_tag,
)

# Severity label per anomaly type — every type triggers an email; this only
# changes the wording in the subject line.
SEVERITY = {
    'SECURITY_BYPASS': 'CRITICAL',
    'WRONG_ROUTE':     'ALERT',
    'STALL':           'WARNING',
}


def _config() -> dict:
    return {
        'host': os.getenv('SMTP_HOST', ''),
        'port': int(os.getenv('SMTP_PORT', 587)),
        'user': os.getenv('SMTP_USER', ''),
        'password': os.getenv('SMTP_PASS', ''),
        # Optional fallback recipient when no staff accounts have an email set
        'fallback_to': os.getenv('ALERT_EMAIL_TO', ''),
    }


def _recipients(cfg: dict) -> list:
    """
    Build the recipient list: every active admin/staff account that has an
    email on file, plus the optional ALERT_EMAIL_TO fallback. De-duplicated.
    """
    emails = []
    try:
        emails = get_alert_recipient_emails()
    except Exception as exc:
        print(f'[NOTIFY] Could not load staff emails from DB: {exc}')

    if cfg['fallback_to']:
        emails.append(cfg['fallback_to'].strip())

    # De-dupe while preserving order
    seen = set()
    return [e for e in emails if not (e in seen or seen.add(e))]


def _send(cfg: dict, recipients: list, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = cfg['user']
    msg['To'] = cfg['user']        # sender on the To line…
    msg['Bcc'] = ', '.join(recipients)  # …staff hidden from each other via Bcc
    msg.set_content(body)

    context = ssl.create_default_context()
    with smtplib.SMTP(cfg['host'], cfg['port'], timeout=15) as server:
        server.starttls(context=context)
        server.login(cfg['user'], cfg['password'])
        server.send_message(msg)


def _do_notify(anomaly: dict) -> None:
    cfg = _config()
    if not all([cfg['host'], cfg['user'], cfg['password']]):
        print('[NOTIFY] SMTP not configured — skipping email for '
              f'{anomaly.get("type")} on bag {anomaly.get("tag_id")}')
        return

    recipients = _recipients(cfg)
    if not recipients:
        print('[NOTIFY] No staff emails on file (and no ALERT_EMAIL_TO) — '
              f'skipping email for {anomaly.get("type")} on bag {anomaly.get("tag_id")}')
        return

    tag        = anomaly.get('tag_id', 'unknown')
    atype      = anomaly.get('type', 'ANOMALY')
    checkpoint = anomaly.get('checkpoint', 'unknown')
    desc       = anomaly.get('description', '')

    severity = SEVERITY.get(atype, 'ALERT')
    subject = f'[SkyWatcher] {severity}: {atype} — bag {tag}'
    body = (
        f'A baggage anomaly was detected.\n\n'
        f'  Type:       {atype}\n'
        f'  Bag tag:    {tag}\n'
        f'  Checkpoint: {checkpoint}\n'
        f'  Details:    {desc}\n\n'
        f'Open the SkyWatcher dashboard to investigate and resolve.\n'
    )

    try:
        _send(cfg, recipients, subject, body)
        print(f'[NOTIFY] Alert email sent to {len(recipients)} recipient(s) '
              f'for {atype} on bag {tag}')
    except Exception as exc:
        print(f'[NOTIFY] Failed to send alert email: {exc}')


def notify_anomaly(anomaly: dict) -> None:
    """
    Fire an email for any detected anomaly in a background thread so the MQTT
    message handler is never blocked on network I/O. No-op if there's no type.
    """
    if not anomaly or not anomaly.get('type'):
        return
    threading.Thread(target=_do_notify, args=(anomaly,), daemon=True).start()


# ── Passenger arrival notifications (opt-in) ─────────────────────────────────

def _do_notify_arrival(tag_id: str) -> None:
    cfg = _config()
    if not all([cfg['host'], cfg['user'], cfg['password']]):
        print(f'[NOTIFY] SMTP not configured — skipping arrival email for {tag_id}')
        return

    subs = get_pending_arrival_subscriptions(tag_id)
    if not subs:
        return

    bag       = get_bag_by_tag(tag_id) or {}
    flight    = bag.get('flight_id', '')
    passenger = bag.get('passenger', '')

    subject = f'[SkyWatcher] Your bag {tag_id} has arrived'
    for sub in subs:
        email = (sub.get('email') or '').strip()
        if not email:
            continue
        body = (
            f'Good news{(", " + passenger) if passenger else ""}!\n\n'
            f'Your bag {tag_id}{(" on flight " + flight) if flight else ""} has '
            f'arrived and is on its way to the baggage claim carousel.\n\n'
            f'Safe travels,\nSkyWatcher\n'
        )
        try:
            _send(cfg, [email], subject, body)
            mark_arrival_notified(sub['id'])
            print(f'[NOTIFY] Arrival email sent to {email} for bag {tag_id}')
        except Exception as exc:
            print(f'[NOTIFY] Failed to send arrival email for {tag_id}: {exc}')


def notify_arrival(tag_id: str) -> None:
    """
    Email any opt-in passengers that their bag reached ARRIVED. Runs in a
    background thread; no-op if SMTP is unconfigured or nobody subscribed.
    """
    if not tag_id:
        return
    threading.Thread(target=_do_notify_arrival, args=(tag_id,), daemon=True).start()


# ── Password reset emails ─────────────────────────────────────────────────────

def _do_notify_reset(email: str, name: str, reset_url: str) -> None:
    cfg = _config()
    if not all([cfg['host'], cfg['user'], cfg['password']]):
        print(f'[NOTIFY] SMTP not configured — skipping password reset email to {email}')
        return
    subject = '[SkyWatcher] Password reset request'
    body = (
        f'Hi {name},\n\n'
        f'A password reset was requested for your SkyWatcher account.\n\n'
        f'Click the link below to set a new password (valid for 1 hour):\n'
        f'{reset_url}\n\n'
        f'If you did not request this, you can safely ignore this email.\n\n'
        f'— SkyWatcher\n'
    )
    try:
        _send(cfg, [email], subject, body)
        print(f'[NOTIFY] Password reset email sent to {email}')
    except Exception as exc:
        print(f'[NOTIFY] Failed to send reset email to {email}: {exc}')


def notify_password_reset(email: str, name: str, reset_url: str) -> None:
    """Send a password-reset link email in a background thread."""
    threading.Thread(target=_do_notify_reset, args=(email, name, reset_url), daemon=True).start()
