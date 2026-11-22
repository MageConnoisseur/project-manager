"""
Read endpoints for the phone.

The phone opens from its own copy. These routes tell it whether the website
moved ahead, and send only the rows that changed.
"""

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.models import Project, SyncChange, Task, User, Workspace
from app.schemas.sync import (
    SyncChangeItem,
    SyncChangesResponse,
    SyncSnapshotResponse,
    SyncStatusResponse,
)
from app.services.sync_log import OP_DELETE
from app.utils.time import utc_now

router = APIRouter(prefix="/sync", tags=["sync"])


def _workspaces(db: Session, user: User) -> list[Workspace]:
    return list(
        db.exec(
            select(Workspace)
            .where(Workspace.user_id == user.id)
            .order_by(Workspace.id)
        ).all()
    )


def _projects(db: Session, user: User) -> list[Project]:
    return list(
        db.exec(
            select(Project)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Workspace.user_id == user.id)
            .order_by(Project.id)
        ).all()
    )


def _tasks(db: Session, user: User) -> list[Task]:
    return list(
        db.exec(
            select(Task)
            .join(Workspace, Task.workspace_id == Workspace.id)
            .where(Workspace.user_id == user.id)
            .order_by(Task.priority_index, Task.id)
        ).all()
    )


def _item_for_change(db: Session, user: User, change: SyncChange) -> SyncChangeItem:
    """Attach the current row, or a tombstone when the row is gone."""
    if change.op == OP_DELETE:
        return SyncChangeItem(
            revision=change.revision,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            op=OP_DELETE,
        )

    if change.entity_type == "workspace":
        workspace = db.exec(
            select(Workspace).where(
                Workspace.id == change.entity_id,
                Workspace.user_id == user.id,
            )
        ).first()
        if workspace is None:
            return SyncChangeItem(
                revision=change.revision,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                op=OP_DELETE,
            )
        return SyncChangeItem(
            revision=change.revision,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            op="upsert",
            workspace=workspace,
        )

    if change.entity_type == "project":
        project = db.exec(
            select(Project)
            .join(Workspace, Project.workspace_id == Workspace.id)
            .where(Project.id == change.entity_id, Workspace.user_id == user.id)
        ).first()
        if project is None:
            return SyncChangeItem(
                revision=change.revision,
                entity_type=change.entity_type,
                entity_id=change.entity_id,
                op=OP_DELETE,
            )
        return SyncChangeItem(
            revision=change.revision,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            op="upsert",
            project=project,
        )

    task = db.exec(
        select(Task)
        .join(Workspace, Task.workspace_id == Workspace.id)
        .where(Task.id == change.entity_id, Workspace.user_id == user.id)
    ).first()
    if task is None:
        return SyncChangeItem(
            revision=change.revision,
            entity_type=change.entity_type,
            entity_id=change.entity_id,
            op=OP_DELETE,
        )
    return SyncChangeItem(
        revision=change.revision,
        entity_type=change.entity_type,
        entity_id=change.entity_id,
        op="upsert",
        task=task,
    )


@router.get("/status", response_model=SyncStatusResponse)
def sync_status(current_user: User = Depends(get_current_user)) -> SyncStatusResponse:
    """Return the revision only. The phone uses this to see if a pull is needed."""
    return SyncStatusResponse(revision=int(current_user.sync_revision or 0))


@router.get("/snapshot", response_model=SyncSnapshotResponse)
def sync_snapshot(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncSnapshotResponse:
    """Return every workspace, project, and task for the signed-in user."""
    return SyncSnapshotResponse(
        revision=int(current_user.sync_revision or 0),
        workspaces=_workspaces(db, current_user),
        projects=_projects(db, current_user),
        tasks=_tasks(db, current_user),
        server_time=utc_now(),
    )


@router.get("/changes", response_model=SyncChangesResponse)
def sync_changes(
    since: int = Query(ge=0, description="Phone's last applied revision"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncChangesResponse:
    """
    Changes after `since`.

    Several edits to the same row collapse to the latest one. The phone sets
    its cursor to `revision`, which is the account head, so it does not miss
    a row that was edited and then deleted.
    """
    rows = list(
        db.exec(
            select(SyncChange)
            .where(
                SyncChange.user_id == current_user.id,
                SyncChange.revision > since,
            )
            .order_by(SyncChange.revision)
        ).all()
    )

    latest: dict[tuple[str, int], SyncChange] = {}
    for row in rows:
        latest[(row.entity_type, row.entity_id)] = row

    ordered = sorted(latest.values(), key=lambda row: row.revision)
    changes = [_item_for_change(db, current_user, row) for row in ordered]
    return SyncChangesResponse(
        revision=int(current_user.sync_revision or 0),
        changes=changes,
    )
