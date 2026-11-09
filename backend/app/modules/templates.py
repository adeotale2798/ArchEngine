"""Template lifecycle: snapshot, validate, publish immutable versions, simulator, rule tests, CSV import/export."""
import csv
import hashlib
import io
import json

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.core.audit import audit
from app.core.db import NO_ID, clean, db, new_id, now
from app.core.deps import Ctx, need, tenant
from app.engine import dsl
from app.engine.calculator import calculate
from app.engine.validation import validate_snapshot

router = APIRouter(prefix="/api/templates", tags=["templates"])
ACTIVE = {"status": "active"}
TPL_COLLS = {"sections": "sections", "subsections": "subsections", "line_items": "line_items", "packages": "packages",
             "package_options": "package_options", "inputs": "input_definitions", "rules": "calculation_rules",
             "foundation_rule_sets": "foundation_rule_sets", "slab_rules": "slab_rule_sets", "bathroom_rules": "bathroom_rule_sets"}
META = {"_id", "created_at", "updated_at", "created_by", "updated_by"}


def _strip(d):
    return {k: v for k, v in d.items() if k not in META}


async def build_snapshot(org_id: str, template_id: str) -> dict:
    tpl = await db.estimate_templates.find_one({"organisation_id": org_id, "id": template_id}, NO_ID)
    if not tpl:
        raise HTTPException(404, "Template not found")
    snap = {"template": _strip(tpl)}
    for key, coll in TPL_COLLS.items():
        rows = await db[coll].find({"organisation_id": org_id, "template_id": template_id, **ACTIVE}, NO_ID).sort("sort_order", 1).to_list(5000)
        snap[key] = [_strip(r) for r in rows]
    sub_ids, sec_ids = {s["id"] for s in snap["subsections"]}, {s["id"] for s in snap["sections"]}
    snap["subsections"] = [s for s in snap["subsections"] if s["section_id"] in sec_ids]
    snap["line_items"] = [l for l in snap["line_items"] if l["section_id"] in sec_ids and (not l.get("subsection_id") or l["subsection_id"] in sub_ids)]
    snap["units"] = [_strip(u) for u in await db.unit_definitions.find({"organisation_id": org_id}, NO_ID).to_list(1000)]
    snap["conversions"] = [_strip(c) for c in await db.unit_conversions.find({"organisation_id": org_id, **ACTIVE}, NO_ID).to_list(1000)]
    cards = {c["id"] for c in await db.rate_cards.find({"organisation_id": org_id, **ACTIVE}, NO_ID).to_list(500)}
    items = await db.rate_card_items.find({"organisation_id": org_id, **ACTIVE}, NO_ID).to_list(10000)
    snap["rate_card_items"] = [_strip(i) for i in items if i.get("rate_card_id") in cards]
    org = await db.organisations.find_one({"id": org_id}, NO_ID)
    snap["settings"] = (org or {}).get("settings") or {}
    return snap


async def latest_version(org_id, template_id):
    return await db.template_versions.find_one({"organisation_id": org_id, "template_id": template_id}, NO_ID, sort=[("version", -1)])


@router.post("/{template_id}/validate")
async def validate(template_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    return validate_snapshot(await build_snapshot(ctx.org_id, template_id))


@router.post("/{template_id}/publish")
async def publish(template_id: str, notes: str = Body("", embed=True), ctx: Ctx = Depends(need("rules.publish"))):
    snap = await build_snapshot(ctx.org_id, template_id)
    report = validate_snapshot(snap)
    if not report["can_publish"]:
        raise HTTPException(409, {"message": "Fix critical validation errors before publishing", "report": report})
    prev = await latest_version(ctx.org_id, template_id)
    body = json.dumps(snap, sort_keys=True, default=str)
    digest = hashlib.sha256(body.encode()).hexdigest()
    if prev and prev.get("hash") == digest:
        raise HTTPException(409, "Nothing changed since the last published version")
    version = (prev or {}).get("version", 0) + 1
    doc = {"id": new_id(), "organisation_id": ctx.org_id, "template_id": template_id, "version": version,
           "snapshot_json": body, "hash": digest, "notes": notes, "validation": {k: report[k] for k in ("critical_count", "warning_count")},
           "counts": {k: len(v) for k, v in snap.items() if isinstance(v, list)},
           "published_by": ctx.user["id"], "published_by_email": ctx.user["email"], "published_at": now()}
    await db.template_versions.insert_one(doc)
    await db.estimate_templates.update_one(tenant(ctx, id=template_id), {"$set": {"current_version": version, "published_at": now()}})
    await audit(ctx, "publish", "templates", template_id, meta={"version": version, "hash": digest, "notes": notes})
    return {"version": version, "id": doc["id"], "warnings": report["warning_count"]}


@router.get("/{template_id}/versions")
async def versions(template_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    rows = await db.template_versions.find(tenant(ctx, template_id=template_id), {**NO_ID, "snapshot_json": 0}).sort("version", -1).to_list(200)
    return [clean(r) for r in rows]


@router.get("/{template_id}/versions/{version_id}")
async def version_detail(template_id: str, version_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    v = await db.template_versions.find_one(tenant(ctx, template_id=template_id, id=version_id), NO_ID)
    if not v:
        raise HTTPException(404, "Version not found")
    v["snapshot"] = json.loads(v.pop("snapshot_json"))
    return clean(v)


@router.post("/{template_id}/simulate")
async def simulate(template_id: str, payload: dict = Body(...), ctx: Ctx = Depends(need("catalogue.view"))):
    """Admin preview on the live draft configuration (nothing persisted)."""
    snap = await build_snapshot(ctx.org_id, template_id)
    pkg = payload.get("package_id") or next((p["id"] for p in snap["packages"]), None)
    res = calculate(snap, payload.get("inputs") or {}, pkg, payload.get("overrides") or {}, payload.get("manual_quantities") or {})
    if payload.get("compare_inputs"):
        other = calculate(snap, payload["compare_inputs"], pkg, payload.get("overrides") or {})
        res["comparison"] = {"inputs": payload["compare_inputs"], "grand_total": other["totals"]["grand_total"],
                             "lines": {l["line_item_id"]: l["amount"] for l in other["lines"]}}
    return res


@router.post("/{template_id}/rules/test")
async def test_rule(template_id: str, payload: dict = Body(...), ctx: Ctx = Depends(need("catalogue.view"))):
    snap = await build_snapshot(ctx.org_id, template_id)
    expr = payload.get("expression") or {}
    labels = {f"input.{i['key']}": i["label"] for i in snap["inputs"]}
    labels.update({f"item.{l['code']}": l["name"] for l in snap["line_items"]})
    errors = dsl.validate(expr, {i["key"] for i in snap["inputs"]}, {l["code"] for l in snap["line_items"]})
    out = {"errors": errors, "explanation": dsl.explain(expr, labels) if not errors else "", "results": []}
    if errors:
        return out
    for case in payload.get("test_cases") or [{"inputs": {}}]:
        env = {f"input.{k}": v for k, v in (case.get("inputs") or {}).items()}
        env.update({f"item.{k}": v for k, v in (case.get("items") or {}).items()})
        try:
            val = dsl.evaluate(expr, env)
            r = {"value": str(val)}
            if case.get("expected") not in (None, ""):
                r["passed"] = str(val.normalize()) == str(__import__("decimal").Decimal(str(case["expected"])).normalize())
        except (dsl.DSLError, ValueError) as e:
            r = {"error": str(e), "passed": False}
        out["results"].append({**case, **r})
    return out


IMPORT_COLS = ["section", "subsection", "code", "name", "description", "unit", "quantity_mode", "fixed_quantity",
               "inclusion", "package_code", "specification", "rate"]


@router.get("/{template_id}/export.csv")
async def export_catalogue(template_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    snap = await build_snapshot(ctx.org_id, template_id)
    secs, subs = {s["id"]: s for s in snap["sections"]}, {s["id"]: s for s in snap["subsections"]}
    units, pkgs = {u["id"]: u["code"] for u in snap["units"]}, {p["id"]: p["code"] for p in snap["packages"]}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(IMPORT_COLS)
    for l in snap["line_items"]:
        opts = [o for o in snap["package_options"] if o["line_item_id"] == l["id"]] or [{}]
        for o in opts:
            w.writerow([secs[l["section_id"]]["name"], (subs.get(l.get("subsection_id")) or {}).get("name", ""), l["code"], l["name"],
                        l.get("description") or "", units.get(l.get("unit_id"), ""), l.get("quantity_mode") or "",
                        l.get("fixed_quantity") or "", o.get("inclusion_status") or l.get("inclusion_default") or "",
                        pkgs.get(o.get("package_id"), ""), o.get("specification_label") or "", o.get("rate") or ""])
    await audit(ctx, "export_catalogue", "templates", template_id)
    return StreamingResponse(iter(["\ufeff" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="catalogue-{template_id[:8]}.csv"'})


@router.post("/{template_id}/import")
async def import_catalogue(template_id: str, csv_text: str = Body(..., embed=True), commit: bool = Body(False, embed=True),
                           ctx: Ctx = Depends(need("catalogue.manage"))):
    """Validated import into the DRAFT working copy. Dry-run by default; matches existing rows by stable code."""
    if not await db.estimate_templates.find_one(tenant(ctx, id=template_id)):
        raise HTTPException(404, "Template not found")
    rows = list(csv.DictReader(io.StringIO(csv_text.lstrip("\ufeff"))))
    missing_cols = [c for c in ("section", "code", "name") if rows and c not in rows[0]]
    if not rows or missing_cols:
        raise HTTPException(422, f"CSV must include columns: {', '.join(IMPORT_COLS)}")
    units = {u["code"].lower(): u["id"] for u in await db.unit_definitions.find(tenant(ctx), NO_ID).to_list(1000)}
    pkgs = {p["code"]: p["id"] for p in await db.packages.find(tenant(ctx, template_id=template_id, status="active"), NO_ID).to_list(200)}
    errors, plan = [], []
    for n, r in enumerate(rows, start=2):
        if not r.get("code") or not r.get("name") or not r.get("section"):
            errors.append(f"Row {n}: section, code and name are required")
            continue
        if r.get("unit") and r["unit"].lower() not in units:
            errors.append(f"Row {n}: unknown unit '{r['unit']}' — add it under Units first")
        if r.get("package_code") and r["package_code"] not in pkgs:
            errors.append(f"Row {n}: unknown package '{r['package_code']}'")
        if r.get("rate"):
            try:
                float(r["rate"].replace(",", ""))
            except ValueError:
                errors.append(f"Row {n}: invalid rate '{r['rate']}'")
        exists = await db.line_items.find_one(tenant(ctx, template_id=template_id, code=r["code"], status="active"))
        plan.append({"row": n, "code": r["code"], "action": "update" if exists else "create", "package": r.get("package_code") or None})
    result = {"rows": len(rows), "errors": errors, "plan": plan, "committed": False}
    if not commit or errors:
        return result
    for r in rows:
        sec = await db.sections.find_one(tenant(ctx, template_id=template_id, name=r["section"], status="active"))
        if not sec:
            sec = {"id": new_id(), "organisation_id": ctx.org_id, "template_id": template_id, "name": r["section"], "status": "active",
                   "sort_order": 1000, "client_visible": True, "created_at": now(), "updated_at": now()}
            await db.sections.insert_one(dict(sec))
        sub_id = None
        if r.get("subsection"):
            sub = await db.subsections.find_one(tenant(ctx, template_id=template_id, section_id=sec["id"], name=r["subsection"], status="active"))
            if not sub:
                sub = {"id": new_id(), "organisation_id": ctx.org_id, "template_id": template_id, "section_id": sec["id"],
                       "name": r["subsection"], "status": "active", "sort_order": 1000, "created_at": now(), "updated_at": now()}
                await db.subsections.insert_one(dict(sub))
            sub_id = sub["id"]
        fields = {"section_id": sec["id"], "subsection_id": sub_id, "name": r["name"], "description": r.get("description") or "",
                  "unit_id": units.get((r.get("unit") or "").lower()), "quantity_mode": r.get("quantity_mode") or "FIXED_QUANTITY",
                  "fixed_quantity": r.get("fixed_quantity") or None, "inclusion_default": r.get("inclusion") or "INCLUDED",
                  "updated_at": now(), "source_ref": "CSV import"}
        line = await db.line_items.find_one(tenant(ctx, template_id=template_id, code=r["code"], status="active"))
        if line:
            await db.line_items.update_one({"id": line["id"]}, {"$set": fields})
            lid = line["id"]
        else:
            lid = new_id()
            await db.line_items.insert_one({"id": lid, "organisation_id": ctx.org_id, "template_id": template_id, "code": r["code"],
                                            "status": "active", "sort_order": 1000, "client_visible": True, "created_at": now(), **fields})
        if r.get("package_code"):
            pid = pkgs[r["package_code"]]
            opt = {"specification_label": r.get("specification") or "", "rate": (r.get("rate") or "").replace(",", "") or None, "updated_at": now()}
            existing = await db.package_options.find_one(tenant(ctx, package_id=pid, line_item_id=lid, status="active"))
            if existing:
                await db.package_options.update_one({"id": existing["id"]}, {"$set": opt})
            else:
                await db.package_options.insert_one({"id": new_id(), "organisation_id": ctx.org_id, "template_id": template_id,
                                                     "package_id": pid, "line_item_id": lid, "status": "active", "created_at": now(), **opt})
    await audit(ctx, "import_catalogue", "templates", template_id, meta={"rows": len(rows)})
    result["committed"] = True
    return result


@router.get("/{template_id}/import-log")
async def import_log(template_id: str, ctx: Ctx = Depends(need("catalogue.view"))):
    return clean(await db.import_logs.find_one(tenant(ctx, template_id=template_id), NO_ID, sort=[("created_at", -1)])) or {}
