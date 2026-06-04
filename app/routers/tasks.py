"""
CRUD routes for Tasks, plus PUT /tasks/reorder for the priority view.

The reorder route is defined BEFORE /{task_id} so FastAPI does not treat
"reorder" as a task id.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select

from app.core.dependencies import get_current_user, get_db
from app.core.ownership import get_owned_project, get_owned_task, get_owned_workspace
from app.models import Task, User, Workspace
from app.models.enums import RecurrenceUnit
from app.schemas.task import (
    TaskCreateRequest,
    TaskReorderRequest,
    TaskResponse,
    TaskUpdateRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _validate_recurrence_fields(
    is_recurring: bool,
    recurrence_interval: Optional[int],
    recurrence_unit: Optional[RecurrenceUnit],
) -> None:
    """
    Recurring tasks must include interval + unit; non-recurring tasks must not.

    This keeps bad combinations out of the database before we commit.
    """
    if is_recurring:
        if recurrence_interval is None or recurrence_unit is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Recurring tasks require recurrence_interval and recurrence_unit",
            )
    else:
        if recurrence_interval is not None or recurrence_unit is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Non-recurring tasks cannot set recurrence fields",
            )


def _apply_recurring_completion_reset(task: Task) -> None:
    """
    When a recurring task is marked complete, advance it to the next cycle.

    Keeps is_completed True (the user just finished this period) and pushes
    due_date forward based on interval + unit. Does not archive the task.
    """
    if not task.is_recurring or task.recurrence_interval is None or task.recurrence_unit is None:
        return

    if task.due_date is None:
        return

    interval = task.recurrence_interval
    if task.recurrence_unit == RecurrenceUnit.DAY:
        task.due_date = task.due_date + timedelta(days=interval)
    elif task.recurrence_unit == RecurrenceUnit.WEEK:
        task.due_date = task.due_date + timedelta(weeks=interval)
    elif task.recurrence_unit == RecurrenceUnit.MONTH:
        # Approximate months as 30 days for simplicity in Phase 2.
        task.due_date = task.due_date + timedelta(days=30 * interval)


@router.put("/reorder", response_model=list[TaskResponse])
def reorder_tasks(
    body: TaskReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Task]:
    """
    Update priority_index for many tasks at once inside one database transaction.

    Used after drag-and-drop in the Priority List View.

    Two-phase approach (safer than updating while we validate):
    1) Verify every task id belongs to the current user — no database writes yet.
    2) Apply all priority changes and commit once. If anything fails, roll back all.
    """
    # --- Phase 1: ownership checks only (read-only) ---
    tasks_to_update: list[tuple[Task, float]] = []
    seen_task_ids: set[int] = set()

    for item in body.items:
        # Reject duplicate ids in the same request (would cause confusing results).
        if item.task_id in seen_task_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate task_id in reorder request: {item.task_id}",
            )
        seen_task_ids.add(item.task_id)

        task = get_owned_task(db, item.task_id, current_user)
        tasks_to_update.append((task, item.priority_index))

    # --- Phase 2: apply updates inside one transaction ---
    updated_tasks: list[Task] = []

    try:
        for task, new_priority_index in tasks_to_update:
            task.priority_index = new_priority_index
            task.updated_at = datetime.utcnow()
            db.add(task)
            updated_tasks.append(task)

        # Single commit: either every task updates or none do.
        db.commit()

        for task in updated_tasks:
            db.refresh(task)

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise

    return updated_tasks


@router.get("", response_model=list[TaskResponse])
def list_tasks(
    workspace_id: Optional[int] = Query(
        default=None,
        description="Filter by list (for priority view)",
    ),
    project_id: Optional[int] = Query(
        default=None,
        description="Filter by project",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Task]:
    """
    Return tasks for the logged-in user, optionally filtered by list or project.

    Results are ordered by priority_index for the priority view UI.
    """
    statement = (
        select(Task)
        .join(Workspace, Task.workspace_id == Workspace.id)
        .where(Workspace.user_id == current_user.id)
    )

    if workspace_id is not None:
        get_owned_workspace(db, workspace_id, current_user)
        statement = statement.where(Task.workspace_id == workspace_id)

    if project_id is not None:
        project = get_owned_project(db, project_id, current_user)
        statement = statement.where(Task.project_id == project.id)

    statement = statement.order_by(Task.priority_index, Task.id)
    return list(db.exec(statement).all())


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(
    body: TaskCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    """
    Create a task under a project the user owns.

    workspace_id is copied from the project so priority queries stay fast.
    """
    project = get_owned_project(db, body.project_id, current_user)
    _validate_recurrence_fields(
        body.is_recurring,
        body.recurrence_interval,
        body.recurrence_unit,
    )

    task = Task(
        project_id=project.id,
        workspace_id=project.workspace_id,
        title=body.title,
        description=body.description,
        due_date=body.due_date,
        is_completed=body.is_completed,
        priority_index=body.priority_index,
        is_recurring=body.is_recurring,
        recurrence_interval=body.recurrence_interval if body.is_recurring else None,
        recurrence_unit=body.recurrence_unit if body.is_recurring else None,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    """Return one task if it belongs to the user."""
    return get_owned_task(db, task_id, current_user)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    body: TaskUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Task:
    """Update a task. Handles recurring completion reset when marked complete."""
    task = get_owned_task(db, task_id, current_user)

    if body.project_id is not None:
        project = get_owned_project(db, body.project_id, current_user)
        task.project_id = project.id
        task.workspace_id = project.workspace_id

    if body.title is not None:
        task.title = body.title
    if body.description is not None:
        task.description = body.description
    if "due_date" in body.model_fields_set:
        task.due_date = body.due_date
    if body.priority_index is not None:
        task.priority_index = body.priority_index

    # Track whether recurrence settings or completion status are changing.
    new_is_recurring = body.is_recurring if body.is_recurring is not None else task.is_recurring
    new_interval = (
        body.recurrence_interval if body.recurrence_interval is not None else task.recurrence_interval
    )
    new_unit = body.recurrence_unit if body.recurrence_unit is not None else task.recurrence_unit

    if body.is_recurring is not None:
        task.is_recurring = body.is_recurring
        if not body.is_recurring:
            task.recurrence_interval = None
            task.recurrence_unit = None
            new_interval = None
            new_unit = None

    if body.recurrence_interval is not None:
        task.recurrence_interval = body.recurrence_interval
    if body.recurrence_unit is not None:
        task.recurrence_unit = body.recurrence_unit

    _validate_recurrence_fields(new_is_recurring, new_interval, new_unit)

    if body.is_completed is not None:
        task.is_completed = body.is_completed
        if body.is_completed and task.is_recurring:
            _apply_recurring_completion_reset(task)

    task.updated_at = datetime.utcnow()
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a task owned by the user."""
    task = get_owned_task(db, task_id, current_user)
    db.delete(task)
    db.commit()
