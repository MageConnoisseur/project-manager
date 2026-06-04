"""
Password hashing and JWT (JSON Web Token) helpers.

We use bcrypt so raw passwords are never stored in the database.
JWTs let the frontend send a token on each request instead of sending the password again.
"""

from datetime import datetime, timedelta
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.config import ALGORITHM, SECRET_KEY


def hash_password(plain_password: str) -> str:
    """Turn a plain-text password into a one-way hash safe to store in Postgres."""
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Compare a login password with the stored hash. Returns True if they match."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Stored value is not a valid bcrypt hash (e.g. old seed placeholder text).
        return False


def create_access_token(subject: str, expires_minutes: int) -> str:
    """
    Build a signed JWT.

    `subject` is usually the user's id as a string. The frontend sends this token
    in the Authorization header; we decode it in get_current_user to find who is logged in.
    """
    expire_at = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    """
    Validate a JWT and return the subject (user id) inside it.

    Returns None if the token is expired, tampered with, or otherwise invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        subject = payload.get("sub")
        if subject is None:
            return None
        return str(subject)
    except JWTError:
        return None
