from dataclasses import dataclass, field

import jwt
from fastapi import Depends, HTTPException, Request

from app.core.db import NO_ID, db
from app.core.permissions import ROLES
from app.core.security import decode_token


@dataclass
class Ctx:
    user: dict
    org_id: str | None
    role: str | None
    caps: set = field(default_factory=set)
    is_super: bool = False

    def can(self, cap: str) -> bool:
        return cap in self.caps


async def current_user(request: Request) -> dict:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        raise HTTPException(401, "Not signed in")
    try:
        payload = decode_token(auth[7:])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired. Please sign in again.")
    user = await db.users.find_one({"id": payload["sub"], "active": True}, {**NO_ID, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Account not found or disabled")
    return user


async def get_ctx(request: Request, user: dict = Depends(current_user)) -> Ctx:
    wanted = request.headers.get("x-org-id")
    q = {"user_id": user["id"], "active": True}
    if wanted:
        q["organisation_id"] = wanted
    m = await db.memberships.find_one(q, NO_ID, sort=[("created_at", 1)])
    if not m:
        if wanted:
            raise HTTPException(403, "You are not a member of this organisation")
        return Ctx(user=user, org_id=None, role=None, is_super=user.get("is_super_admin", False))
    request.state.org_id = m["organisation_id"]
    role = m["role"]
    caps = set(ROLES.get(role, {}).get("caps", set()))
    if isinstance(m.get("capabilities"), list) and m["capabilities"]:
        caps = {str(cap) for cap in m["capabilities"] if cap}
    elif role not in ROLES:
        org = await db.organisations.find_one({"id": m["organisation_id"]}, {"settings": 1, "_id": 0})
        custom_roles = ((org or {}).get("settings") or {}).get("custom_roles") or []
        for custom in custom_roles:
            if str(custom.get("key") or custom.get("name") or "") == role:
                caps = {str(cap) for cap in custom.get("capabilities", []) if cap}
                break
    return Ctx(user=user, org_id=m["organisation_id"], role=role, caps=caps,
               is_super=user.get("is_super_admin", False))


def need(cap: str):
    async def dep(ctx: Ctx = Depends(get_ctx)) -> Ctx:
        if ctx.is_super:
            return ctx
        if not ctx.org_id or not ctx.can(cap):
            raise HTTPException(403, "You do not have permission for this action")
        return ctx
    return dep


def tenant(ctx: Ctx, **extra) -> dict:
    """Every tenant-owned query MUST be built through this helper."""
    if not ctx.org_id:
        raise HTTPException(403, "No organisation context")
    return {"organisation_id": ctx.org_id, **extra}
