"""
Pydantic models for authentication API requests and responses.

These are separate from SQLModel database tables so we never accidentally
return password hashes in API responses.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class UserSignupRequest(BaseModel):
    """Body for POST /auth/signup."""

    email: EmailStr
    password: str = Field(min_length=8, description="At least 8 characters")
    display_name: str = Field(min_length=1, max_length=255)


class UserPublicResponse(BaseModel):
    """Safe user fields returned after signup or from /auth/me."""

    id: int
    email: str
    display_name: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    """Body returned after successful login."""

    access_token: str
    token_type: str = "bearer"
