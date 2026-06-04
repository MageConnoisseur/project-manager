"""
Helpers that prove a list, project, or task belongs to the logged-in user.

Every protected route should use these before reading or writing data.
We never trust ids from the URL without checking ownership.
"""

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models import Project, Task, User, Workspace


def get_owned_workspace(db: Session, workspace_id: int, current_user: User) -> Workspace:
    """
    Load a workspace (list) only if its user_id matches the authenticated user.

    Raises 404 if the list does not exist or belongs to someone else.
    We use 404 instead of 403 so we do not leak whether an id exists.
    """
    workspace = db.exec(
        select(Workspace).where(
            Workspace.id == workspace_id,
            Workspace.user_id == current_user.id,
        )
    ).first()

    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "List not found or you do not have access. "
                "Call GET /lists while logged in and use one of those ids as workspace_id."
            ),
        )

    return workspace


def get_owned_project(db: Session, project_id: int, current_user: User) -> Project:
    """
    Load a project only if it lives inside a workspace owned by this user.

    We join through Workspace because projects do not store user_id directly;
    ownership flows: User -> Workspace -> Project.
    """
    project = db.exec(
        select(Project)
        .join(Workspace, Project.workspace_id == Workspace.id)
        .where(
            Project.id == project_id,
            Workspace.user_id == current_user.id,
        )
    ).first()

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def get_owned_task(db: Session, task_id: int, current_user: User) -> Task:
    """
    Load a task only if the full ownership chain is valid for this user.

    We check three things at once:
    1) The task's workspace (list) belongs to the current user.
    2) The task's project exists on that same workspace.
    3) The task's workspace_id matches the project's workspace_id (no mismatched rows).

    That last check prevents acting on corrupted or inconsistent task data.
    """
    task = db.exec(
        select(Task)
        .join(Workspace, Task.workspace_id == Workspace.id)
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.id == task_id,
            Workspace.user_id == current_user.id,
            # Project must live in the same list the task claims to be in.
            Project.workspace_id == Workspace.id,
        )
    ).first()

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return task
