import os
import sys

from dotenv import load_dotenv
from sqlmodel import Session, create_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

_PLACEHOLDER_MARKERS = (
    "postgresql://user:password@",
    "postgresql://postgres:postgres@localhost",
)


def validate_database_url() -> str:
    if not DATABASE_URL:
        print(
            "DATABASE_URL is not set. Copy .env.example to .env and paste your Postgres connection string.",
            file=sys.stderr,
        )
        sys.exit(1)

    if any(marker in DATABASE_URL for marker in _PLACEHOLDER_MARKERS):
        print(
            "DATABASE_URL still uses placeholder credentials from .env.example.\n"
            "Set it to your Neon connection string (Neon console -> Connect) or local Postgres credentials.",
            file=sys.stderr,
        )
        sys.exit(1)

    return DATABASE_URL


engine = create_engine(validate_database_url(), echo=False)


def get_session():
    with Session(engine) as session:
        yield session
