import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS
from app.core.db import client
from app.core.errors import record_error, request_context_middleware
from app.migrations.runner import run_migrations
from app.modules import catalogue, estimates, identity, templates

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
app = FastAPI(title="ArchEngine — Construction Cost Engine", version="1.0.0")

app.include_router(identity.router)
app.include_router(catalogue.router)
app.include_router(templates.router)
app.include_router(estimates.router)
app.middleware("http")(request_context_middleware)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"],
                   expose_headers=["Content-Disposition", "x-request-id"])


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    if exc.status_code >= 500:
        await record_error("backend", str(exc.detail), request, exc.status_code)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    msg = "; ".join(f"{'.'.join(str(x) for x in e['loc'][1:])}: {e['msg']}" for e in exc.errors())
    return JSONResponse({"detail": msg}, status_code=422)


@app.exception_handler(ValueError)
async def value_error(request: Request, exc: ValueError):
    return JSONResponse({"detail": str(exc)}, status_code=422)


@app.get("/api/health")
async def health():
    return {"ok": True}


@app.on_event("startup")
async def startup():
    await run_migrations()


@app.on_event("shutdown")
async def shutdown():
    client.close()
