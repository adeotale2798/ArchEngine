import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict = defaultdict(deque)


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "?")


def limit(bucket: str, request: Request, max_hits: int, window_s: int):
    """In-process sliding window limiter (see DECISIONS.md D-011)."""
    key = f"{bucket}:{client_ip(request)}"
    t = time.monotonic()
    dq = _hits[key]
    while dq and t - dq[0] > window_s:
        dq.popleft()
    if len(dq) >= max_hits:
        raise HTTPException(429, "Too many requests. Please wait and try again.")
    dq.append(t)
