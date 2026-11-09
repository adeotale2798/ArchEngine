import logging
import time
import traceback
import uuid

from fastapi import Request
from fastapi.responses import JSONResponse

from app.core.db import db, new_id, now

log = logging.getLogger("archengine")


async def record_error(source: str, message: str, request: Request | None = None, status: int = 500,
                       detail: str = "", org_id: str | None = None, extra: dict | None = None):
    try:
        await db.error_logs.insert_one({
            "id": new_id(), "source": source, "message": message[:2000], "detail": detail[:8000], "status": status,
            "path": str(request.url.path) if request else None, "method": request.method if request else None,
            "request_id": getattr(request.state, "request_id", None) if request else None,
            "organisation_id": org_id or (getattr(request.state, "org_id", None) if request else None),
            "extra": extra or {}, "resolved": False, "created_at": now(),
        })
    except Exception:  # never let logging break a request
        log.exception("failed to record error")


async def request_context_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception as exc:
        await record_error("backend", f"{type(exc).__name__}: {exc}", request, 500, traceback.format_exc())
        log.exception("unhandled error rid=%s", request.state.request_id)
        response = JSONResponse({"detail": "Internal error. Reference: " + request.state.request_id}, status_code=500)
    response.headers["x-request-id"] = request.state.request_id
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["referrer-policy"] = "same-origin"
    response.headers["x-frame-options"] = "SAMEORIGIN"
    log.info("%s %s %s %.1fms rid=%s", request.method, request.url.path, response.status_code,
             (time.perf_counter() - start) * 1000, request.state.request_id)
    return response
