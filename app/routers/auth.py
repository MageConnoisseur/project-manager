"""
Authentication routes: signup, login (JWT), and current user profile.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session, select

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.core.dependencies import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import TokenResponse, UserPublicResponse, UserSignupRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserPublicResponse, status_code=status.HTTP_201_CREATED)
def signup(body: UserSignupRequest, db: Session = Depends(get_db)) -> User:
    """
    Register a new user account.

    The password is hashed before we save anything. We never store plain passwords.
    """
    try:
        existing = db.exec(select(User).where(User.email == body.email)).first()
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is temporarily unavailable. Please try again shortly.",
        )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    new_user = User(
        email=body.email,
        display_name=body.display_name,
        password_hash=hash_password(body.password),
    )
    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        # Two signups with the same email at the same time can both pass the
        # "existing user" check above; the database unique index catches the race.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    return new_user


@router.post("/token", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    """
    Log in with email + password and receive a JWT.

    OAuth2 expects form fields named `username` and `password`.
    We use `username` for the user's email address (FastAPI convention).
    """
    try:
        user = db.exec(select(User).where(User.email == form_data.username)).first()
    except OperationalError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is temporarily unavailable. Please try again shortly.",
        )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # verify_password returns False for wrong passwords or invalid stored hashes.
    password_matches = verify_password(form_data.password, user.password_hash)

    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        subject=str(user.id),
        expires_minutes=ACCESS_TOKEN_EXPIRE_MINUTES,
    )
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserPublicResponse)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    """Return the profile of whoever is logged in (requires valid JWT)."""
    return current_user
