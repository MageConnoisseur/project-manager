"""
Record a sync revision in the same transaction as the row it describes.

Call record_change before commit. commit_and_push commits, then tells other
phones that this account moved forward. A push failure does not undo the save.
"""

import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.core.request_context import current_device_id, current_revision, note_revision
from app.models import SyncChange, User
from app.services.push import push_sync_revision

logger = logging.getLogger("uvicorn.error")

ENTITY_WORKSPACE = "workspace"
ENTITY_PROJECT = "project"
ENTITY_TASK = "task"
OP_UPSERT = "upsert"
OP_DELETE = "delete"


def record_change(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
    op: str,
) -> int:
    """
    Bump the user's revision and append one change row.

    The caller commits. Several calls in one request (a deleted workspace and
    its tasks) each get their own revision, in order.
    """
    statement = select(User).where(User.id == user.id)
    bind = db.get_bind()
    if bind is not None and bind.dialect.name != "sqlite":
        statement = statement.with_for_update()

    locked = db.exec(statement).one()
    locked.sync_revision = int(locked.sync_revision or 0) + 1
    db.add(
        SyncChange(
            user_id=locked.id,
            revision=locked.sync_revision,
            entity_type=entity_type,
            entity_id=entity_id,
            op=op,
        )
    )
    note_revision(locked.sync_revision)
    return locked.sync_revision


def commit_and_push(db: Session, user: User) -> None:
    """Commit the open transaction, then notify other devices."""
    revision = current_revision()
    device_id = current_device_id()
    user_id = user.id
    db.commit()

    if revision is None or user_id is None:
        return

    try:
        push_sync_revision(user_id, revision, device_id)
    except Exception:
        logger.exception("Sync push failed after commit for user %s", user_id)


def safe_rollback(db: Session) -> None:
    """Roll back without hiding the original error if the session is already broken."""
    try:
        db.rollback()
    except SQLAlchemyError:
        logger.exception("Rollback failed")
