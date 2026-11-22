"""
Per-request notes shared by a route and the middleware around it.

The route runs on a worker thread. A copied context shares this dict object,
so the route can fill in the revision and the middleware can read it afterward.
"""

from contextvars import ContextVar
from typing import Optional

_box: ContextVar[Optional[dict]] = ContextVar("sync_request_box", default=None)


def begin_request_box(device_id: Optional[str]) -> dict:
    """Start a box for this request. Call this before the route runs."""
    box = {"device_id": device_id, "revision": None}
    _box.set(box)
    return box


def note_revision(revision: int) -> None:
    """Remember the newest revision written during this request."""
    box = _box.get()
    if box is not None:
        box["revision"] = revision


def current_revision() -> Optional[int]:
    box = _box.get()
    if box is None:
        return None
    value = box.get("revision")
    if value is None:
        return None
    return int(value)


def current_device_id() -> Optional[str]:
    box = _box.get()
    if box is None:
        return None
    device_id = box.get("device_id")
    if device_id is None:
        return None
    return str(device_id)
