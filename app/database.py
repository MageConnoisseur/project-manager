"""
Database engine and session setup.

Reads DATABASE_URL from the environment (never hardcoded).
Neon connection strings are normalized for Render/Linux + psycopg2.
"""

import os
import sys
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from dotenv import load_dotenv
from sqlalchemy import text
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


def prepare_database_url(raw_url: str) -> str:
    """
    Fix common Neon URL issues that break SQLAlchemy/psycopg2 on Render.

    - postgres:// → postgresql:// (SQLAlchemy style)
    - Remove channel_binding=require (often breaks psycopg2 on Linux)
    - Ensure sslmode=require for Neon
    """
    url = raw_url.strip()

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    parsed = urlparse(url)
    query_pairs = parse_qsl(parsed.query, keep_blank_values=True)

    cleaned_pairs: list[tuple[str, str]] = []
    has_sslmode = False

    for key, value in query_pairs:
        # channel_binding breaks many psycopg2 deployments (including Render).
        if key.lower() == "channel_binding":
            continue
        if key.lower() == "sslmode":
            has_sslmode = True
        cleaned_pairs.append((key, value))

    if not has_sslmode:
        cleaned_pairs.append(("sslmode", "require"))

    new_query = urlencode(cleaned_pairs)
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        )
    )


def create_db_engine():
    """Build the SQLAlchemy engine with settings suited for Neon + cloud hosts."""
    database_url = prepare_database_url(validate_database_url())

    return create_engine(
        database_url,
        echo=False,
        # Drop dead connections (important when Neon/Render idle or wake from sleep).
        pool_pre_ping=True,
        pool_recycle=300,
    )


engine = create_db_engine()


def check_database_connection() -> tuple[bool, str]:
    """
    Run a simple query to verify the API can reach Postgres.
    Used by GET /health/db for deployment troubleshooting.
    """
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        return True, "connected"
    except Exception as exc:
        return False, str(exc)


def get_session():
    with Session(engine) as session:
        yield session
