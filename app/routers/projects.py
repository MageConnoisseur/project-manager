"""
CRUD routes for Projects.

Projects belong to a list (workspace). We always verify the list is owned by
the logged-in user before creating, reading, updating, or deleting a project.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.core.ownership import get_owned_project, get_owned_workspace
from app.models import Project, Task, User, Workspace
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(
    workspace_id: Optional[int] = Query(
        default=None,
        description="Optional filter: only projects in this list",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Project]:
    """
    Return all projects owned by the user (through their workspaces).

    If workspace_id is provided, we also confirm that list belongs to the user.
    """
    statement = (
        select(Project)
        .join(Workspace, Project.workspace_id == Workspace.id)
        .where(Workspace.user_id == current_user.id)
    )

    if workspace_id is not None:
        # Confirms the list exists and is owned; raises 404 otherwise.
        get_owned_workspace(db, workspace_id, current_user)
        statement = statement.where(Project.workspace_id == workspace_id)

    statement = statement.order_by(Project.id)
    return list(db.exec(statement).all())


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Create a project inside a list the user owns."""
    get_owned_workspace(db, body.workspace_id, current_user)

    project = Project(
        workspace_id=body.workspace_id,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Return one project if it belongs to the user."""
    return get_owned_project(db, project_id, current_user)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    body: ProjectUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Update project fields. Moving to another list requires owning that list too."""
    project = get_owned_project(db, project_id, current_user)

    if body.workspace_id is not None:
        # User is moving this project to a different list (workspace).
        get_owned_workspace(db, body.workspace_id, current_user)
        project.workspace_id = body.workspace_id

        # Tasks store workspace_id separately for fast priority-list queries.
        # When the project moves lists, every child task must move with it or
        # they would still show up under the old list in the Priority View.
        child_tasks = db.exec(
            select(Task).where(Task.project_id == project.id)
        ).all()
        for child_task in child_tasks:
            child_task.workspace_id = body.workspace_id
            child_task.updated_at = datetime.utcnow()
            db.add(child_task)

    if body.title is not None:
        project.title = body.title
    if body.description is not None:
        project.description = body.description
    if "due_date" in body.model_fields_set:
        # Allow explicitly clearing due_date by sending null in JSON.
        project.due_date = body.due_date

    project.updated_at = datetime.utcnow()
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a project owned by the user, including all tasks inside it."""
    project = get_owned_project(db, project_id, current_user)

    for task in db.exec(select(Task).where(Task.project_id == project.id)).all():
        db.delete(task)

    db.delete(project)
    db.commit()
