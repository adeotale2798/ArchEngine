"""Deterministic estimate calculator. Pure function of (snapshot, selections) -> result.
No database access, no UI coupling: see DECISIONS.md D-006."""
from datetime import datetime, timezone
from decimal import Decimal

from app.core.config import ENGINE_VERSION
from app.core.money import D, ZERO, q, s
from app.engine import dsl

QTY_MODES = ["FIXED_QUANTITY", "INPUT_MULTIPLIER", "PER_FLOOR", "PER_BATHROOM", "FLOOR_BAND_LOOKUP",
             "LOOKUP_TABLE", "COMPOSITE", "RULE", "LUMP_SUM", "MANUAL_INTERNAL", "CLIENT_MANUAL"]
RULE_MODES = {"LOOKUP_TABLE", "COMPOSITE", "RULE"}
INCLUSIONS = ["INCLUDED", "OPTIONAL", "EXCLUDED", "INCLUDED_IN_RATE", "NOT_APPLICABLE"]


class Issues(list):
    def add(self, severity, code, message, line=None, client_message=None):
        self.append({"severity": severity, "code": code, "message": message,
                     "line_item_id": line["id"] if line else None, "line_code": line.get("code") if line else None,
                     "client_message": client_message})


def _by_id(rows):
    return {r["id"]: r for r in rows}


def _sort_key(r):
    return (r.get("sort_order") or 0, r.get("code") or "", r.get("name") or "")


def validate_inputs(snap, raw: dict, issues: Issues) -> tuple[dict, list]:
    env, shown = {}, []
    for d in sorted(snap["inputs"], key=_sort_key):
        key, label = d["key"], d["label"]
        val = raw.get(key, d.get("default_value"))
        if val in (None, ""):
            if d.get("required"):
                issues.add("critical", "INPUT_MISSING", f"'{label}' is required", client_message=f"Please enter {label}.")
            env[f"input.{key}"] = None
            continue
        itype = d.get("input_type", "integer")
        if itype == "boolean":
            num = Decimal(1 if val in (True, "true", "1", 1) else 0)
        elif itype == "select":
            num, val = None, str(val)
        else:
            try:
                num = D(val)
            except ValueError:
                issues.add("critical", "INPUT_INVALID", f"'{label}' must be a number", client_message=f"{label} must be a number.")
                continue
            if itype == "integer" and num != num.to_integral_value():
                issues.add("critical", "INPUT_INVALID", f"'{label}' must be a whole number",
                           client_message=f"{label} must be a whole number.")
            lo, hi = D(d.get("min_value")), D(d.get("max_value"))
            if (lo is not None and num < lo) or (hi is not None and num > hi):
                issues.add("critical", "INPUT_OUT_OF_RANGE", f"'{label}' = {val} is outside {lo}–{hi}",
                           client_message=f"{label} must be between {lo} and {hi}.")
        env[f"input.{key}"] = num
        unit = snap["_units"].get(d.get("unit_id"), {})
        shown.append({"key": key, "label": label, "value": str(val), "unit": unit.get("code"),
                      "help_text": d.get("help_text"), "client_visible": d.get("client_visible", True)})
    return env, shown


def resolve_option(snap, line_id, package_id):
    seen = set()
    while package_id and package_id not in seen:
        seen.add(package_id)
        opt = snap["_options"].get((package_id, line_id))
        if opt:
            return opt, package_id
        package_id = (snap["_packages"].get(package_id) or {}).get("inherits_from")
    return None, None


def _topo(lines, rules, issues: Issues):
    """Order line items so formula references are computed first; detect cycles."""
    by_code = {l["code"]: l for l in lines if l.get("code")}
    deps = {}
    for l in lines:
        r = rules.get(l.get("rule_id")) if l.get("quantity_mode") in RULE_MODES else None
        deps[l["id"]] = [by_code[x.split(".", 1)[1]]["id"] for x in (dsl.refs(r["expression"]) if r else [])
                         if x.startswith("item.") and x.split(".", 1)[1] in by_code]
    order, state, cyclic = [], {}, set()

    def visit(n, path):
        if state.get(n) == 2:
            return
        if state.get(n) == 1:
            cyc = path[path.index(n):] + [n]
            names = " → ".join(next(l["code"] for l in lines if l["id"] == x) for x in cyc)
            issues.add("critical", "CIRCULAR_DEPENDENCY", f"Circular formula dependency: {names}")
            cyclic.update(cyc)
            return
        state[n] = 1
        for m in deps[n]:
            visit(m, path + [n])
        state[n] = 2
        order.append(n)

    for l in lines:
        visit(l["id"], [])
    return order, cyclic


def _quantity(line, snap, env, sel, issues: Issues):
    """Returns (qty, unit_id, trace, client_trace, extra) or (None, ...) on failure."""
    mode = line.get("quantity_mode") or "FIXED_QUANTITY"
    unit_id, extra = line.get("unit_id"), {}
    label = lambda k: next((i["label"] for i in snap["inputs"] if i["key"] == k), k)
    if mode == "FIXED_QUANTITY":
        qv = D(line.get("fixed_quantity"))
        if qv is None:
            issues.add("critical", "QTY_MISSING", f"{line['code']}: fixed quantity not configured", line)
            return None, unit_id, "Quantity not configured", "", extra
        t = f"Configured quantity {s(qv)}" + (" (template assumption)" if line.get("is_assumption") else "")
        return qv, unit_id, t, t, extra
    if mode == "LUMP_SUM":
        return Decimal(1), unit_id, "Lump sum", "Lump sum", extra
    if mode == "INPUT_MULTIPLIER":
        k, f = line.get("input_key"), D(line.get("factor"))
        v = env.get(f"input.{k}")
        if v is None or f is None:
            issues.add("critical", "QTY_RULE_INCOMPLETE", f"{line['code']}: input/factor missing", line)
            return None, unit_id, "Input or factor missing", "", extra
        t = f"{label(k)} ({s(v)}) × configured factor ({s(f)}) = {s(v * f)}"
        return v * f, unit_id, t, t, extra
    if mode == "PER_FLOOR":
        rule = snap["_slab"].get(line["id"])
        if not rule:
            issues.add("critical", "SLAB_RULE_MISSING", f"{line['code']}: no slab/per-floor rule attached", line)
            return None, unit_id, "No per-floor rule", "", extra
        floors = env.get(f"input.{rule.get('input_key') or 'total_floors'}")
        if floors is None:
            return None, unit_id, "Floor count missing", "", extra
        adj = D(rule.get("floor_adjustment")) or ZERO
        count = max(floors + adj, ZERO)
        spf = D(rule.get("slabs_per_floor")) or Decimal(1)
        basis = rule.get("quantity_basis") or "COUNT"
        qpf = D(rule.get("quantity_per_floor"))
        if basis in ("AREA", "VOLUME") and qpf is None:
            issues.add("critical", "SLAB_BASIS_MISSING", f"{line['code']}: quantity per floor not configured", line)
            return None, unit_id, "Quantity per floor missing", "", extra
        qv = count * spf * (qpf if basis in ("AREA", "VOLUME") else Decimal(1))
        adj_txt = f" {'+' if adj >= 0 else '−'} {s(abs(adj))} adjustment" if adj else ""
        per = f" × {s(qpf)} per slab" if basis in ("AREA", "VOLUME") else ""
        t = f"Floors: {s(floors)}{adj_txt} = {s(count)} × {s(spf)} slab/floor{per} = {s(qv)} [{rule.get('name')}]"
        if rule.get("is_assumption"):
            t += " — indicative template quantity, not measured"
            extra["is_assumption"] = True
        return qv, rule.get("unit_id") or unit_id, t, rule.get("client_explanation") or t, extra
    if mode == "PER_BATHROOM":
        rule = snap["_bath"].get(line["id"])
        if not rule:
            issues.add("critical", "BATH_RULE_MISSING", f"{line['code']}: no bathroom rule attached", line)
            return None, unit_id, "No bathroom rule", "", extra
        b = env.get(f"input.{rule.get('input_key') or 'total_bathrooms'}")
        qpb = D(rule.get("quantity_per_bathroom"))
        if b is None or qpb is None:
            issues.add("critical", "BATH_RULE_INCOMPLETE", f"{line['code']}: bathroom count or quantity missing", line)
            return None, unit_id, "Bathroom basis missing", "", extra
        t = f"Bathrooms: {s(b)} × configured {s(qpb)} per bathroom = {s(b * qpb)}"
        return b * qpb, rule.get("unit_id") or unit_id, t, rule.get("client_explanation") or t, extra
    if mode == "FLOOR_BAND_LOOKUP":
        rs = snap["_found"].get(line["id"])
        if not rs:
            issues.add("critical", "FOUNDATION_RULE_MISSING", f"{line['code']}: no foundation rule set attached", line)
            return None, unit_id, "No foundation rule", "", extra
        floors = env.get(f"input.{rs.get('input_key') or 'total_floors'}")
        if floors is None:
            return None, unit_id, "Floor count missing", "", extra
        band = next((b for b in rs.get("bands", []) if b.get("status", "active") == "active"
                     and D(b.get("min_floors")) <= floors <= (D(b.get("max_floors")) if b.get("max_floors") not in (None, "") else floors)), None)
        if not band:
            issues.add("critical", "FOUNDATION_OUT_OF_RANGE",
                       f"{line['code']}: {s(floors)} floors matches no configured band in '{rs['name']}' — architect review required",
                       line, client_message="This floor count needs architect review before the foundation can be priced.")
            extra["requires_review"] = True
            return None, unit_id, f"Total floors: {s(floors)} → no configured band", "", extra
        qv = D(band.get("quantity"))
        extra.update(band=band, requires_review=bool(band.get("requires_review")))
        t = (f"Total floors: {s(floors)} → matched architect-configured band '{band.get('label')}' "
             f"[{band.get('min_floors')}–{band.get('max_floors') or '∞'}] → {band.get('specification') or 'package specification'}")
        if qv is None:
            issues.add("critical", "QTY_MISSING", f"{line['code']}: band '{band.get('label')}' has no quantity", line)
            return None, unit_id, t, "", extra
        return qv, band.get("unit_id") or unit_id, t, band.get("client_note") or t, extra
    if mode in RULE_MODES:
        rule = snap["_rules"].get(line.get("rule_id"))
        if not rule:
            issues.add("critical", "RULE_MISSING", f"{line['code']}: calculation rule not selected", line)
            return None, unit_id, "No rule", "", extra
        try:
            qv = dsl.evaluate(rule["expression"], env)
        except dsl.DSLError as e:
            issues.add("critical", "RULE_ERROR", f"{line['code']}: {e}", line)
            return None, unit_id, str(e), "", extra
        t = f"{rule['name']}: {dsl.explain(rule['expression'], snap['_labels'])} = {s(qv)}"
        return qv, rule.get("output_unit_id") or unit_id, t, rule.get("client_explanation") or t, extra
    if mode in ("MANUAL_INTERNAL", "CLIENT_MANUAL"):
        src = sel["manual"] if mode == "MANUAL_INTERNAL" else sel["client_qty"]
        qv = D(src.get(line["id"]))
        if qv is None:
            issues.add("warning", "MANUAL_QTY_MISSING", f"{line['code']}: quantity not entered yet", line)
            return None, unit_id, "Quantity to be entered", "", extra
        who = "architect" if mode == "MANUAL_INTERNAL" else "client"
        return qv, unit_id, f"Entered by {who}: {s(qv)}", f"Entered quantity {s(qv)}", extra
    issues.add("critical", "QTY_MODE_INVALID", f"{line['code']}: unknown quantity mode {mode}", line)
    return None, unit_id, "Invalid mode", "", extra


def _convert(snap, qty, from_u, to_u):
    if not from_u or not to_u or from_u == to_u:
        return qty, None
    for c in snap["conversions"]:
        if c["from_unit_id"] == from_u and c["to_unit_id"] == to_u:
            return qty * D(c["factor"]), D(c["factor"])
        if c["from_unit_id"] == to_u and c["to_unit_id"] == from_u and D(c["factor"]):
            return qty / D(c["factor"]), 1 / D(c["factor"])
    return None, None


def index_snapshot(snap: dict) -> dict:
    snap["_units"] = _by_id(snap["units"])
    snap["_packages"] = _by_id(snap["packages"])
    snap["_options"] = {(o["package_id"], o["line_item_id"]): o for o in snap["package_options"] if o.get("status", "active") == "active"}
    snap["_rules"] = _by_id(snap["rules"])
    snap["_rate_items"] = _by_id(snap["rate_card_items"])
    snap["_slab"] = {r["line_item_id"]: r for r in snap["slab_rules"] if r.get("line_item_id")}
    snap["_bath"] = {r["line_item_id"]: r for r in snap["bathroom_rules"] if r.get("line_item_id")}
    snap["_found"] = {r["line_item_id"]: r for r in snap["foundation_rule_sets"] if r.get("line_item_id")}
    snap["_labels"] = {f"input.{i['key']}": i["label"] for i in snap["inputs"]}
    snap["_labels"].update({f"item.{l['code']}": l["name"] for l in snap["line_items"]})
    return snap


def calculate(snap: dict, inputs: dict, package_id: str, overrides: dict | None = None,
              manual: dict | None = None) -> dict:
    snap = index_snapshot(dict(snap))
    overrides, manual = overrides or {}, manual or {}
    issues = Issues()
    settings = snap.get("settings") or {}
    env, shown_inputs = validate_inputs(snap, inputs or {}, issues)
    pkg = snap["_packages"].get(package_id)
    if not pkg:
        issues.add("critical", "PACKAGE_MISSING", "Selected package is not available", client_message="Please choose a package.")
        pkg = {"id": None, "name": "—", "code": "", "description": ""}
    sections, subsections = _by_id(snap["sections"]), _by_id(snap["subsections"])
    lines = [l for l in snap["line_items"] if l.get("section_id") in sections]
    sel = {"manual": manual, "client_qty": {k: v.get("quantity") for k, v in overrides.items() if isinstance(v, dict)}}
    order, cyclic = _topo(lines, snap["_rules"], issues)
    line_by_id = {l["id"]: l for l in lines}
    results = {}

    for lid in order:
        line = line_by_id[lid]
        ov = overrides.get(lid) or {}
        opt, src_pkg = resolve_option(snap, lid, pkg["id"])
        overridden = False
        if ov.get("option_package_id") and ov["option_package_id"] != src_pkg:
            alt, alt_src = resolve_option(snap, lid, ov["option_package_id"])
            if alt and line.get("client_can_change_option"):
                opt, src_pkg, overridden = alt, alt_src, True
        inclusion = (opt or {}).get("inclusion_status") or line.get("inclusion_default") or "INCLUDED"
        selected = inclusion != "OPTIONAL" or bool(ov.get("selected"))
        r = {"line_item_id": lid, "code": line.get("code"), "name": line["name"], "description": line.get("description"),
             "section_id": line["section_id"], "subsection_id": line.get("subsection_id"),
             "specification": (opt or {}).get("specification_label") or "",
             "specification_details": (opt or {}).get("specification_details") or "",
             "spec_source_package_id": src_pkg, "is_overridden": overridden, "inclusion": inclusion,
             "optional_selected": selected if inclusion == "OPTIONAL" else None,
             "client_visible": line.get("client_visible", True), "can_change_option": bool(line.get("client_can_change_option")),
             "can_change_quantity": bool(line.get("client_can_change_quantity")) and line.get("quantity_mode") == "CLIENT_MANUAL",
             "price_visibility": line.get("client_price_visibility") or "SHOW_RATE",
             "client_notes": "\n".join(x for x in [line.get("client_notes"), (opt or {}).get("client_note")] if x),
             "internal_notes": line.get("internal_notes") or "", "exclusions": line.get("exclusions") or "",
             "quantity_mode": line.get("quantity_mode"), "quantity": None, "unit": None, "rate": None, "rate_unit": None,
             "rate_source": None, "internal_cost": None, "amount": "0.00", "is_assumption": bool(line.get("is_assumption")),
             "trace": "", "client_trace": "", "status": inclusion, "requires_review": False, "image_url": line.get("image_url")}
        if not opt and inclusion not in ("EXCLUDED", "NOT_APPLICABLE"):
            issues.add("warning", "SPEC_MISSING", f"{line.get('code')}: no specification configured for package '{pkg['name']}'", line)
            r["specification"] = "Not specified for this package"
        if lid in cyclic:
            results[lid] = {**r, "status": "REQUIRES_REVIEW"}
            env[f"item.{line.get('code')}"] = None
            continue
        qty, qunit, trace, ctrace, extra = _quantity(line, snap, env, sel, issues)
        band = extra.get("band")
        if band and band.get("specification"):
            r["specification"] = band["specification"] + (f" — {r['specification']}" if r["specification"] and r["specification"] != "Not specified for this package" else "")
        r.update(trace=trace, client_trace=ctrace, requires_review=extra.get("requires_review", False),
                 is_assumption=r["is_assumption"] or extra.get("is_assumption", False))
        env[f"item.{line.get('code')}"] = qty
        r["unit"] = (snap["_units"].get(qunit) or {}).get("code")
        if qty is not None:
            r["quantity"] = s(qty)
            if qty < 0:
                issues.add("critical", "NEGATIVE_QTY", f"{line.get('code')}: quantity is negative", line)
        if inclusion in ("EXCLUDED", "NOT_APPLICABLE", "INCLUDED_IN_RATE") or not selected:
            r["status"] = "OPTIONAL" if inclusion == "OPTIONAL" else inclusion
            results[lid] = r
            continue
        # rate resolution: band rate > rate card item > package option rate
        rate, runit, rsrc, cost = None, None, None, None
        if band and (band.get("rates") or {}).get(src_pkg) not in (None, ""):
            rate, runit, rsrc = D(band["rates"][src_pkg]), band.get("unit_id") or qunit, f"Foundation band '{band.get('label')}'"
        elif opt and opt.get("rate_card_item_id") and opt["rate_card_item_id"] in snap["_rate_items"]:
            ri = snap["_rate_items"][opt["rate_card_item_id"]]
            rate, runit, rsrc, cost = D(ri.get("rate")), ri.get("unit_id"), f"Rate card {ri.get('code')}", D(ri.get("internal_cost"))
        elif opt and opt.get("rate") not in (None, ""):
            rate, runit, rsrc, cost = D(opt["rate"]), opt.get("unit_id") or line.get("unit_id"), "Package rate", D(opt.get("internal_cost"))
        if rate is None:
            issues.add("critical", "UNPRICED", f"{line.get('code')}: no rate configured for package '{pkg['name']}'", line,
                       client_message=f"'{line['name']}' is awaiting pricing.")
            r["status"] = "UNPRICED"
            results[lid] = r
            continue
        if rate < 0:
            issues.add("critical", "NEGATIVE_RATE", f"{line.get('code')}: rate is negative", line)
        r.update(rate=s(rate, 2), rate_source=rsrc, internal_cost=s(cost, 2) if cost is not None else None,
                 rate_unit=(snap["_units"].get(runit) or {}).get("code"))
        if line.get("quantity_mode") == "LUMP_SUM":
            amount = rate
        elif qty is None:
            r["status"] = "REQUIRES_REVIEW"
            results[lid] = r
            continue
        else:
            nq, factor = _convert(snap, qty, qunit, runit)
            if nq is None:
                issues.add("critical", "UNIT_MISMATCH", f"{line.get('code')}: quantity unit '{r['unit']}' and rate unit "
                           f"'{r['rate_unit']}' are incompatible (no conversion configured)", line)
                r["status"] = "REQUIRES_REVIEW"
                results[lid] = r
                continue
            if factor is not None:
                r["trace"] += f" → converted ×{s(factor)} = {s(nq)} {r['rate_unit']}"
            amount = nq * rate
        r["amount"] = s(q(amount), 2)
        r["status"] = "REQUIRES_REVIEW" if r["requires_review"] else "INCLUDED"
        if r["requires_review"]:
            issues.add("warning", "BAND_REVIEW", f"{line.get('code')}: matched band requires architect review", line,
                       client_message="Foundation specification will be confirmed by the architect/structural engineer.")
        results[lid] = r

    ordered = sorted(results.values(), key=lambda r: (
        _sort_key(sections[r["section_id"]]), _sort_key(subsections.get(r["subsection_id"]) or {}), _sort_key(line_by_id[r["line_item_id"]])))
    sec_out = []
    for sid in sorted(sections, key=lambda k: _sort_key(sections[k])):
        sec_lines = [r for r in ordered if r["section_id"] == sid]
        if not sec_lines:
            continue
        subs = []
        for ssid in sorted({r["subsection_id"] for r in sec_lines if r["subsection_id"]}, key=lambda k: _sort_key(subsections.get(k) or {})):
            subs.append({"id": ssid, "name": (subsections.get(ssid) or {}).get("name"),
                         "subtotal": s(sum((D(r["amount"]) for r in sec_lines if r["subsection_id"] == ssid), ZERO), 2)})
        sec_out.append({"id": sid, "name": sections[sid]["name"], "code": sections[sid].get("code"),
                        "image_url": sections[sid].get("image_url"),
                        "subtotal": s(sum((D(r["amount"]) for r in sec_lines), ZERO), 2), "subsections": subs})
    subtotal = sum((D(r["amount"]) for r in ordered), ZERO)
    cont = settings.get("contingency") or {}
    tax = settings.get("tax") or {}
    c_rate = D(cont.get("rate")) if cont.get("enabled") else ZERO
    contingency = q(subtotal * (c_rate or ZERO) / 100)
    t_rate = D(tax.get("rate")) if tax.get("enabled") else ZERO
    tax_amt = q((subtotal + contingency) * (t_rate or ZERO) / 100)
    critical = [i for i in issues if i["severity"] == "critical"]
    tpl = snap.get("template") or {}
    return {
        "engine_version": ENGINE_VERSION, "calculated_at": datetime.now(timezone.utc).isoformat(),
        "currency": settings.get("currency", "INR"), "currency_symbol": settings.get("currency_symbol", "₹"),
        "package": {k: pkg.get(k) for k in ("id", "code", "name", "description", "image_url")},
        "inputs": shown_inputs, "lines": ordered, "sections": sec_out,
        "totals": {"subtotal": s(q(subtotal), 2), "contingency_enabled": bool(cont.get("enabled")),
                   "contingency_rate": s(c_rate or ZERO), "contingency": s(contingency, 2),
                   "tax_enabled": bool(tax.get("enabled")), "tax_label": tax.get("label", "GST"),
                   "tax_rate": s(t_rate or ZERO), "tax": s(tax_amt, 2),
                   "grand_total": s(q(subtotal + contingency + tax_amt), 2),
                   "basis": "Tax is computed on (subtotal + contingency). Contingency is a separate allowance on the subtotal."},
        "issues": list(issues), "critical_count": len(critical), "is_complete": not critical,
        "assumptions": tpl.get("assumptions") or [], "exclusions": tpl.get("exclusions") or [],
        "disclaimer": settings.get("disclaimer") or "",
    }


CLIENT_LINE_KEYS = ["line_item_id", "code", "name", "description", "section_id", "subsection_id", "specification",
                    "specification_details", "spec_source_package_id", "is_overridden", "inclusion", "optional_selected",
                    "can_change_option", "can_change_quantity", "price_visibility", "client_notes", "exclusions",
                    "quantity", "unit", "rate", "rate_unit", "amount", "is_assumption", "client_trace", "status",
                    "requires_review", "image_url", "quantity_mode"]


def client_view(result: dict) -> dict:
    """Whitelist-based projection: internal cost, notes, traces and hidden rates never leave the server."""
    lines = []
    for r in result["lines"]:
        if not r.get("client_visible", True):
            continue
        c = {k: r.get(k) for k in CLIENT_LINE_KEYS}
        if c["price_visibility"] != "SHOW_RATE":
            c["rate"] = None
            c["rate_unit"] = None
        if c["price_visibility"] == "HIDDEN":
            c["amount"] = None
        lines.append(c)
    issues = [{"severity": i["severity"], "message": i["client_message"], "line_item_id": i["line_item_id"]}
              for i in result["issues"] if i.get("client_message")]
    out = {k: v for k, v in result.items() if k not in ("lines", "issues")}
    return {**out, "lines": lines, "issues": issues}
