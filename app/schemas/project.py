"""
Pydantic models for Project endpoints.
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ProjectCreateRequest(BaseModel):
    """Body for POST /projects."""

    workspace_id: int = Field(
        gt=0,
        description="Id from GET /lists (must be > 0; do not use Swagger's default 0)",
    )
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    due_date: Optional[date] = None


class ProjectUpdateRequest(BaseModel):
    """Body for PUT /projects/{project_id}."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    due_date: Optional[date] = None
    workspace_id: Optional[int] = Field(
        default=None,
        description="Move project to another list (must still belong to you)",
    )


class ProjectResponse(BaseModel):
    """Single project returned from the API."""

    id: int
    workspace_id: int
    title: str
    description: str
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
