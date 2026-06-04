"""
FastAPI application entry point.

Run locally with:
    uvicorn app.main:app --reload
"""

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.config import CORS_ALLOW_VERCEL, CORS_ORIGINS
from app.database import check_database_connection
from app.routers import auth, lists, projects, tasks

logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Project Manager API",
    description="Multi-user task manager with lists, projects, priorities, and JWT auth.",
    version="0.1.0",
)

# --- CORS ---
# Browsers block cross-origin requests unless the API explicitly allows the frontend origin.
# Local dev: http://localhost:5173
# Vercel: add your exact URL to CORS_ORIGINS on Render, or use CORS_ALLOW_VERCEL=true (default).
cors_kwargs: dict = {
    "allow_origins": CORS_ORIGINS,
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if CORS_ALLOW_VERCEL:
    # Matches https://your-app.vercel.app and preview URLs like https://your-app-abc123.vercel.app
    cors_kwargs["allow_origin_regex"] = r"https://.*\.vercel\.app"

app.add_middleware(CORSMiddleware, **cors_kwargs)


@app.exception_handler(OperationalError)
async def database_operational_error_handler(
    request: Request,
    exc: OperationalError,
) -> JSONResponse:
    """
    Return JSON instead of crashing when Postgres is unreachable.

    Without this, auth routes can throw 500 and the frontend may show a vague error.
    """
    logger.error("Database connection error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database is temporarily unavailable. "
                "Check DATABASE_URL on Render and that Neon is running."
            ),
        },
    )


app.include_router(auth.router)
app.include_router(lists.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple endpoint to confirm the API process is running (no database)."""
    return {"status": "ok"}


@app.get("/health/db")
def health_database() -> dict[str, str]:
    """
    Confirms the API can query Neon/Postgres.

    Use after deploy: https://YOUR-APP.onrender.com/health/db
    """
    ok, message = check_database_connection()
    if ok:
        return {"status": "ok", "database": message}
    raise HTTPException(
        status_code=503,
        detail={"status": "error", "database": message},
    )
