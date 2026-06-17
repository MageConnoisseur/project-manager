"""
Pydantic models for Task endpoints, including the priority reorder payload.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.enums import RecurrenceUnit


class TaskCreateRequest(BaseModel):
    """Body for POST /tasks."""

    project_id: int
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    due_date: Optional[date] = None
    is_completed: bool = False
    priority_index: float = 0.0
    is_recurring: bool = False
    recurrence_interval: Optional[int] = Field(default=None, ge=1)
    recurrence_unit: Optional[RecurrenceUnit] = None
    recurrence_end_date: Optional[date] = None


class TaskUpdateRequest(BaseModel):
    """Body for PUT /tasks/{task_id}."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None
    priority_index: Optional[float] = None
    is_recurring: Optional[bool] = None
    recurrence_interval: Optional[int] = Field(default=None, ge=1)
    recurrence_unit: Optional[RecurrenceUnit] = None
    recurrence_end_date: Optional[date] = None
    project_id: Optional[int] = Field(
        default=None,
        description="Move task to another project (must belong to you)",
    )


class TaskResponse(BaseModel):
    """Single task returned from the API."""

    id: int
    project_id: int
    workspace_id: int
    title: str
    description: str
    due_date: Optional[date]
    is_completed: bool
    priority_index: float
    is_recurring: bool
    recurrence_interval: Optional[int]
    recurrence_unit: Optional[RecurrenceUnit]
    recurrence_end_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskReorderItem(BaseModel):
    """One task entry inside the reorder request."""

    task_id: int
    priority_index: float


class TaskReorderRequest(BaseModel):
    """Body for PUT /tasks/reorder — full new order for the priority view."""

    items: list[TaskReorderItem] = Field(min_length=1)
