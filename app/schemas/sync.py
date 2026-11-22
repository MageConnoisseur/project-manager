"""Response models for the phone sync reads."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.list import ListResponse
from app.schemas.project import ProjectResponse
from app.schemas.task import TaskResponse


class SyncStatusResponse(BaseModel):
    """The account's current revision. One number is enough to see if anything changed."""

    revision: int


class SyncChangeItem(BaseModel):
    """
    The latest change for one row since the phone's revision.

    upsert includes the current body. delete is a tombstone with no body.
    """

    revision: int
    entity_type: str
    entity_id: int
    op: str
    workspace: Optional[ListResponse] = None
    project: Optional[ProjectResponse] = None
    task: Optional[TaskResponse] = None


class SyncChangesResponse(BaseModel):
    revision: int
    changes: list[SyncChangeItem]


class SyncSnapshotResponse(BaseModel):
    """Full account, used the first time a phone signs in and for repair."""

    revision: int
    workspaces: list[ListResponse]
    projects: list[ProjectResponse]
    tasks: list[TaskResponse]
    server_time: datetime
