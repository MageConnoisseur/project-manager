"""
Store a successful phone write so a retry does not apply it twice.

A recurring completion is the important case: repeating the same key must not
move the due date forward a second time.
"""

import logging
from datetime import timedelta
from typing import Optional, Union

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.security import decode_access_token
from app.models import ClientMutation
from app.utils.time import utc_now

logger = logging.getLogger("uvicorn.error")

_IN_PROGRESS = 0
_CLAIM_STALE_AFTER = timedelta(minutes=2)


def user_id_from_authorization(authorization: Optional[str]) -> Optional[int]:
    """Return the user id from a Bearer token, or None if it is missing or invalid."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    subject = decode_access_token(token)
    if subject is None:
        return None
    try:
        return int(subject)
    except ValueError:
        return None


def _as_utc(moment):
    if moment.tzinfo is None:
        return moment.replace(tzinfo=utc_now().tzinfo)
    return moment


def claim_mutation(db: Session, user_id: int, key: str) -> Union[ClientMutation, str]:
    """
    Reserve this key, or return the stored response if it already finished.

    Returns the string "in_progress" when another request still holds the key.
    """
    existing = db.exec(
        select(ClientMutation).where(
            ClientMutation.user_id == user_id,
            ClientMutation.idempotency_key == key,
        )
    ).first()

    if existing is not None:
        if existing.status_code != _IN_PROGRESS:
            return existing
        age = utc_now() - _as_utc(existing.created_at)
        if age < _CLAIM_STALE_AFTER:
            return "in_progress"
        db.delete(existing)
        db.commit()

    row = ClientMutation(user_id=user_id, idempotency_key=key, status_code=_IN_PROGRESS)
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        raced = db.exec(
            select(ClientMutation).where(
                ClientMutation.user_id == user_id,
                ClientMutation.idempotency_key == key,
            )
        ).first()
        if raced is None:
            return "in_progress"
        if raced.status_code != _IN_PROGRESS:
            return raced
        return "in_progress"


def finish_mutation(
    db: Session,
    user_id: int,
    key: str,
    status_code: int,
    response_body: str,
    sync_revision: Optional[int],
) -> None:
    """Save a successful response, or release the claim so a failed write can be retried."""
    row = db.exec(
        select(ClientMutation).where(
            ClientMutation.user_id == user_id,
            ClientMutation.idempotency_key == key,
        )
    ).first()
    if row is None:
        return

    if 200 <= status_code < 300:
        row.status_code = status_code
        row.response_body = response_body
        row.sync_revision = sync_revision
        db.add(row)
        db.commit()
        return

    db.delete(row)
    db.commit()


def release_claim(db: Session, user_id: int, key: str) -> None:
    """Drop an unfinished claim after an exception so the phone can retry."""
    try:
        row = db.exec(
            select(ClientMutation).where(
                ClientMutation.user_id == user_id,
                ClientMutation.idempotency_key == key,
            )
        ).first()
        if row is not None and row.status_code == _IN_PROGRESS:
            db.delete(row)
            db.commit()
    except Exception:
        logger.exception("Failed to release idempotency claim")
        db.rollback()
