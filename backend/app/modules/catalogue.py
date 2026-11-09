"""Generic, tenant-scoped CRUD for every catalogue resource (one code path = one security model)."""
import re

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import ValidationError

from app.core.audit import audit
from app.core.db import NO_ID, clean, db, new_id, now
from app.core.deps import Ctx, need, tenant
from app.modules.schemas import RESOURCES

router = APIRouter(prefix="/api/r", tags=["catalogue"])
PARENT_FILTERS = ["template_id", "section_id", "subsection_id", "package_id", "line_item_id", "rate_card_id"]
HIDE_INTERNAL = {"internal_cost"}


def _res(name):
    if name not in RESOURCES:
        raise HTTPException(404, "Unknown resource")
    return RESOURCES[name]


def _shape(doc, ctx: Ctx):
    if not ctx.can("rates.view_internal"):
        for k in HIDE_INTERNAL:
            doc.pop(k, None)
    return doc


async def _check_refs(ctx, coll, model, data, existing=None):
    _, _, scope, _, refs, uniques = model
    merged = {**(existing or {}), **data}
    if scope == "template" and data.get("template_id"):
        if not await db.estimate_templates.find_one(tenant(ctx, id=data["template_id"])):
            raise HTTPException(400, "Template not found in your organisation")
    for field, rcoll in refs.items():
        if data.get(field):
            if not await db[rcoll].find_one(tenant(ctx, id=data[field])):
                raise HTTPException(400, f"Referenced {field} does not exist in your organisation")
    for u in uniques:
        if data.get(u):
            q = tenant(ctx, **{u: data[u]}, status={"$ne": "archived"})
            if scope == "template":
                q["template_id"] = merged.get("template_id")
            if existing:
                q["id"] = {"$ne": existing["id"]}
            if await db[coll].find_one(q):
                raise HTTPException(409, f"{u} '{data[u]}' already exists")
    if coll == "package_options" and not existing:
        if await db.package_options.find_one(tenant(ctx, package_id=merged["package_id"], line_item_id=merged["line_item_id"], status={"$ne": "archived"})):
            raise HTTPException(409, "This package already has an option for this line item")
    if coll == "line_items" and merged.get("subsection_id"):
        sub = await db.subsections.find_one(tenant(ctx, id=merged["subsection_id"]))
        if sub and sub["section_id"] != merged.get("section_id"):
            raise HTTPException(400, "Subsection belongs to a different section")
    if coll == "packages" and existing and data.get("inherits_from") == existing["id"]:
        raise HTTPException(400, "A package cannot inherit from itself")
    if coll == "calculation_rules" and data.get("expression") is not None:
        from app.engine import dsl
        errs = dsl.validate(data["expression"], set(), set())
        hard = [e for e in errs if not e.startswith("Unknown")]
        if hard:
            raise HTTPException(400, "Invalid formula: " + "; ".join(hard))


def _parse(model_cls, payload):
    try:
        return model_cls(**payload).model_dump(exclude_unset=True)
    except ValidationError as e:
        raise HTTPException(422, "; ".join(f"{'.'.join(map(str, x['loc']))}: {x['msg']}" for x in e.errors()))


@router.get("/{name}")
async def list_items(name: str, request: Request, ctx: Ctx = Depends(need("catalogue.view")),
                     q: str | None = None, status: str | None = Query(None), limit: int = Query(500, le=2000)):
    coll, *_ = _res(name)
    filt = tenant(ctx)
    for f in PARENT_FILTERS:
        if request.query_params.get(f):
            filt[f] = request.query_params[f]
    filt["status"] = status if status else {"$ne": "archived"}
    if status == "all":
        filt.pop("status")
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        filt["$or"] = [{"name": rx}, {"code": rx}, {"label": rx}, {"description": rx}, {"key": rx}]
    rows = await db[coll].find(filt, NO_ID).sort([("sort_order", 1), ("created_at", 1)]).to_list(limit)
    return [_shape(r, ctx) for r in rows]


@router.get("/{name}/{item_id}")
async def get_item(name: str, item_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    coll, *_ = _res(name)
    doc = await db[coll].find_one(tenant(ctx, id=item_id), NO_ID)
    if not doc:
        raise HTTPException(404, "Not found")
    return _shape(doc, ctx)


@router.post("/{name}")
async def create_item(name: str, payload: dict = Body(...), ctx: Ctx = Depends(need("catalogue.manage"))):
    spec = _res(name)
    coll, model, scope, required = spec[0], spec[1], spec[2], spec[3]
    data = _parse(model, payload)
    missing = [f for f in required if data.get(f) in (None, "", [])]
    if missing:
        raise HTTPException(422, f"Required: {', '.join(missing)}")
    await _check_refs(ctx, coll, spec, data)
    if "bands" in data:
        for b in data["bands"]:
            b["id"] = b.get("id") or new_id()
    if data.get("sort_order") is None:
        last = await db[coll].find_one(tenant(ctx, **({"template_id": data["template_id"]} if scope == "template" else {})),
                                       sort=[("sort_order", -1)])
        data["sort_order"] = ((last or {}).get("sort_order") or 0) + 10
    doc = {"id": new_id(), "organisation_id": ctx.org_id, "status": "active", **{k: v for k, v in data.items() if k != "status"},
           "created_at": now(), "updated_at": now(), "created_by": ctx.user["id"], "updated_by": ctx.user["id"]}
    if data.get("status"):
        doc["status"] = data["status"]
    await db[coll].insert_one(doc)
    doc.pop("_id", None)
    await audit(ctx, "create", name, doc["id"], None, doc)
    return _shape(doc, ctx)


@router.patch("/{name}/{item_id}")
async def update_item(name: str, item_id: str, payload: dict = Body(...), ctx: Ctx = Depends(need("catalogue.manage"))):
    spec = _res(name)
    coll, model = spec[0], spec[1]
    existing = await db[coll].find_one(tenant(ctx, id=item_id), NO_ID)
    if not existing:
        raise HTTPException(404, "Not found")
    data = _parse(model, payload)
    data.pop("template_id", None)
    await _check_refs(ctx, coll, spec, data, existing)
    if "bands" in data:
        for b in data["bands"]:
            b["id"] = b.get("id") or new_id()
    data.update(updated_at=now(), updated_by=ctx.user["id"])
    await db[coll].update_one(tenant(ctx, id=item_id), {"$set": data})
    after = await db[coll].find_one(tenant(ctx, id=item_id), NO_ID)
    await audit(ctx, "update", name, item_id, existing, after)
    return _shape(after, ctx)


async def _set_status(name, item_id, ctx, status):
    coll, *_ = _res(name)
    existing = await db[coll].find_one(tenant(ctx, id=item_id), NO_ID)
    if not existing:
        raise HTTPException(404, "Not found")
    await db[coll].update_one(tenant(ctx, id=item_id), {"$set": {"status": status, "updated_at": now(), "updated_by": ctx.user["id"]}})
    await audit(ctx, "archive" if status == "archived" else "restore", name, item_id, {"status": existing.get("status")}, {"status": status})
    return {"ok": True, "status": status}


@router.post("/{name}/{item_id}/archive")
async def archive_item(name: str, item_id: str, ctx: Ctx = Depends(need("catalogue.manage"))):
    return await _set_status(name, item_id, ctx, "archived")


@router.post("/{name}/{item_id}/restore")
async def restore_item(name: str, item_id: str, ctx: Ctx = Depends(need("catalogue.manage"))):
    return await _set_status(name, item_id, ctx, "active")


@router.post("/{name}/{item_id}/duplicate")
async def duplicate_item(name: str, item_id: str, ctx: Ctx = Depends(need("catalogue.manage"))):
    coll, model, *_ = _res(name)
    src = await db[coll].find_one(tenant(ctx, id=item_id), NO_ID)
    if not src:
        raise HTTPException(404, "Not found")
    copy = {**src, "id": new_id(), "created_at": now(), "updated_at": now(), "created_by": ctx.user["id"],
            "updated_by": ctx.user["id"], "status": "active", "sort_order": (src.get("sort_order") or 0) + 1}
    for k in ("code", "key"):
        if src.get(k):
            n = 2
            while await db[coll].find_one(tenant(ctx, template_id=src.get("template_id"), **{k: f"{src[k]}-{n}"})):
                n += 1
            copy[k] = f"{src[k]}-{n}" if k == "code" else f"{src[k]}_{n}"
    if src.get("name"):
        copy["name"] = f"{src['name']} (copy)"
    await db[coll].insert_one(copy)
    copy.pop("_id", None)
    if coll in ("line_items", "packages"):
        fk = "line_item_id" if coll == "line_items" else "package_id"
        async for o in db.package_options.find(tenant(ctx, **{fk: item_id}, status={"$ne": "archived"}), NO_ID):
            await db.package_options.insert_one({**o, "id": new_id(), fk: copy["id"], "created_at": now(), "updated_at": now()})
    await audit(ctx, "duplicate", name, copy["id"], None, copy, meta={"source_id": item_id})
    return _shape(copy, ctx)


@router.post("/{name}/reorder")
async def reorder(name: str, ids: list[str] = Body(..., embed=True), ctx: Ctx = Depends(need("catalogue.manage"))):
    coll, *_ = _res(name)
    for i, iid in enumerate(ids):
        await db[coll].update_one(tenant(ctx, id=iid), {"$set": {"sort_order": (i + 1) * 10, "updated_at": now()}})
    await audit(ctx, "reorder", name, None, meta={"ids": ids})
    return {"ok": True}


@router.get("/{name}/{item_id}/history")
async def history(name: str, item_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    events = await db.audit_events.find(tenant(ctx, entity_id=item_id), NO_ID).sort("created_at", -1).to_list(200)
    return [clean(e) for e in events]
