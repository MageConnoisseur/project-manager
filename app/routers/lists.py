"""
CRUD routes for Lists (stored as Workspace rows in the database).

Every route requires authentication and only touches rows where user_id matches.
"""

from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.core.ownership import get_owned_workspace
from app.models import Project, Task, User, Workspace
from app.schemas.list import ListCreateRequest, ListResponse, ListUpdateRequest
from app.services.sync_log import (
    ENTITY_PROJECT,
    ENTITY_TASK,
    ENTITY_WORKSPACE,
    OP_DELETE,
    OP_UPSERT,
    commit_and_push,
    record_change,
)
from app.utils.time import utc_now

router = APIRouter(prefix="/lists", tags=["lists"])


@router.get("", response_model=list[ListResponse])
def list_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Workspace]:
    """Return all lists belonging to the logged-in user."""
    return list(
        db.exec(
            select(Workspace)
            .where(Workspace.user_id == current_user.id)
            .order_by(Workspace.id)
        ).all()
    )


@router.post("", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
def create_list(
    body: ListCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """Create a new list owned by the current user."""
    workspace = Workspace(user_id=current_user.id, name=body.name)
    db.add(workspace)
    db.flush()
    record_change(db, current_user, ENTITY_WORKSPACE, workspace.id, OP_UPSERT)
    commit_and_push(db, current_user)
    db.refresh(workspace)
    return workspace


@router.get("/{list_id}", response_model=ListResponse)
def get_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """Return one list if it belongs to the current user."""
    return get_owned_workspace(db, list_id, current_user)


@router.put("/{list_id}", response_model=ListResponse)
def update_list(
    list_id: int,
    body: ListUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Workspace:
    """Update a list's name (only if owned by the current user)."""
    workspace = get_owned_workspace(db, list_id, current_user)

    if body.name is not None:
        workspace.name = body.name

    workspace.updated_at = utc_now()
    db.add(workspace)
    record_change(db, current_user, ENTITY_WORKSPACE, workspace.id, OP_UPSERT)
    commit_and_push(db, current_user)
    db.refresh(workspace)
    return workspace


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a list owned by the current user, including all projects and tasks inside it.
    """
    workspace = get_owned_workspace(db, list_id, current_user)

    for task in db.exec(select(Task).where(Task.workspace_id == workspace.id)).all():
        record_change(db, current_user, ENTITY_TASK, task.id, OP_DELETE)
        db.delete(task)

    for project in db.exec(select(Project).where(Project.workspace_id == workspace.id)).all():
        record_change(db, current_user, ENTITY_PROJECT, project.id, OP_DELETE)
        db.delete(project)

    record_change(db, current_user, ENTITY_WORKSPACE, workspace.id, OP_DELETE)
    db.delete(workspace)
    commit_and_push(db, current_user)
