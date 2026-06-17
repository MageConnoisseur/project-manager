from datetime import date, datetime
from typing import TYPE_CHECKING, Optional

from sqlmodel import Field, Relationship, SQLModel

from app.models.enums import RecurrenceUnit

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.workspace import Workspace


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="projects.id", index=True)
    workspace_id: int = Field(foreign_key="workspaces.id", index=True)
    title: str = Field(max_length=255)
    description: str = Field(default="")
    due_date: Optional[date] = Field(default=None, index=True)
    is_completed: bool = Field(default=False)
    priority_index: float = Field(default=0.0, index=True)
    is_recurring: bool = Field(default=False)
    recurrence_interval: Optional[int] = Field(default=None, ge=1)
    recurrence_unit: Optional[RecurrenceUnit] = Field(default=None)
    recurrence_end_date: Optional[date] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    project: Optional["Project"] = Relationship(back_populates="tasks")
    workspace: Optional["Workspace"] = Relationship(back_populates="tasks")
