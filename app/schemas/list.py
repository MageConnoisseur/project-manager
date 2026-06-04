"""
Pydantic models for List (Workspace) endpoints.

The UI calls them "lists"; the database table is `workspaces`.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ListCreateRequest(BaseModel):
    """Body for POST /lists."""

    name: str = Field(min_length=1, max_length=255)


class ListUpdateRequest(BaseModel):
    """Body for PUT /lists/{list_id}. All fields optional."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)


class ListResponse(BaseModel):
    """Single list returned from the API."""

    id: int
    user_id: int
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
