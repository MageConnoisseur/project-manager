"""Replay a finished Idempotency-Key and attach X-Sync-Revision to writes."""

from typing import Optional

from sqlmodel import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.idempotency import (
    claim_mutation,
    finish_mutation,
    release_claim,
    user_id_from_authorization,
)
from app.core.request_context import begin_request_box, current_revision
from app.models import ClientMutation

_MAX_KEY_LENGTH = 200


def _open_session() -> Session:
    # Look up the engine at call time so tests can swap in a sqlite engine.
    from app.database import engine

    return Session(engine)


def _replay(row: ClientMutation) -> Response:
    headers = {}
    if row.sync_revision is not None:
        headers["X-Sync-Revision"] = str(row.sync_revision)
    media_type = "application/json" if row.response_body else None
    return Response(
        content=row.response_body,
        status_code=row.status_code,
        headers=headers,
        media_type=media_type,
    )


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    Phone writes send Idempotency-Key. The website does not, and is unchanged.

    GET requests pass through. A repeated key returns the first successful body.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        device_id = request.headers.get("x-device-id")
        begin_request_box(device_id.strip() if device_id else None)

        method = request.method.upper()
        key = request.headers.get("idempotency-key")
        if key is not None:
            key = key.strip()
        track = method not in ("GET", "HEAD", "OPTIONS") and bool(key)

        user_id: Optional[int] = None
        claimed = False

        if track:
            if len(key) > _MAX_KEY_LENGTH:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Idempotency-Key is too long"},
                )
            user_id = user_id_from_authorization(request.headers.get("authorization"))
            if user_id is not None:
                with _open_session() as db:
                    claimed_row = claim_mutation(db, user_id, key)
                if isinstance(claimed_row, ClientMutation) and claimed_row.status_code != 0:
                    return _replay(claimed_row)
                if claimed_row == "in_progress":
                    return JSONResponse(
                        status_code=409,
                        content={
                            "detail": "A request with this Idempotency-Key is already running.",
                        },
                    )
                claimed = True

        try:
            response = await call_next(request)
        except Exception:
            if claimed and user_id is not None and key:
                with _open_session() as db:
                    release_claim(db, user_id, key)
            raise

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        revision = current_revision()
        if claimed and user_id is not None and key:
            text = body.decode("utf-8", errors="replace")
            with _open_session() as db:
                finish_mutation(db, user_id, key, response.status_code, text, revision)

        headers = {
            name: value
            for name, value in response.headers.items()
            if name.lower() not in ("content-length", "content-type")
        }
        if revision is not None:
            headers["X-Sync-Revision"] = str(revision)

        return Response(
            content=body,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )
