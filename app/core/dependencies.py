"""
FastAPI dependencies shared across routers.

Dependencies are functions FastAPI runs before your route handler.
They can provide a database session or the currently logged-in user.
"""

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.security import decode_access_token
from app.database import engine
from app.models import User

# Tells FastAPI that login lives at POST /auth/token and tokens go in Authorization: Bearer ...
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_db() -> Generator[Session, None, None]:
    """
    Open one database session per request and close it when the request finishes.

    Using a generator ensures connections are not left open after the response is sent.
    """
    with Session(engine) as session:
        yield session


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Read the JWT from the request header, decode it, and load the matching User row.

    Any route that includes `current_user: User = Depends(get_current_user)` will
    automatically return 401 Unauthorized if the token is missing or invalid.
    """
    user_id_str = decode_access_token(token)
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Look up the user in the database so we know they still exist.
    user = db.exec(select(User).where(User.id == user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
