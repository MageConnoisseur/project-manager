"""
CRUD routes for Lists (stored as Workspace rows in the database).

Every route requires authentication and only touches rows where user_id matches.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.core.ownership import get_owned_workspace
from app.models import User, Workspace
from app.schemas.list import ListCreateRequest, ListResponse, ListUpdateRequest

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
    db.commit()
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

    workspace.updated_at = datetime.utcnow()
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace


@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Delete a list owned by the current user.

    Postgres will block the delete if projects or tasks still reference this list.
    We catch that error and return 409 Conflict with a helpful message instead of 500.
    """
    workspace = get_owned_workspace(db, list_id, current_user)

    try:
        db.delete(workspace)
        db.commit()
    except IntegrityError:
        # A child row (project or task) still points at this workspace_id.
        # Roll back so the session is clean for the next request.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot delete this list while it still has projects or tasks. "
                "Delete those items first, then try again."
            ),
        )
