"""
Email notifications for critical SkyWatcher anomalies.

Sends an email when a critical anomaly (SECURITY_BYPASS) is detected, so the
ops team is alerted even when nobody is watching the dashboard.

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

from models.database import get_alert_recipient_emails

# Anomaly types considered critical enough to email about
CRITICAL_TYPES = {'SECURITY_BYPASS'}


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

    subject = f'[SkyWatcher] CRITICAL: {atype} — bag {tag}'
    body = (
        f'A critical baggage anomaly was detected.\n\n'
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
    Fire an email for a critical anomaly in a background thread so the MQTT
    message handler is never blocked on network I/O. No-op for non-critical types.
    """
    if anomaly.get('type') not in CRITICAL_TYPES:
        return
    threading.Thread(target=_do_notify, args=(anomaly,), daemon=True).start()
