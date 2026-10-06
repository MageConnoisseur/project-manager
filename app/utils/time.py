"""UTC timestamps for database columns.

SQLModel 0.0.47 stores plain datetime fields as timezone-aware values and
rejects datetime.utcnow(), which is naive. That rejection turned task
completion into a 500 because every update writes updated_at.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Current time in UTC, with timezone information attached."""
    return datetime.now(timezone.utc)
