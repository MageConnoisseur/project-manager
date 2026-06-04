"""
Application settings loaded from environment variables.

We never hardcode real secrets or database URLs in source code.
Copy .env.example to .env and fill in real values for local development.
"""

import os

from dotenv import load_dotenv

load_dotenv()


def _require_env(name: str) -> str:
    """Read a required environment variable or fail fast with a clear message."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Add it to your .env file (see .env.example)."
        )
    return value


# --- Database (used by app/database.py) ---
DATABASE_URL = os.getenv("DATABASE_URL")

# --- JWT authentication ---
# Used to sign login tokens. MUST be a long random string (see .env.example).
#
# Why we refuse weak defaults:
# If everyone uses the same SECRET_KEY, an attacker can forge JWTs and log in
# as any user. We fail at startup instead of allowing that in production.
_INSECURE_SECRET_PLACEHOLDERS = (
    "change-me-in-production-use-openssl-rand",
    "change-me-in-production",
)

_raw_secret_key = os.getenv("SECRET_KEY")

if not _raw_secret_key:
    raise RuntimeError(
        "SECRET_KEY is not set. Add it to your .env file.\n"
        "Generate one with: openssl rand -hex 32"
    )

if _raw_secret_key in _INSECURE_SECRET_PLACEHOLDERS:
    raise RuntimeError(
        "SECRET_KEY is still a placeholder value. Replace it in .env with a "
        "unique random string (run: openssl rand -hex 32)"
    )

SECRET_KEY: str = _raw_secret_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# --- CORS (frontend on Vercel talking to backend on Render) ---
# Comma-separated list of allowed origins, e.g. http://localhost:5173,https://myapp.vercel.app
_cors_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
CORS_ORIGINS = [origin.strip() for origin in _cors_raw.split(",") if origin.strip()]

# When true, also allow any https://*.vercel.app origin (preview + production deploys).
CORS_ALLOW_VERCEL = os.getenv("CORS_ALLOW_VERCEL", "true").lower() in ("1", "true", "yes")
