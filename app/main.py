"""
FastAPI application entry point.

Run locally with:
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.routers import auth, lists, projects, tasks

app = FastAPI(
    title="Project Manager API",
    description="Multi-user task manager with lists, projects, priorities, and JWT auth.",
    version="0.1.0",
)

# Allow the React frontend (local or Vercel) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(lists.router)
app.include_router(projects.router)
app.include_router(tasks.router)


@app.get("/health")
def health_check() -> dict[str, str]:
    """Simple endpoint to confirm the API is running (no auth required)."""
    return {"status": "ok"}
