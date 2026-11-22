"""
Silent Firebase push so a phone can download website edits before it is opened.

If FIREBASE_SERVICE_ACCOUNT_JSON is unset or invalid, this does nothing.
Callers already committed the database change, so a push problem must not
turn a successful save into an error.
"""

import json
import logging
import os
import threading

from sqlmodel import Session, select

logger = logging.getLogger("uvicorn.error")

_init_lock = threading.Lock()
_app_ready = False


def push_sync_revision(
    user_id: int,
    revision: int,
    exclude_device_id: str | None,
) -> None:
    """Tell this user's other phones that revision is the latest one."""
    raw = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        return

    try:
        _send(user_id, revision, exclude_device_id, raw)
    except Exception:
        logger.exception("Sync push failed for user %s revision %s", user_id, revision)


def _ensure_app(raw_json: str) -> None:
    global _app_ready
    with _init_lock:
        if _app_ready:
            return
        import firebase_admin
        from firebase_admin import credentials

        info = json.loads(raw_json)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(info))
        _app_ready = True


def _send(
    user_id: int,
    revision: int,
    exclude_device_id: str | None,
    raw_json: str,
) -> None:
    from firebase_admin import messaging

    from app.database import engine
    from app.models import Device

    _ensure_app(raw_json)

    with Session(engine) as db:
        devices = db.exec(select(Device).where(Device.user_id == user_id)).all()
        targets = [
            (device.device_id, device.fcm_token)
            for device in devices
            if device.fcm_token and device.device_id != exclude_device_id
        ]

    for device_id, token in targets:
        message = messaging.Message(
            data={"type": "sync", "revision": str(revision)},
            token=token,
            android=messaging.AndroidConfig(priority="high"),
        )
        try:
            messaging.send(message)
        except Exception:
            logger.exception("FCM send failed for device %s", device_id)
