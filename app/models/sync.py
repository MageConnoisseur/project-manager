"""Tables that let a phone catch up without downloading the whole account every time."""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, UniqueConstraint
from sqlmodel import Field, SQLModel

from app.utils.time import utc_now


class SyncChange(SQLModel, table=True):
    """One revision of one workspace, project, or task for one user."""

    __tablename__ = "sync_changes"
    __table_args__ = (
        UniqueConstraint("user_id", "revision", name="uq_sync_change_user_revision"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    revision: int = Field(sa_type=BigInteger, index=True)
    entity_type: str = Field(max_length=32)
    entity_id: int = Field(index=True)
    op: str = Field(max_length=16)
    created_at: datetime = Field(default_factory=utc_now)


class ClientMutation(SQLModel, table=True):
    """
    Stored result of a phone write.

    A retry with the same Idempotency-Key returns this row instead of applying
    the edit again. status_code 0 means the first attempt is still running.
    """

    __tablename__ = "client_mutations"
    __table_args__ = (
        UniqueConstraint("user_id", "idempotency_key", name="uq_client_mutation"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    idempotency_key: str = Field(max_length=200)
    status_code: int = Field(default=0)
    response_body: str = Field(default="")
    sync_revision: Optional[int] = Field(default=None, sa_type=BigInteger)
    created_at: datetime = Field(default_factory=utc_now)


class Device(SQLModel, table=True):
    """A phone registered to receive a silent sync push for this account."""

    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_user_device"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    device_id: str = Field(max_length=64)
    fcm_token: str = Field(max_length=512)
    platform: str = Field(default="android", max_length=32)
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
