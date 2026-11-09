"""Static + simulated validation of a template configuration (pre-publish gate)."""
from app.core.money import D
from app.engine import dsl
from app.engine.calculator import calculate


def _bands_issues(rs):
    out, bands = [], sorted([b for b in rs.get("bands", []) if b.get("status", "active") == "active"],
                            key=lambda b: D(b.get("min_floors")) or 0)
    if not bands:
        out.append(("critical", "BANDS_EMPTY", f"Foundation rule '{rs['name']}' has no active bands"))
    for i, b in enumerate(bands):
        lo, hi = D(b.get("min_floors")), D(b.get("max_floors"))
        lbl = b.get("label") or f"band {i + 1}"
        if lo is None:
            out.append(("critical", "BAND_INVALID", f"'{rs['name']}' {lbl}: minimum floors missing"))
            continue
        if hi is not None and hi < lo:
            out.append(("critical", "BAND_INVALID", f"'{rs['name']}' {lbl}: max is less than min"))
        if D(b.get("quantity")) is None:
            out.append(("critical", "BAND_INCOMPLETE", f"'{rs['name']}' {lbl}: quantity missing"))
        if not (b.get("approval_reference") or "").strip():
            out.append(("warning", "BAND_NO_APPROVAL", f"'{rs['name']}' {lbl}: no architect/structural approval reference recorded"))
        if i + 1 < len(bands):
            nlo = D(bands[i + 1].get("min_floors"))
            if hi is None or (nlo is not None and nlo <= hi):
                out.append(("critical", "BAND_OVERLAP", f"'{rs['name']}': {lbl} overlaps {bands[i + 1].get('label') or 'next band'}"))
            elif nlo is not None and nlo > hi + 1:
                out.append(("warning", "BAND_GAP", f"'{rs['name']}': floors {hi + 1}–{nlo - 1} are not covered by any band"))
    return out


def validate_snapshot(snap: dict) -> dict:
    issues = []
    add = lambda sev, code, msg: issues.append({"severity": sev, "code": code, "message": msg})
    input_keys = {i["key"] for i in snap["inputs"]}
    codes = [l.get("code") for l in snap["line_items"]]
    for c in {c for c in codes if c and codes.count(c) > 1}:
        add("critical", "DUPLICATE_CODE", f"Line item code '{c}' is used more than once")
    for r in snap["rules"]:
        for e in dsl.validate(r.get("expression") or {}, input_keys, set(codes)):
            add("critical", "RULE_INVALID", f"Rule '{r['name']}': {e}")
    for rs in snap["foundation_rule_sets"]:
        if not rs.get("line_item_id"):
            add("warning", "RULE_UNBOUND", f"Foundation rule '{rs['name']}' is not linked to a line item")
        for sev, code, msg in _bands_issues(rs):
            add(sev, code, msg)
    for r in snap["slab_rules"]:
        if (r.get("quantity_basis") or "") not in ("COUNT", "AREA", "VOLUME", "LUMP_SUM"):
            add("critical", "SLAB_BASIS_MISSING", f"Slab rule '{r['name']}': counting basis not explicit")
        if r.get("quantity_basis") in ("AREA", "VOLUME") and not r.get("is_assumption"):
            add("warning", "SLAB_AREA_NOT_ASSUMPTION", f"Slab rule '{r['name']}': per-floor area should be labelled as a template assumption (no footprint is collected)")
        if r.get("input_key", "total_floors") not in input_keys:
            add("critical", "INPUT_MISSING", f"Slab rule '{r['name']}' uses unknown input '{r.get('input_key')}'")
    for r in snap["bathroom_rules"]:
        if D(r.get("quantity_per_bathroom")) is None:
            add("critical", "BATH_RULE_INCOMPLETE", f"Bathroom rule '{r['name']}': quantity per bathroom missing")
        if r.get("input_key", "total_bathrooms") not in input_keys:
            add("critical", "INPUT_MISSING", f"Bathroom rule '{r['name']}' uses unknown input '{r.get('input_key')}'")
    for i in snap["inputs"]:
        lo, hi = D(i.get("min_value")), D(i.get("max_value"))
        if lo is not None and hi is not None and lo > hi:
            add("critical", "INPUT_RANGE", f"Input '{i['label']}': min is greater than max")
        if not (i.get("help_text") or "").strip():
            add("warning", "INPUT_NO_HELP", f"Input '{i['label']}': add help text explaining what is counted")
    if not snap["packages"]:
        add("critical", "NO_PACKAGES", "No active packages")
    defaults = {i["key"]: i.get("default_value") for i in snap["inputs"]}
    seen = {(x["code"], x["message"]) for x in issues}
    for p in snap["packages"]:
        res = calculate(snap, defaults, p["id"])
        for i in res["issues"]:
            if i["code"] in ("INPUT_MISSING",):
                continue
            msg = f"[{p['name']} @ default inputs] {i['message']}"
            if (i["code"], msg) not in seen:
                seen.add((i["code"], msg))
                issues.append({"severity": i["severity"], "code": i["code"], "message": msg, "line_item_id": i.get("line_item_id")})
    crit = sum(1 for i in issues if i["severity"] == "critical")
    return {"issues": issues, "critical_count": crit, "warning_count": len(issues) - crit, "can_publish": crit == 0}
