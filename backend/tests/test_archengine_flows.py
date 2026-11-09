"""End-to-end API regression for ArchEngine (catalogue CRUD, rules, simulator, publish, estimates, portal, exports, isolation).
Runs against the public URL. Creates only TEST_ data inside a TEST_ section and archives it at the end."""
import csv
import io
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
RUN = uuid.uuid4().hex[:5].upper()
S = {}  # shared state across ordered tests


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def A():
    return login("architect@studioeleven.in", "Studioeleven@2026")


@pytest.fixture(scope="module")
def B():
    return login("admin@tenantb-demo.com", "TenantB@2026")


def g(h, path, **kw):
    return requests.get(f"{API}{path}", headers=h, timeout=60, **kw)


def p(h, path, js=None):
    return requests.post(f"{API}{path}", headers=h, json=js if js is not None else {}, timeout=90)


def pa(h, path, js):
    return requests.patch(f"{API}{path}", headers=h, json=js, timeout=60)


def sim(h, inputs, pkg=None, compare=None):
    body = {"inputs": inputs, "package_id": pkg or S["pkg"]["TYPE_B"]}
    if compare:
        body["compare_inputs"] = compare
    r = p(h, f"/templates/{S['tid']}/simulate", body)
    assert r.status_code == 200, r.text
    return r.json()


def line(res, code):
    return next((l for l in res["lines"] if l["code"] == code), None)


# --- setup / discovery
def test_00_setup(A):
    tpl = g(A, "/r/templates").json()[0]
    S["tid"] = tpl["id"]
    S["pkg"] = {x["code"]: x["id"] for x in g(A, "/r/packages", params={"template_id": S["tid"]}).json()}
    S["units"] = {u["code"].lower(): u["id"] for u in g(A, "/r/units").json()}
    S["secs"] = {x["name"]: x for x in g(A, "/r/sections", params={"template_id": S["tid"]}).json()}
    assert "TYPE_B" in S["pkg"] and len(S["units"]) >= 2
    print("units:", list(S["units"].keys()))
    res = sim(A, {"total_floors": 4, "total_bathrooms": 2})
    assert res["totals"]["subtotal"] == "13522000.00"


# --- Sections: create, subsection, reorder, duplicate, archive/restore
def test_01_sections_crud(A):
    r = p(A, "/r/sections", {"template_id": S["tid"], "code": f"TST{RUN}", "name": f"TEST_Section {RUN}"})
    assert r.status_code == 200, r.text
    S["sec"] = r.json()["id"]
    plumbing = next(v for k, v in S["secs"].items() if "plumbing" in k.lower())
    r = p(A, "/r/subsections", {"template_id": S["tid"], "section_id": plumbing["id"], "name": f"TEST_Plumb sub {RUN}"})
    assert r.status_code == 200, r.text
    S["plumb_sub"] = r.json()["id"]
    r = p(A, "/r/subsections", {"template_id": S["tid"], "section_id": S["sec"], "name": f"TEST_Sub {RUN}"})
    S["sub"] = r.json()["id"]
    # reorder: move new section to top, then verify order
    ids = [x["id"] for x in g(A, "/r/sections", params={"template_id": S["tid"]}).json()]
    new = [S["sec"]] + [i for i in ids if i != S["sec"]]
    assert p(A, "/r/sections/reorder", {"ids": new}).status_code == 200
    assert g(A, "/r/sections", params={"template_id": S["tid"]}).json()[0]["id"] == S["sec"]
    assert p(A, "/r/sections/reorder", {"ids": ids}).status_code == 200  # restore original order
    # duplicate
    d = p(A, f"/r/sections/{S['sec']}/duplicate")
    assert d.status_code == 200 and d.json()["name"].endswith("(copy)") and d.json()["code"] == f"TST{RUN}-2"
    S["dup_sec"] = d.json()["id"]
    assert p(A, f"/r/sections/{S['dup_sec']}/archive").json()["status"] == "archived"
    assert S["dup_sec"] not in [x["id"] for x in g(A, "/r/sections", params={"template_id": S["tid"]}).json()]
    assert p(A, f"/r/sections/{S['dup_sec']}/restore").json()["status"] == "active"
    assert p(A, f"/r/sections/{S['dup_sec']}/archive").status_code == 200


def _mk_line(A, code, name, **kw):
    body = {"template_id": S["tid"], "section_id": S["sec"], "subsection_id": S["sub"], "code": code, "name": name,
            "unit_id": S["units"].get("sft") or list(S["units"].values())[0], "quantity_mode": "FIXED_QUANTITY",
            "fixed_quantity": "10", "inclusion_default": "INCLUDED", **kw}
    r = p(A, "/r/line_items", body)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _opt(A, lid, pkg_code, rate, **kw):
    r = p(A, "/r/package_options", {"template_id": S["tid"], "package_id": S["pkg"][pkg_code], "line_item_id": lid,
                                     "specification_label": f"TEST spec {pkg_code}", "rate": rate, **kw})
    assert r.status_code == 200, r.text
    return r.json()["id"]


# --- Line items + per-package rate + history
def test_02_line_item_and_history(A):
    lid = _mk_line(A, f"T{RUN}-01", "=HYPERLINK(\"x\") TEST_line", internal_notes="SECRET_NOTE VERIFY UNIT")
    S["l1"] = lid
    for c in S["pkg"]:
        _opt(A, lid, c, "100", internal_cost="77")
    r = pa(A, f"/r/line_items/{lid}", {"fixed_quantity": "12"})
    assert r.status_code == 200 and r.json()["fixed_quantity"] == "12"
    h = g(A, f"/r/line_items/{lid}/history").json()
    assert any(e["action"] == "update" for e in h)
    l = line(sim(A, {"total_floors": 4, "total_bathrooms": 2}), f"T{RUN}-01")
    assert l["amount"] == "1200.00", l


# --- Package D inheriting from Type B
def test_03_package_d(A):
    r = p(A, "/r/packages", {"template_id": S["tid"], "code": f"PKG_D{RUN}", "name": f"TEST_Package D {RUN}", "inherits_from": S["pkg"]["TYPE_B"]})
    assert r.status_code == 200, r.text
    S["pkgD"] = r.json()["id"]
    dup = p(A, "/r/packages", {"template_id": S["tid"], "code": f"PKG_D{RUN}", "name": "x"})
    assert dup.status_code == 409
    resD = sim(A, {"total_floors": 4, "total_bathrooms": 2}, pkg=S["pkgD"])
    resB = sim(A, {"total_floors": 4, "total_bathrooms": 2})
    assert resD["totals"]["subtotal"] == resB["totals"]["subtotal"], (resD["totals"], resB["totals"])
    assert resD["critical_count"] == 0


# --- Foundation bands: overlap -> critical, compare floors
def test_04_foundation_bands(A):
    lid = _mk_line(A, f"T{RUN}-FND", "TEST_Foundation", quantity_mode="FLOOR_BAND_LOOKUP")
    S["lf"] = lid
    allp = list(S["pkg"].values()) + [S["pkgD"]]
    bands = [{"label": "1-3", "min_floors": "1", "max_floors": "3", "quantity": "100", "rates": {k: "10" for k in allp}},
             {"label": "3-8", "min_floors": "3", "max_floors": "8", "quantity": "200", "rates": {k: "20" for k in allp}}]
    r = p(A, "/r/foundation_rules", {"template_id": S["tid"], "name": f"TEST_FR {RUN}", "line_item_id": lid, "input_key": "total_floors", "bands": bands})
    assert r.status_code == 200, r.text
    S["fr"] = r.json()["id"]
    v = p(A, f"/templates/{S['tid']}/validate").json()
    assert any(i["code"] == "BAND_OVERLAP" and i["severity"] == "critical" for i in v["issues"]), "overlap not flagged"
    bands[1].update(label="5-8", min_floors="5")
    assert pa(A, f"/r/foundation_rules/{S['fr']}", {"bands": bands}).status_code == 200
    v = p(A, f"/templates/{S['tid']}/validate").json()
    assert not any(i["code"] == "BAND_OVERLAP" and "TEST_FR" in i["message"] for i in v["issues"])
    res = sim(A, {"total_floors": 2, "total_bathrooms": 2}, compare={"total_floors": 6, "total_bathrooms": 2})
    lf = line(res, f"T{RUN}-FND")
    print("FND line floors=2:", {k: lf[k] for k in ("status", "inclusion", "quantity", "rate", "rate_source", "amount", "trace")})
    assert lf["amount"] == "1000.00", lf
    assert res["comparison"]["lines"][lid] == "4000.00"
    gap = sim(A, {"total_floors": 4, "total_bathrooms": 2})
    print("floors=4 (gap) status:", line(gap, f"T{RUN}-FND")["status"], [i["code"] for i in gap["issues"] if i["severity"] == "critical"])
    bands[1].update(label="4-8", min_floors="4")  # close the gap so the template stays publishable
    assert pa(A, f"/r/foundation_rules/{S['fr']}", {"bands": bands}).status_code == 200


# --- Slab per-floor: FIN-03 = (floors-1) x 1290
def test_05_slab_fin03(A):
    for f in (2, 4, 6):
        l = line(sim(A, {"total_floors": f, "total_bathrooms": 2}), "FIN-03")
        assert l is not None
        assert float(l["quantity"]) == (f - 1) * 1290, (f, l["quantity"], l["trace"])


# --- Bathroom per-bathroom quantity
def test_06_bathroom(A):
    lid = _mk_line(A, f"T{RUN}-BATH", "TEST_Bath fittings", quantity_mode="PER_BATHROOM", unit_id=S["units"].get("nos") or list(S["units"].values())[0])
    S["lb"] = lid
    for c in S["pkg"]:
        _opt(A, lid, c, "500")
    r = p(A, "/r/bathroom_rules", {"template_id": S["tid"], "name": f"TEST_BR {RUN}", "line_item_id": lid, "input_key": "total_bathrooms", "quantity_per_bathroom": "3"})
    assert r.status_code == 200, r.text
    S["br"] = r.json()["id"]
    l = line(sim(A, {"total_floors": 4, "total_bathrooms": 5}), f"T{RUN}-BATH")
    assert float(l["quantity"]) == 15 and l["amount"] == "7500.00", l


# --- Calculation rule test runner
def test_07_rule_test(A):
    expr = {"op": "mul", "args": [{"ref": "input.total_floors"}, {"const": "1290"}]}
    r = p(A, f"/templates/{S['tid']}/rules/test", {"expression": expr, "test_cases": [{"inputs": {"total_floors": 3}, "expected": "3870"},
                                                                                     {"inputs": {"total_floors": 2}, "expected": "1"}]})
    assert r.status_code == 200, r.text
    d = r.json()
    print("rule test:", d)
    assert not d["errors"] and d["explanation"]
    assert d["results"][0]["passed"] is True and d["results"][1]["passed"] is False
    bad = p(A, f"/templates/{S['tid']}/rules/test", {"expression": {"op": "__import__", "args": []}}).json()
    assert bad["errors"]


# --- Unit mismatch + unpriced
def test_08_unit_mismatch_unpriced(A):
    u = list(S["units"].values())
    mis_unit = S["units"].get("cft") or u[-1]
    lid = _mk_line(A, f"T{RUN}-UM", "TEST_Unit mismatch")
    S["lum"] = lid
    S["oum"] = _opt(A, lid, "TYPE_B", "5", unit_id=mis_unit)
    lid2 = _mk_line(A, f"T{RUN}-UP", "TEST_Unpriced")
    S["lup"] = lid2
    res = sim(A, {"total_floors": 4, "total_bathrooms": 2})
    codes = {(i["code"], i.get("line_item_id")) for i in res["issues"] if i["severity"] == "critical"}
    assert ("UNIT_MISMATCH", lid) in codes, res["issues"][:5]
    assert ("UNPRICED", lid2) in codes
    assert line(res, f"T{RUN}-UP")["status"] == "UNPRICED"
    # clean up the deliberately broken items so the template can publish
    assert p(A, f"/r/line_items/{lid}/archive").status_code == 200
    assert p(A, f"/r/line_items/{lid2}/archive").status_code == 200


# --- Publish, estimate lifecycle, recalculation
def test_09_publish_and_estimate(A):
    r = p(A, f"/templates/{S['tid']}/publish", {"notes": f"TEST_ {RUN}"})
    assert r.status_code == 200, r.text
    again = p(A, f"/templates/{S['tid']}/publish", {"notes": "TEST_ no change"})
    S["republish_status"] = again.status_code
    print("republish without change ->", again.status_code, again.text[:120])
    r = p(A, "/estimates", {"template_id": S["tid"], "client_name": f"TEST_Client {RUN}", "project_name": "TEST_Project"})
    assert r.status_code == 200, r.text
    e = r.json()
    S["eid"] = e["id"]
    d = g(A, f"/estimates/{e['id']}").json()
    gt1 = d["revision"]["result"]["totals"]["grand_total"]
    assert all("trace" in l for l in d["revision"]["result"]["lines"])
    r = requests.put(f"{API}/estimates/{e['id']}/config", headers=A, json={"inputs": {**e["inputs"], "total_floors": 5}}, timeout=60)
    assert r.status_code == 200, r.text
    assert r.json()["result"]["totals"]["grand_total"] != gt1
    r = requests.put(f"{API}/estimates/{e['id']}/config", headers=A, json={"inputs": {**e["inputs"], "total_floors": 4}, "package_id": S["pkg"]["TYPE_B"]}, timeout=60)
    assert r.json()["result"]["critical_count"] == 0, [i for i in r.json()["result"]["issues"] if i["severity"] == "critical"]


# --- Share link & portal privacy
FORBIDDEN = ("internal_cost", "internal_notes", "VERIFY UNIT", "SECRET_NOTE")


def test_10_share_portal_privacy(A):
    r = p(A, f"/estimates/{S['eid']}/share-links", {"expires_in_days": 7})
    assert r.status_code == 200 and r.json()["token"]
    S["token"], S["link_id"] = r.json()["token"], r.json()["id"]
    v = requests.get(f"{API}/portal/s/{S['token']}", timeout=60)
    assert v.status_code == 200, v.text
    for f in FORBIDDEN:
        assert f not in v.text, f"portal leaks {f}"
    d = v.json()
    assert d["permissions"]["editable"] and len(d["package_totals"]) >= 4
    c = requests.put(f"{API}/portal/s/{S['token']}/config", json={"inputs": {"total_floors": 3}}, timeout=60)
    assert c.status_code == 200 and not any(f in c.text for f in FORBIDDEN)
    for fmt in ("pdf", "xlsx", "csv"):
        x = requests.get(f"{API}/portal/s/{S['token']}/exports/{fmt}", timeout=60)
        assert x.status_code == 200 and len(x.content) > 200, (fmt, x.status_code)
        if fmt == "csv":
            txt = x.content.decode("utf-8-sig")
            for f in FORBIDDEN:
                assert f not in txt
            rows = list(csv.reader(io.StringIO(txt)))
            assert not any(cell[:1] in "=+-@" and cell for row in rows for cell in row), "unescaped formula cell"
            assert any(cell.startswith("'=HYPERLINK") for row in rows for cell in row)
    requests.put(f"{API}/portal/s/{S['token']}/config", json={"inputs": {"total_floors": 4}}, timeout=60)


# --- Issue, immutability after republish, revision 2
def test_11_issue_and_revision(A):
    r = p(A, f"/estimates/{S['eid']}/transition", {"action": "issue"})
    assert r.status_code == 200, r.text
    before = g(A, f"/estimates/{S['eid']}").json()["revision"]["result"]["totals"]
    csv_before = requests.get(f"{API}/estimates/{S['eid']}/exports/csv", headers=A, timeout=60).content
    opt = next(o for o in g(A, "/r/package_options", params={"line_item_id": S["l1"]}).json() if o["package_id"] == S["pkg"]["TYPE_B"])
    assert pa(A, f"/r/package_options/{opt['id']}", {"rate": "999"}).status_code == 200
    assert p(A, f"/templates/{S['tid']}/publish", {"notes": f"TEST_ rate change {RUN}"}).status_code == 200
    blocked = requests.put(f"{API}/estimates/{S['eid']}/config", headers=A, json={"inputs": {"total_floors": 6}}, timeout=60)
    assert blocked.status_code == 409
    after = g(A, f"/estimates/{S['eid']}").json()["revision"]["result"]["totals"]
    assert after == before
    csv_after = requests.get(f"{API}/estimates/{S['eid']}/exports/csv", headers=A, timeout=60).content
    assert csv_before.split(b"\n")[2:] == csv_after.split(b"\n")[2:] or csv_before == csv_after
    rv = p(A, f"/estimates/{S['eid']}/transition", {"action": "revise"})
    assert rv.status_code == 200 and rv.json()["revision_number"] == 2
    # issued export still available from portal
    x = requests.get(f"{API}/portal/s/{S['token']}/exports/pdf", params={"issued": "true"}, timeout=60)
    assert x.status_code == 200


# --- Tenant isolation
def test_12_tenant_isolation(A, B):
    assert g(B, f"/estimates/{S['eid']}").status_code == 404
    assert g(B, f"/r/sections/{S['sec']}").status_code == 404
    assert pa(B, f"/r/sections/{S['sec']}", {"name": "hack"}).status_code == 404
    assert g(B, f"/estimates/{S['eid']}/exports/csv").status_code == 404
    assert requests.get(f"{API}/estimates", timeout=30).status_code == 401


# --- Revoked link, error logs, client user access
def test_13_revoke_and_client(A):
    assert p(A, f"/estimates/{S['eid']}/share-links/{S['link_id']}/revoke").status_code == 200
    assert requests.get(f"{API}/portal/s/{S['token']}", timeout=30).status_code == 404
    assert g(A, "/error-logs").status_code == 200
    email, pw = f"test_client_{RUN.lower()}@example.com", "TestClient@2026"
    r = p(A, "/org/users", {"email": email, "name": f"TEST_Client {RUN}", "role": "client", "password": pw})
    assert r.status_code == 200, r.text
    assert p(A, f"/estimates/{S['eid']}/clients", {"email": email}).status_code == 200
    C = login(email, pw)
    mine = g(C, "/client/estimates").json()
    assert any(m["id"] == S["eid"] for m in mine)
    pv = g(C, f"/portal/e/{S['eid']}")
    assert pv.status_code == 200 and not any(f in pv.text for f in FORBIDDEN)
    assert g(C, "/r/sections").status_code in (401, 403)
    assert g(C, "/estimates").status_code in (401, 403)


# --- Cleanup: archive everything this run created
def test_99_cleanup(A):
    for res, key in (("bathroom_rules", "br"), ("foundation_rules", "fr"), ("packages", "pkgD"), ("subsections", "plumb_sub"), ("sections", "sec")):
        if S.get(key):
            assert p(A, f"/r/{res}/{S[key]}/archive").status_code == 200
    print("republish-no-change status:", S.get("republish_status"))
