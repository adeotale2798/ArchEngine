"""Pure engine tests: DSL safety, quantity modes, bands, units, totals, privacy projection, CSV injection."""
from decimal import Decimal

import pytest

from app.engine import dsl
from app.engine.calculator import calculate, client_view
from app.engine.validation import validate_snapshot
from app.exports.render import render_csv, safe_cell


def snap(**over):
    base = {
        "template": {"assumptions": ["A1"], "exclusions": ["E1"]},
        "settings": {"tax": {"enabled": True, "label": "GST", "rate": "18"}, "contingency": {"enabled": True, "rate": "5"}},
        "inputs": [{"id": "i1", "key": "total_floors", "label": "Floors", "input_type": "integer", "required": True, "default_value": "2", "min_value": "1", "max_value": "10", "help_text": "x"},
                   {"id": "i2", "key": "total_bathrooms", "label": "Bathrooms", "input_type": "integer", "required": True, "default_value": "2", "min_value": "0", "max_value": "9", "help_text": "x"}],
        "sections": [{"id": "s1", "name": "Structure", "sort_order": 1}], "subsections": [],
        "line_items": [
            {"id": "f", "code": "FOUND", "name": "Foundation", "section_id": "s1", "quantity_mode": "FLOOR_BAND_LOOKUP", "unit_id": "sft", "sort_order": 1},
            {"id": "sl", "code": "SLAB", "name": "Slab", "section_id": "s1", "quantity_mode": "PER_FLOOR", "unit_id": "sft", "sort_order": 2},
            {"id": "b", "code": "SAN", "name": "Sanitary set", "section_id": "s1", "quantity_mode": "PER_BATHROOM", "unit_id": "set", "sort_order": 3,
             "client_can_change_option": True, "internal_notes": "SECRET-NOTE"},
            {"id": "o", "code": "OPT", "name": "Solar", "section_id": "s1", "quantity_mode": "LUMP_SUM", "inclusion_default": "OPTIONAL", "sort_order": 4},
        ],
        "packages": [{"id": "pa", "code": "A", "name": "Type A"}, {"id": "pd", "code": "D", "name": "Package D", "inherits_from": "pa"}],
        "package_options": [
            {"id": "1", "package_id": "pa", "line_item_id": "f", "specification_label": "Std", "rate": "100"},
            {"id": "2", "package_id": "pa", "line_item_id": "sl", "specification_label": "M20", "rate": "10", "internal_cost": "7"},
            {"id": "3", "package_id": "pa", "line_item_id": "b", "specification_label": "Basic", "rate": "1000"},
            {"id": "4", "package_id": "pd", "line_item_id": "b", "specification_label": "Premium", "rate": "3000"},
            {"id": "5", "package_id": "pa", "line_item_id": "o", "specification_label": "Solar kit", "rate": "50000"},
        ],
        "rules": [],
        "foundation_rule_sets": [{"id": "fr", "name": "F", "line_item_id": "f", "bands": [
            {"label": "Low", "min_floors": "1", "max_floors": "3", "quantity": "10", "specification": "Isolated footing", "rates": {}, "approval_reference": "SE-1"},
            {"label": "Mid", "min_floors": "4", "max_floors": "5", "quantity": "20", "specification": "Raft", "rates": {"pa": "150"}, "approval_reference": "SE-2"}]}],
        "slab_rules": [{"id": "sr", "name": "Slabs", "line_item_id": "sl", "quantity_basis": "AREA", "slabs_per_floor": "1", "quantity_per_floor": "1000", "is_assumption": True}],
        "bathroom_rules": [{"id": "br", "name": "San", "line_item_id": "b", "quantity_per_bathroom": "1"}],
        "units": [{"id": "sft", "code": "sft"}, {"id": "sqm", "code": "sqm"}, {"id": "set", "code": "set"}],
        "conversions": [{"from_unit_id": "sqm", "to_unit_id": "sft", "factor": "10.7639104"}], "rate_card_items": [],
    }
    base.update(over)
    return base


def line(res, code):
    return next(l for l in res["lines"] if l["code"] == code)


def test_floor_band_switches_and_recalculates():
    low = calculate(snap(), {"total_floors": 2, "total_bathrooms": 2}, "pa")
    high = calculate(snap(), {"total_floors": 5, "total_bathrooms": 2}, "pa")
    assert line(low, "FOUND")["amount"] == "1000.00" and "Isolated footing" in line(low, "FOUND")["specification"]
    assert line(high, "FOUND")["amount"] == "3000.00" and "Raft" in line(high, "FOUND")["specification"]
    assert "matched architect-configured band 'Mid'" in line(high, "FOUND")["trace"]


def test_out_of_range_floor_blocks():
    res = calculate(snap(max_value="20") if False else snap(), {"total_floors": 7, "total_bathrooms": 1}, "pa")
    assert any(i["code"] == "FOUNDATION_OUT_OF_RANGE" for i in res["issues"]) and not res["is_complete"]


def test_slab_per_floor_and_assumption_label():
    res = calculate(snap(), {"total_floors": 3, "total_bathrooms": 0}, "pa")
    sl = line(res, "SLAB")
    assert sl["quantity"] == "3000" and sl["amount"] == "30000.00" and sl["is_assumption"]
    assert "not measured" in sl["trace"]


def test_bathroom_count_drives_quantity():
    r2 = calculate(snap(), {"total_floors": 2, "total_bathrooms": 2}, "pa")
    r4 = calculate(snap(), {"total_floors": 2, "total_bathrooms": 4}, "pa")
    assert line(r2, "SAN")["quantity"] == "2" and line(r4, "SAN")["amount"] == "4000.00"


def test_package_d_inherits_and_overrides():
    res = calculate(snap(), {"total_floors": 2, "total_bathrooms": 1}, "pd")
    assert line(res, "SAN")["specification"] == "Premium" and line(res, "SLAB")["specification"] == "M20"


def test_client_override_and_optional_toggle():
    base = calculate(snap(), {"total_floors": 2, "total_bathrooms": 1}, "pa")
    ov = calculate(snap(), {"total_floors": 2, "total_bathrooms": 1}, "pa", {"b": {"option_package_id": "pd"}, "o": {"selected": True}})
    assert line(ov, "SAN")["is_overridden"] and line(ov, "SAN")["amount"] == "3000.00"
    assert line(base, "OPT")["amount"] == "0.00" and line(ov, "OPT")["amount"] == "50000.00"


def test_override_ignored_when_not_permitted():
    s = snap()
    s["line_items"][1]["client_can_change_option"] = False
    res = calculate(s, {"total_floors": 2, "total_bathrooms": 1}, "pa", {"sl": {"option_package_id": "pd"}})
    assert not line(res, "SLAB")["is_overridden"]


def test_totals_decimal_tax_and_contingency_separate():
    res = calculate(snap(), {"total_floors": 2, "total_bathrooms": 1}, "pa")
    t = res["totals"]
    sub = Decimal(t["subtotal"])
    assert Decimal(t["contingency"]) == (sub * Decimal("0.05")).quantize(Decimal("0.01"))
    assert Decimal(t["grand_total"]) == sub + Decimal(t["contingency"]) + Decimal(t["tax"])


def test_missing_rate_flagged_unpriced():
    s = snap()
    s["package_options"] = [o for o in s["package_options"] if o["id"] != "3"]
    s["package_options"].append({"id": "x", "package_id": "pa", "line_item_id": "b", "specification_label": "Basic"})
    res = calculate(s, {"total_floors": 2, "total_bathrooms": 1}, "pa")
    assert line(res, "SAN")["status"] == "UNPRICED" and not res["is_complete"]


def test_unit_mismatch_and_conversion():
    s = snap()
    s["package_options"][1]["unit_id"] = "sqm"
    res = calculate(s, {"total_floors": 1, "total_bathrooms": 0}, "pa")
    assert line(res, "SLAB")["amount"] == "929.03"  # 1000 sft -> 92.903 sqm × 10
    s["package_options"][1]["unit_id"] = "set"
    res = calculate(s, {"total_floors": 1, "total_bathrooms": 0}, "pa")
    assert any(i["code"] == "UNIT_MISMATCH" for i in res["issues"])


def test_circular_dependency_detected():
    s = snap()
    s["rules"] = [{"id": "r1", "name": "A", "expression": {"ref": "item.Y"}}, {"id": "r2", "name": "B", "expression": {"ref": "item.X"}}]
    s["line_items"] += [{"id": "x", "code": "X", "name": "X", "section_id": "s1", "quantity_mode": "COMPOSITE", "rule_id": "r1"},
                        {"id": "y", "code": "Y", "name": "Y", "section_id": "s1", "quantity_mode": "COMPOSITE", "rule_id": "r2"}]
    res = calculate(s, {"total_floors": 1, "total_bathrooms": 0}, "pa")
    assert any(i["code"] == "CIRCULAR_DEPENDENCY" for i in res["issues"])


def test_dsl_rejects_code_and_evaluates_safely():
    assert dsl.validate({"op": "__import__", "args": []}, set(), set())
    assert dsl.validate({"python": "os.system('x')"}, set(), set())
    expr = {"op": "if", "cond": {"op": "gt", "args": [{"ref": "input.total_floors"}, {"const": "3"}]},
            "then": {"op": "mul", "args": [{"ref": "input.total_floors"}, {"const": "2"}]}, "else": {"const": "1"}}
    assert dsl.evaluate(expr, {"input.total_floors": Decimal(5)}) == Decimal(10)
    assert "if" in dsl.explain(expr)
    with pytest.raises(dsl.DSLError):
        dsl.evaluate({"op": "div", "args": [{"const": "1"}, {"const": "0"}]}, {})


def test_band_overlap_and_gap_validation():
    s = snap()
    s["foundation_rule_sets"][0]["bands"].append({"label": "Overlap", "min_floors": "5", "max_floors": "8", "quantity": "1"})
    codes = {i["code"] for i in validate_snapshot(s)["issues"]}
    assert "BAND_OVERLAP" in codes
    s["foundation_rule_sets"][0]["bands"][-1]["min_floors"] = "8"
    codes = {i["code"] for i in validate_snapshot(s)["issues"]}
    assert "BAND_GAP" in codes


def test_client_view_strips_internal_fields():
    res = client_view(calculate(snap(), {"total_floors": 2, "total_bathrooms": 1}, "pa"))
    blob = str(res)
    assert "SECRET-NOTE" not in blob and "internal_cost" not in blob and "'trace'" not in blob


def test_csv_formula_injection_neutralised():
    assert safe_cell("=HYPERLINK(1)") == "'=HYPERLINK(1)" and safe_cell("+1") == "'+1" and safe_cell("@x") == "'@x"
    s = snap()
    s["line_items"][0]["name"] = "=cmd|' /C calc'!A0"
    res = client_view(calculate(s, {"total_floors": 2, "total_bathrooms": 1}, "pa"))
    out = render_csv({"number": "E1", "revision_number": 1, "result": res}).decode("utf-8")
    assert ",'=cmd" in out
