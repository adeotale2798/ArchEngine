"""Estimate instances, immutable revisions, lifecycle, share links, client portal and exports."""
import hashlib
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import Response

from app.core.audit import audit
from app.core.db import NO_ID, clean, db, new_id, now
from app.core.deps import Ctx, current_user, need, tenant
from app.core.ratelimit import limit
from app.core.security import new_share_token, sha256
from app.engine.calculator import calculate, client_view
from app.exports.render import RENDERERS
from app.modules.templates import latest_version

router = APIRouter(prefix="/api", tags=["estimates"])
_snap_cache: dict = {}


async def version_snapshot(org_id, version_id) -> dict:
    if version_id not in _snap_cache:  # published versions are immutable, so caching is safe
        v = await db.template_versions.find_one({"organisation_id": org_id, "id": version_id}, NO_ID)
        if not v:
            raise HTTPException(404, "Template version not found")
        _snap_cache[version_id] = json.loads(v["snapshot_json"])
    return _snap_cache[version_id]


async def _next_number(org_id):
    year = datetime.now(timezone.utc).year
    c = await db.counters.find_one_and_update({"organisation_id": org_id, "key": f"estimate-{year}"}, {"$inc": {"n": 1}},
                                              upsert=True, return_document=True)
    return f"EST-{year}-{c['n']:04d}"


async def _get_est(ctx, est_id):
    e = await db.estimate_instances.find_one(tenant(ctx, id=est_id), NO_ID)
    if not e:
        raise HTTPException(404, "Estimate not found")
    return clean(e)


async def _current_rev(e):
    return await db.estimate_revisions.find_one({"organisation_id": e["organisation_id"], "id": e["current_revision_id"]}, NO_ID)


async def _recalc(e, rev):
    snap = await version_snapshot(e["organisation_id"], rev["template_version_id"])
    res = calculate(snap, e.get("inputs") or {}, e.get("package_id"), e.get("overrides") or {}, e.get("manual_quantities") or {})
    await db.estimate_revisions.update_one({"id": rev["id"], "status": "DRAFT"}, {"$set": {
        "input_snapshot": e.get("inputs") or {}, "package_id": e.get("package_id"), "overrides": e.get("overrides") or {},
        "manual_quantities": e.get("manual_quantities") or {}, "result": res, "engine_version": res["engine_version"], "updated_at": now()}})
    return res


@router.get("/estimates")
async def list_estimates(ctx: Ctx = Depends(need("estimate.view"))):
    rows = await db.estimate_instances.find(tenant(ctx), NO_ID).sort("created_at", -1).to_list(500)
    for r in rows:
        rev = await db.estimate_revisions.find_one({"id": r["current_revision_id"]}, {"_id": 0, "result.totals": 1, "result.critical_count": 1, "status": 1})
        r["grand_total"] = ((rev or {}).get("result") or {}).get("totals", {}).get("grand_total")
        r["critical_count"] = ((rev or {}).get("result") or {}).get("critical_count")
    return [clean(r) for r in rows]


@router.post("/estimates")
async def create_estimate(payload: dict = Body(...), ctx: Ctx = Depends(need("estimate.create"))):
    tid = payload.get("template_id")
    tpl = await db.estimate_templates.find_one(tenant(ctx, id=tid), NO_ID)
    if not tpl:
        raise HTTPException(404, "Template not found")
    ver = await latest_version(ctx.org_id, tid)
    if not ver:
        raise HTTPException(409, "Publish the template before creating client estimates")
    snap = await version_snapshot(ctx.org_id, ver["id"])
    org = await db.organisations.find_one({"id": ctx.org_id}, NO_ID)
    pkg = payload.get("package_id") or next((p["id"] for p in snap["packages"] if p.get("is_recommended")), None) or \
        (snap["packages"][0]["id"] if snap["packages"] else None)
    inputs = {i["key"]: i.get("default_value") for i in snap["inputs"]} | (payload.get("inputs") or {})
    package_ids = {p["id"] for p in snap["packages"]}
    line_by_id = {line["id"]: line for line in snap["line_items"]}
    overrides = {}
    for line_id, raw_override in (payload.get("overrides") or {}).items():
        line = line_by_id.get(line_id)
        if not line or not isinstance(raw_override, dict):
            continue
        clean_override = {}
        option_package_id = raw_override.get("option_package_id")
        if option_package_id in package_ids and line.get("client_can_change_option"):
            clean_override["option_package_id"] = option_package_id
        if "selected" in raw_override:
            clean_override["selected"] = bool(raw_override["selected"])
        if raw_override.get("quantity") not in (None, "") and line.get("client_can_change_quantity") and line.get("quantity_mode") == "CLIENT_MANUAL":
            clean_override["quantity"] = str(raw_override["quantity"])
        if clean_override:
            overrides[line_id] = clean_override
    eid, rid = new_id(), new_id()
    e = {"id": eid, "organisation_id": ctx.org_id, "number": await _next_number(ctx.org_id),
         "title": payload.get("title") or tpl["name"], "template_id": tid, "client_name": payload.get("client_name") or "",
         "client_email": (payload.get("client_email") or "").lower(), "project_name": payload.get("project_name") or "",
         "client_user_ids": [], "inputs": inputs, "package_id": pkg, "overrides": overrides, "manual_quantities": {},
         "status": "DRAFT", "current_revision_id": rid, "revision_number": 1,
         "validity_days": int((org.get("settings") or {}).get("estimate_validity_days") or 30),
         "created_by": ctx.user["id"], "created_at": now(), "updated_at": now()}
    rev = {"id": rid, "organisation_id": ctx.org_id, "estimate_id": eid, "revision_number": 1, "status": "DRAFT",
           "template_version_id": ver["id"], "template_version": ver["version"], "created_at": now(), "created_by": ctx.user["id"]}
    await db.estimate_instances.insert_one(dict(e))
    await db.estimate_revisions.insert_one(dict(rev))
    await _recalc(e, rev)
    await audit(ctx, "create", "estimates", eid, None, {"number": e["number"], "template_version": ver["version"]})
    return clean(e)


@router.get("/estimates/{est_id}")
async def get_estimate(est_id: str, ctx: Ctx = Depends(need("estimate.view"))):
    e = await _get_est(ctx, est_id)
    revs = await db.estimate_revisions.find(tenant(ctx, estimate_id=est_id), {**NO_ID, "result": 0}).sort("revision_number", -1).to_list(100)
    cur = await _current_rev(e)
    snap = await version_snapshot(ctx.org_id, cur["template_version_id"])
    if not ctx.can("rates.view_internal"):
        for l in cur["result"]["lines"]:
            l.pop("internal_cost", None)
    approvals = await db.estimate_approvals.find(tenant(ctx, estimate_id=est_id), NO_ID).sort("created_at", -1).to_list(100)
    clients = await db.users.find({"id": {"$in": e.get("client_user_ids") or []}}, {"_id": 0, "id": 1, "email": 1, "name": 1}).to_list(50)
    return {"estimate": e, "revision": clean(cur), "revisions": [clean(r) for r in revs], "approvals": [clean(a) for a in approvals],
            "clients": clients, "packages": [_pkg_public(p) for p in snap["packages"]], "input_defs": snap["inputs"],
            "options_by_line": _options_by_line(snap)}


def _pkg_public(p):
    return {k: p.get(k) for k in ("id", "code", "name", "description", "image_url", "is_recommended")}


def _options_by_line(snap, allowed_package_ids=None):
    names = {p["id"]: p["name"] for p in snap["packages"]}
    out = {}
    for o in snap["package_options"]:
        if o["package_id"] in names and (allowed_package_ids is None or o["package_id"] in allowed_package_ids):
            out.setdefault(o["line_item_id"], []).append({"package_id": o["package_id"], "package_name": names[o["package_id"]],
                                                          "label": o.get("specification_label") or "", "details": o.get("specification_details") or ""})
    return out


@router.put("/estimates/{est_id}/config")
async def update_config(est_id: str, payload: dict = Body(...), ctx: Ctx = Depends(need("estimate.create"))):
    e = await _get_est(ctx, est_id)
    rev = await _current_rev(e)
    if rev["status"] != "DRAFT":
        raise HTTPException(409, f"Revision {rev['revision_number']} is {rev['status']}. Create a new revision to make changes.")
    upd = {k: payload[k] for k in ("inputs", "package_id", "overrides", "manual_quantities", "title", "client_name",
                                   "client_email", "project_name", "validity_days") if k in payload}
    before = {k: e.get(k) for k in upd}
    e.update(upd, updated_at=now())
    await db.estimate_instances.update_one(tenant(ctx, id=est_id), {"$set": {**upd, "updated_at": now()}})
    res = await _recalc(e, rev)
    await audit(ctx, "configure", "estimates", est_id, before, upd)
    return {"result": res}


TRANSITIONS = {"submit": ({"DRAFT"}, "IN_REVIEW", "estimate.create"), "return": ({"IN_REVIEW", "APPROVED"}, "DRAFT", "estimate.approve"),
               "approve": ({"IN_REVIEW"}, "APPROVED", "estimate.approve"), "issue": ({"APPROVED", "DRAFT", "IN_REVIEW"}, "ISSUED", "estimate.issue")}


@router.post("/estimates/{est_id}/transition")
async def transition(est_id: str, action: str = Body(..., embed=True), comment: str = Body("", embed=True),
                     rebase: bool = Body(False, embed=True), ctx: Ctx = Depends(need("estimate.view"))):
    e = await _get_est(ctx, est_id)
    rev = await _current_rev(e)
    org = await db.organisations.find_one({"id": ctx.org_id}, NO_ID)
    if action == "revise":
        if not ctx.can("estimate.create"):
            raise HTTPException(403, "Not allowed")
        if rev["status"] not in ("ISSUED", "APPROVED", "IN_REVIEW"):
            raise HTTPException(409, "Only a submitted, approved or issued revision can be revised")
        ver_id, ver_no = rev["template_version_id"], rev["template_version"]
        if rebase:
            lv = await latest_version(ctx.org_id, e["template_id"])
            ver_id, ver_no = lv["id"], lv["version"]
        if rev["status"] != "ISSUED":
            await db.estimate_revisions.update_one({"id": rev["id"]}, {"$set": {"status": "WITHDRAWN"}})
        nr = {"id": new_id(), "organisation_id": ctx.org_id, "estimate_id": est_id, "revision_number": e["revision_number"] + 1,
              "status": "DRAFT", "template_version_id": ver_id, "template_version": ver_no, "created_at": now(), "created_by": ctx.user["id"]}
        await db.estimate_revisions.insert_one(dict(nr))
        await db.estimate_instances.update_one({"id": est_id}, {"$set": {"current_revision_id": nr["id"], "revision_number": nr["revision_number"], "status": "DRAFT"}})
        e.update(current_revision_id=nr["id"])
        await _recalc(e, nr)
        await audit(ctx, "revise", "estimates", est_id, meta={"revision": nr["revision_number"], "template_version": ver_no, "rebase": rebase})
        return {"status": "DRAFT", "revision_number": nr["revision_number"]}
    if action not in TRANSITIONS:
        raise HTTPException(400, "Unknown action")
    allowed, target, cap = TRANSITIONS[action]
    if not ctx.can(cap):
        raise HTTPException(403, "You do not have permission for this action")
    if rev["status"] not in allowed:
        raise HTTPException(409, f"Cannot {action} a revision that is {rev['status']}")
    if action == "issue" and (org.get("settings") or {}).get("require_approval_before_issue") and rev["status"] != "APPROVED":
        raise HTTPException(409, "Organisation policy requires approval before issue")
    if action in ("approve", "issue") and rev["result"]["critical_count"]:
        raise HTTPException(409, f"Resolve {rev['result']['critical_count']} critical calculation issue(s) before you {action}")
    upd = {"status": target}
    if target == "ISSUED":
        issued = datetime.now(timezone.utc)
        upd.update(issued_at=issued.isoformat(), issued_by=ctx.user["id"], issued_by_email=ctx.user["email"],
                   valid_until=(issued + timedelta(days=e.get("validity_days") or 30)).strftime("%d %b %Y"),
                   content_hash=hashlib.sha256(json.dumps(rev["result"], sort_keys=True).encode()).hexdigest())
        await db.estimate_revisions.update_many({"estimate_id": est_id, "status": "ISSUED"}, {"$set": {"status": "SUPERSEDED"}})
    await db.estimate_revisions.update_one({"id": rev["id"]}, {"$set": upd})
    await db.estimate_instances.update_one({"id": est_id}, {"$set": {"status": target, "updated_at": now()}})
    await db.estimate_approvals.insert_one({"id": new_id(), "organisation_id": ctx.org_id, "estimate_id": est_id, "revision_id": rev["id"],
                                            "action": action, "comment": comment, "actor_id": ctx.user["id"], "actor_email": ctx.user["email"], "created_at": now()})
    await audit(ctx, action, "estimates", est_id, {"status": rev["status"]}, {"status": target}, meta={"revision": rev["revision_number"], "comment": comment})
    return {"status": target}


@router.post("/estimates/{est_id}/clients")
async def assign_client(est_id: str, email: str = Body(..., embed=True), ctx: Ctx = Depends(need("estimate.create"))):
    await _get_est(ctx, est_id)
    u = await db.users.find_one({"email": email.lower().strip()}, NO_ID)
    if not u or not await db.memberships.find_one(tenant(ctx, user_id=u["id"], role="client", active=True)):
        raise HTTPException(404, "No client account with that email in your organisation. Create it under Users first.")
    await db.estimate_instances.update_one(tenant(ctx, id=est_id), {"$addToSet": {"client_user_ids": u["id"]}})
    await audit(ctx, "grant_client_access", "estimates", est_id, meta={"client": u["email"]})
    return {"ok": True}


@router.delete("/estimates/{est_id}/clients/{user_id}")
async def revoke_client(est_id: str, user_id: str, ctx: Ctx = Depends(need("estimate.create"))):
    await db.estimate_instances.update_one(tenant(ctx, id=est_id), {"$pull": {"client_user_ids": user_id}})
    await audit(ctx, "revoke_client_access", "estimates", est_id, meta={"user_id": user_id})
    return {"ok": True}


@router.get("/estimates/{est_id}/share-links")
async def list_links(est_id: str, ctx: Ctx = Depends(need("estimate.view"))):
    rows = await db.estimate_share_links.find(tenant(ctx, estimate_id=est_id), {**NO_ID, "token_hash": 0}).sort("created_at", -1).to_list(100)
    return [clean(r) for r in rows]


@router.post("/estimates/{est_id}/share-links")
async def create_link(est_id: str, payload: dict = Body({}), ctx: Ctx = Depends(need("estimate.create"))):
    estimate = await _get_est(ctx, est_id)
    revision = await _current_rev(estimate)
    snapshot = await version_snapshot(ctx.org_id, revision["template_version_id"])
    available_package_ids = [package["id"] for package in snapshot["packages"]]
    requested_package_ids = payload.get("allowed_package_ids", available_package_ids)
    if not isinstance(requested_package_ids, list):
        raise HTTPException(400, "allowed_package_ids must be a list")
    allowed_package_ids = [package_id for package_id in available_package_ids if package_id in requested_package_ids]
    if not allowed_package_ids:
        raise HTTPException(400, "Select at least one package for this client link")
    days = max(1, min(int(payload.get("expires_in_days") or 14), 90))
    token = new_share_token()
    link = {"id": new_id(), "organisation_id": ctx.org_id, "estimate_id": est_id, "token_hash": sha256(token), "token_prefix": token[:6],
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=days)).isoformat(), "revoked": False,
            "can_configure": bool(payload.get("can_configure", False)), "can_download": bool(payload.get("can_download", True)),
            "allowed_package_ids": allowed_package_ids,
            "use_count": 0, "created_by": ctx.user["id"], "created_at": now()}
    await db.estimate_share_links.insert_one(dict(link))
    await audit(ctx, "create_share_link", "estimates", est_id, meta={"link_id": link["id"], "expires_in_days": days})
    link.pop("token_hash")
    return {**link, "token": token}


@router.post("/estimates/{est_id}/share-links/{link_id}/revoke")
async def revoke_link(est_id: str, link_id: str, ctx: Ctx = Depends(need("estimate.create"))):
    r = await db.estimate_share_links.update_one(tenant(ctx, id=link_id, estimate_id=est_id), {"$set": {"revoked": True, "revoked_at": now()}})
    if not r.matched_count:
        raise HTTPException(404, "Link not found")
    await audit(ctx, "revoke_share_link", "estimates", est_id, meta={"link_id": link_id})
    return {"ok": True}


async def _document(e, rev, org):
    snap_doc = {"number": e["number"], "title": e["title"], "client_name": e.get("client_name"), "project_name": e.get("project_name"),
                "revision_number": rev["revision_number"], "status": rev["status"],
                "date": datetime.fromisoformat(rev.get("issued_at") or rev["created_at"]).strftime("%d %b %Y"),
                "valid_until": rev.get("valid_until"), "terms": (org.get("settings") or {}).get("terms"),
                "org": {"name": org["name"], "branding": org.get("branding") or {}}, "result": client_view(rev["result"])}
    return snap_doc


async def _export(e, rev, fmt, actor_label, channel, request, actor_id=None):
    org = await db.organisations.find_one({"id": e["organisation_id"]}, NO_ID)
    allowed = (org.get("settings") or {}).get("export_formats") or ["pdf", "xlsx", "csv"]
    if fmt not in RENDERERS or (channel != "admin" and fmt not in allowed):
        raise HTTPException(404, "This download format is not enabled")
    limit("export", request, 30, 60)
    fn, mime = RENDERERS[fmt]
    body = fn(await _document(e, rev, org))
    await db.estimate_exports.insert_one({"id": new_id(), "organisation_id": e["organisation_id"], "estimate_id": e["id"],
                                          "revision_id": rev["id"], "revision_number": rev["revision_number"], "format": fmt,
                                          "channel": channel, "actor": actor_label, "actor_id": actor_id,
                                          "sha256": hashlib.sha256(body).hexdigest(), "created_at": now()})
    await audit(None, "download", "estimates", e["id"], meta={"format": fmt, "channel": channel, "revision": rev["revision_number"], "actor": actor_label},
                org_id=e["organisation_id"], actor={"id": actor_id, "email": actor_label})
    name = f"{e['number']}-rev{rev['revision_number']}.{fmt}"
    return Response(body, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/estimates/{est_id}/exports/{fmt}")
async def admin_export(est_id: str, fmt: str, request: Request, revision_id: str | None = None, ctx: Ctx = Depends(need("estimate.download"))):
    e = await _get_est(ctx, est_id)
    rev = await db.estimate_revisions.find_one(tenant(ctx, estimate_id=est_id, id=revision_id or e["current_revision_id"]), NO_ID)
    if not rev:
        raise HTTPException(404, "Revision not found")
    return await _export(e, rev, fmt, ctx.user["email"], "admin", request, ctx.user["id"])


@router.get("/estimates/{est_id}/exports-history")
async def export_history(est_id: str, ctx: Ctx = Depends(need("estimate.view"))):
    rows = await db.estimate_exports.find(tenant(ctx, estimate_id=est_id), NO_ID).sort("created_at", -1).to_list(200)
    return [clean(r) for r in rows]


# ---------------- client portal (share link or client login) ----------------

async def _portal(kind, ref, request):
    if kind == "s":
        limit("share", request, 120, 60)
        link = await db.estimate_share_links.find_one({"token_hash": sha256(ref)}, NO_ID)
        if not link or link["revoked"] or link["expires_at"] < now():
            raise HTTPException(404, "This estimate link is invalid, expired or has been revoked")
        e = await db.estimate_instances.find_one({"id": link["estimate_id"], "organisation_id": link["organisation_id"]}, NO_ID)
        if not e:
            raise HTTPException(404, "Estimate not found")
        await db.estimate_share_links.update_one({"id": link["id"]}, {"$inc": {"use_count": 1}, "$set": {"last_used_at": now()}})
        return e, {"can_configure": link["can_configure"], "can_download": link["can_download"],
               "allowed_package_ids": link.get("allowed_package_ids")}, f"share-link:{link['token_prefix']}", None
    if kind == "e":
        user = await current_user(request)
        e = await db.estimate_instances.find_one({"id": ref, "client_user_ids": user["id"]}, NO_ID)
        if not e:
            raise HTTPException(404, "Estimate not found")
        return e, {"can_configure": True, "can_download": True}, user["email"], user["id"]
    raise HTTPException(404, "Not found")


@router.get("/client/estimates")
async def my_estimates(request: Request):
    user = await current_user(request)
    rows = await db.estimate_instances.find({"client_user_ids": user["id"]}, {"_id": 0, "id": 1, "number": 1, "title": 1, "status": 1,
                                                                            "project_name": 1, "updated_at": 1}).to_list(100)
    return [clean(r) for r in rows]


@router.get("/portal/{kind}/{ref}")
async def portal_view(kind: str, ref: str, request: Request):
    e, perms, *_ = await _portal(kind, ref, request)
    rev = await _current_rev(e)
    issued = await db.estimate_revisions.find_one({"estimate_id": e["id"], "status": "ISSUED"}, {"_id": 0, "result": 0})
    snap = await version_snapshot(e["organisation_id"], rev["template_version_id"])
    org = await db.organisations.find_one({"id": e["organisation_id"]}, NO_ID)
    editable = perms["can_configure"] and rev["status"] == "DRAFT"
    allowed_package_ids = perms.get("allowed_package_ids")
    visible_packages = [p for p in snap["packages"] if allowed_package_ids is None or p["id"] in allowed_package_ids]
    pkg_totals = {}
    if editable:
        for p in visible_packages:
            r = calculate(snap, e.get("inputs") or {}, p["id"], {})
            pkg_totals[p["id"]] = {"grand_total": r["totals"]["grand_total"], "complete": r["is_complete"]}
    st = org.get("settings") or {}
    return {"estimate": {k: e.get(k) for k in ("number", "title", "client_name", "project_name", "status", "inputs", "package_id",
                                                 "overrides", "revision_number")},
            "revision": {k: rev.get(k) for k in ("revision_number", "status", "issued_at", "valid_until", "template_version")},
            "issued_revision": issued and {k: issued.get(k) for k in ("id", "revision_number", "issued_at", "valid_until")},
            "org": {"name": org["name"], "branding": org.get("branding") or {}},
            "template": {k: snap["template"].get(k) for k in ("name", "intro_text", "hero_image_url")},
            "input_defs": [{k: i.get(k) for k in ("key", "label", "input_type", "min_value", "max_value", "help_text", "client_editable", "options")}
                           for i in snap["inputs"] if i.get("client_visible", True)],
            "packages": [_pkg_public(p) for p in visible_packages], "package_totals": pkg_totals,
            "options_by_line": _options_by_line(snap, {p["id"] for p in visible_packages}), "result": client_view(rev["result"]),
            "permissions": {**perms, "editable": editable}, "export_formats": st.get("export_formats") or ["pdf", "xlsx", "csv"]}


@router.put("/portal/{kind}/{ref}/config")
async def portal_config(kind: str, ref: str, request: Request, payload: dict = Body(...)):
    e, perms, actor, actor_id = await _portal(kind, ref, request)
    rev = await _current_rev(e)
    if not perms["can_configure"] or rev["status"] != "DRAFT":
        raise HTTPException(403, "This estimate is locked. Ask your architect for a revision.")
    snap = await version_snapshot(e["organisation_id"], rev["template_version_id"])
    editable_inputs = {i["key"] for i in snap["inputs"] if i.get("client_editable", True) and i.get("client_visible", True)}
    lines = {l["id"]: l for l in snap["line_items"]}
    allowed_package_ids = perms.get("allowed_package_ids")
    pkgs = set(allowed_package_ids) if allowed_package_ids is not None else {p["id"] for p in snap["packages"]}
    upd = {}
    if "inputs" in payload:
        upd["inputs"] = {**(e.get("inputs") or {}), **{k: v for k, v in (payload["inputs"] or {}).items() if k in editable_inputs}}
    if payload.get("package_id"):
        if payload["package_id"] not in pkgs:
            raise HTTPException(400, "Package not available")
        upd["package_id"] = payload["package_id"]
    if "overrides" in payload:
        clean_ov = {}
        for lid, ov in (payload["overrides"] or {}).items():
            line = lines.get(lid)
            if not line or not isinstance(ov, dict):
                continue
            c = {}
            if ov.get("option_package_id") in pkgs and line.get("client_can_change_option"):
                c["option_package_id"] = ov["option_package_id"]
            if "selected" in ov:
                c["selected"] = bool(ov["selected"])
            if ov.get("quantity") not in (None, "") and line.get("client_can_change_quantity") and line.get("quantity_mode") == "CLIENT_MANUAL":
                c["quantity"] = str(ov["quantity"])
            if c:
                clean_ov[lid] = c
        upd["overrides"] = clean_ov
    before = {k: e.get(k) for k in upd}
    e.update(upd)
    await db.estimate_instances.update_one({"id": e["id"]}, {"$set": {**upd, "updated_at": now()}})
    res = await _recalc(e, rev)
    await audit(None, "client_configure", "estimates", e["id"], before, upd, org_id=e["organisation_id"], actor={"id": actor_id, "email": actor})
    return {"result": client_view(res)}


@router.get("/portal/{kind}/{ref}/exports/{fmt}")
async def portal_export(kind: str, ref: str, fmt: str, request: Request, issued: bool = False):
    e, perms, actor, actor_id = await _portal(kind, ref, request)
    if not perms["can_download"]:
        raise HTTPException(403, "Downloads are not enabled for this link")
    q = {"estimate_id": e["id"], "status": "ISSUED"} if issued else {"id": e["current_revision_id"]}
    rev = await db.estimate_revisions.find_one(q, NO_ID)
    if not rev:
        raise HTTPException(404, "No issued revision yet")
    return await _export(e, rev, fmt, actor, "client", request, actor_id)
