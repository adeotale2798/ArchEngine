"""Identity, organisation settings, users/memberships, overview, audit and error logs, platform (super admin) provision."""
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.core.audit import audit
from app.core.db import NO_ID, clean, db, new_id, now
from app.core.deps import Ctx, current_user, get_ctx, need, tenant
from app.core.errors import record_error
from app.core.permissions import CAPABILITY_GROUPS, ROLES, custom_role_caps
from app.core.ratelimit import client_ip, limit
from app.core.security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api", tags=["identity"])
LOCK_AFTER, LOCK_MINUTES = 5, 15


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


@router.post("/auth/login")
async def login(body: LoginIn, request: Request):
    limit("login", request, 20, 60)
    email = body.email.lower()
    key = f"{client_ip(request)}:{email}"
    att = await db.login_attempts.find_one({"key": key}, NO_ID) or {}
    if att.get("locked_until") and att["locked_until"] > now():
        raise HTTPException(429, "Too many failed attempts. Try again in a few minutes.")
    user = await db.users.find_one({"email": email}, NO_ID)
    if not user or not user.get("active") or not verify_password(body.password, user["password_hash"]):
        from datetime import datetime, timedelta, timezone
        n = att.get("count", 0) + 1
        upd = {"key": key, "count": n, "updated_at": now()}
        if n >= LOCK_AFTER:
            upd["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCK_MINUTES)).isoformat()
            upd["count"] = 0
        await db.login_attempts.update_one({"key": key}, {"$set": upd}, upsert=True)
        raise HTTPException(401, "Invalid email or password")
    await db.login_attempts.delete_one({"key": key})
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": now()}})
    await audit(None, "login", "users", user["id"], actor=user, org_id=None)
    return {"token": create_token(user["id"]), "user": {k: user[k] for k in ("id", "email", "name")}}


@router.get("/auth/me")
async def me(ctx: Ctx = Depends(get_ctx)):
    mems = await db.memberships.find({"user_id": ctx.user["id"], "active": True}, NO_ID).to_list(50)
    orgs = {o["id"]: o for o in await db.organisations.find({"id": {"$in": [m["organisation_id"] for m in mems]}}, NO_ID).to_list(50)}
    return {"user": ctx.user, "organisation_id": ctx.org_id, "role": ctx.role, "role_label": ROLES.get(ctx.role, {}).get("label"),
            "capabilities": sorted(ctx.caps), "is_super_admin": ctx.is_super,
            "memberships": [{"organisation_id": m["organisation_id"], "role": m["role"], "name": orgs.get(m["organisation_id"], {}).get("name")} for m in mems]}


@router.post("/auth/change-password")
async def change_password(current: str = Body(..., embed=True), new: str = Body(..., embed=True, min_length=10), user: dict = Depends(current_user)):
    full = await db.users.find_one({"id": user["id"]}, NO_ID)
    if not verify_password(current, full["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(new), "must_change_password": False}})
    await audit(None, "change_password", "users", user["id"], actor=user)
    return {"ok": True}


@router.get("/org")
async def get_org(ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    return clean(await db.organisations.find_one({"id": ctx.org_id}, NO_ID))


@router.patch("/org")
async def update_org(payload: dict = Body(...), ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    if isinstance(payload.get("settings"), dict) and "custom_roles" in payload["settings"] and not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    before = await db.organisations.find_one({"id": ctx.org_id}, NO_ID)
    upd = {}
    if "name" in payload:
        upd["name"] = str(payload["name"])[:200]
    if isinstance(payload.get("branding"), dict):
        upd["branding"] = {k: str(v)[:500] for k, v in payload["branding"].items() if k in ("logo_url", "tagline", "address", "phone", "email", "primary_color")}
    if isinstance(payload.get("settings"), dict):
        s = {**(before.get("settings") or {}), **payload["settings"]}
        from app.core.money import D
        for k in ("tax", "contingency"):
            if s.get(k, {}).get("rate") not in (None, ""):
                D(s[k]["rate"])
        s["export_formats"] = [f for f in s.get("export_formats", []) if f in ("pdf", "xlsx", "csv")]
        upd["settings"] = s
    await db.organisations.update_one({"id": ctx.org_id}, {"$set": {**upd, "updated_at": now()}})
    after = await db.organisations.find_one({"id": ctx.org_id}, NO_ID)
    await audit(ctx, "update", "organisation", ctx.org_id, before, after)
    return clean(after)


@router.get("/org/roles")
async def roles(ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    org = await db.organisations.find_one({"id": ctx.org_id}, {"settings": 1, "_id": 0}) if ctx.org_id else {}
    custom = custom_role_caps((org or {}).get("settings") or {})
    merged = {k: {"label": v["label"], "capabilities": sorted(v["caps"])} for k, v in ROLES.items()}
    for key, caps in custom.items():
        merged[key] = {"label": key.replace("_", " ").title(), "capabilities": sorted(caps)}
    return [{"key": k, "label": v["label"], "capabilities": v["capabilities"]} for k, v in merged.items()]


@router.get("/org/users")
async def list_users(ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    mems = await db.memberships.find(tenant(ctx), NO_ID).to_list(1000)
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": [m["user_id"] for m in mems]}}, {"_id": 0, "password_hash": 0}).to_list(1000)}
    out = []
    for m in mems:
        caps = m.get("capabilities") or list(ROLES.get(m.get("role"), {}).get("caps", set()))
        out.append({**users.get(m["user_id"], {}), "membership_id": m["id"], "role": m["role"], "membership_active": m["active"], "capabilities": [str(cap) for cap in dict.fromkeys(caps) if str(cap).strip()]})
    return out


class NewUser(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    role: str
    password: str = Field(min_length=10, max_length=200)
    capabilities: list[str] | None = None


@router.post("/org/users")
async def create_user(body: NewUser, ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    org = await db.organisations.find_one({"id": ctx.org_id}, {"settings": 1, "_id": 0}) if ctx.org_id else {}
    custom = custom_role_caps((org or {}).get("settings") or {})
    allowed_roles = set(ROLES) | set(custom)
    if body.role not in allowed_roles:
        raise HTTPException(400, "Unknown role")
    email = body.email.lower()
    user = await db.users.find_one({"email": email}, NO_ID)
    if not user:
        user = {"id": new_id(), "email": email, "name": body.name, "password_hash": hash_password(body.password), "active": True,
                "is_super_admin": False, "must_change_password": True, "created_at": now()}
        await db.users.insert_one(dict(user))
    if await db.memberships.find_one(tenant(ctx, user_id=user["id"])):
        raise HTTPException(409, "User is already a member of this organisation")
    capabilities = list(dict.fromkeys((body.capabilities or []) if body.capabilities else list(ROLES[body.role]["caps"])))
    await db.memberships.insert_one({"id": new_id(), "organisation_id": ctx.org_id, "user_id": user["id"], "role": body.role,
                                    "capabilities": capabilities, "active": True, "created_at": now()})
    await audit(ctx, "add_member", "users", user["id"], meta={"email": email, "role": body.role, "capabilities": capabilities})
    return {"id": user["id"], "email": email, "role": body.role, "capabilities": capabilities}


@router.patch("/org/users/{user_id}")
async def update_member(user_id: str, payload: dict = Body(...), ctx: Ctx = Depends(get_ctx)):
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    m = await db.memberships.find_one(tenant(ctx, user_id=user_id), NO_ID)
    if not m:
        raise HTTPException(404, "Member not found")
    upd = {}
    org = await db.organisations.find_one({"id": ctx.org_id}, {"settings": 1, "_id": 0}) if ctx.org_id else {}
    custom = custom_role_caps((org or {}).get("settings") or {})
    allowed_roles = set(ROLES) | set(custom)
    if payload.get("role") in allowed_roles:
        upd["role"] = payload["role"]
    if "capabilities" in payload:
        upd["capabilities"] = [str(cap) for cap in dict.fromkeys(payload["capabilities"] or []) if str(cap).strip()]
    if "active" in payload:
        upd["active"] = bool(payload["active"])
    if user_id == ctx.user["id"] and (upd.get("role", "org_admin") != "org_admin" or upd.get("active") is False):
        raise HTTPException(409, "You cannot demote or disable yourself")
    if "role" in upd and "capabilities" not in upd:
        upd["capabilities"] = list(ROLES.get(upd["role"], {}).get("caps", set()))
    await db.memberships.update_one({"id": m["id"]}, {"$set": upd})
    await audit(ctx, "update_member", "users", user_id, {k: m.get(k) for k in upd}, upd)
    return {"ok": True}


@router.get("/overview")
async def overview(ctx: Ctx = Depends(need("catalogue.view"))):
    t = tenant(ctx)
    active = {**t, "status": "active"}
    counts = {k: await db[c].count_documents(active) for k, c in [("templates", "estimate_templates"), ("sections", "sections"),
                                                                  ("line_items", "line_items"), ("packages", "packages"), ("rules", "calculation_rules")]}
    counts["estimates_in_review"] = await db.estimate_instances.count_documents({**t, "status": "IN_REVIEW"})
    counts["estimates_draft"] = await db.estimate_instances.count_documents({**t, "status": "DRAFT"})
    counts["open_errors"] = await db.error_logs.count_documents({"organisation_id": ctx.org_id, "resolved": False})
    templates = await db.estimate_templates.find(active, NO_ID).to_list(50)
    recent = await db.estimate_instances.find({**t, "status": "ISSUED"}, NO_ID).sort("updated_at", -1).to_list(5)
    imports = await db.import_logs.find(t, NO_ID).sort("created_at", -1).to_list(5)
    return {"counts": counts, "templates": [clean(x) for x in templates], "recent_issued": [clean(x) for x in recent],
            "imports": [clean(x) for x in imports]}


@router.get("/audit")
async def audit_list(request: Request, ctx: Ctx = Depends(need("audit.view"))):
    q = tenant(ctx)
    for k in ("entity_type", "entity_id", "action"):
        if request.query_params.get(k):
            q[k] = request.query_params[k]
    rows = await db.audit_events.find(q, NO_ID).sort("created_at", -1).to_list(int(request.query_params.get("limit", 300)))
    return [clean(r) for r in rows]


@router.get("/error-logs")
async def error_logs(resolved: bool | None = None, ctx: Ctx = Depends(need("audit.view"))):
    q = {"organisation_id": {"$in": [ctx.org_id, None]}}
    if resolved is not None:
        q["resolved"] = resolved
    rows = await db.error_logs.find(q, NO_ID).sort("created_at", -1).to_list(300)
    return [clean(r) for r in rows]


@router.post("/error-logs/{log_id}/resolve")
async def resolve_error(log_id: str, ctx: Ctx = Depends(need("audit.view"))):
    await db.error_logs.update_one({"id": log_id, "organisation_id": {"$in": [ctx.org_id, None]}},
                                   {"$set": {"resolved": True, "resolved_by": ctx.user["email"], "resolved_at": now()}})
    return {"ok": True}


@router.post("/error-logs/client")
async def client_error(request: Request, payload: dict = Body(...)):
    limit("client-error", request, 30, 60)
    await record_error("frontend", str(payload.get("message", ""))[:1000], request, 0, str(payload.get("stack", ""))[:4000],
                       extra={"url": str(payload.get("url", ""))[:300], "org_id": payload.get("org_id")}, org_id=payload.get("org_id"))
    return {"ok": True}


@router.post("/platform/organisations")
async def provision_org(payload: dict = Body(...), ctx: Ctx = Depends(get_ctx)):
    """Super-admin provision hook (platform UI intentionally deferred — see DECISIONS.md D-014)."""
    if not ctx.is_super:
        raise HTTPException(403, "Platform super admin only")
    from app.migrations.seed import create_org
    org = await create_org(payload["name"], payload["admin_email"].lower(), payload["admin_password"], payload.get("admin_name") or "Admin")
    await audit(ctx, "provision_org", "organisation", org["id"], org_id=org["id"])
    return org
