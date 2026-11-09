"""API-level security tests against the running server (tenant isolation, privacy, immutability, share links)."""
import os

import httpx
import pytest

API = os.environ.get("TEST_API_URL", "http://localhost:8001/api")
ARCH = ("architect@studioeleven.in", "Studioeleven@2026")
TENB = ("admin@tenantb-demo.com", "TenantB@2026")


def login(email, pw):
    r = httpx.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def a():
    return login(*ARCH)


@pytest.fixture(scope="module")
def b():
    return login(*TENB)


@pytest.fixture(scope="module")
def estimate(a):
    tpl = httpx.get(f"{API}/r/templates", headers=a).json()[0]
    httpx.post(f"{API}/templates/{tpl['id']}/publish", headers=a, json={"notes": "test"}, timeout=60)
    r = httpx.post(f"{API}/estimates", headers=a, json={"template_id": tpl["id"], "client_name": "Test"}, timeout=60)
    assert r.status_code == 200, r.text
    return r.json()


def test_unauthenticated_rejected():
    assert httpx.get(f"{API}/r/sections").status_code == 401


def test_tenant_b_cannot_read_tenant_a(a, b, estimate):
    sec = httpx.get(f"{API}/r/sections", headers=a).json()[0]
    assert httpx.get(f"{API}/r/sections/{sec['id']}", headers=b).status_code == 404
    assert httpx.get(f"{API}/estimates/{estimate['id']}", headers=b).status_code == 404
    assert all(s["id"] != sec["id"] for s in httpx.get(f"{API}/r/sections", headers=b).json())
    assert httpx.patch(f"{API}/r/sections/{sec['id']}", headers=b, json={"name": "hacked"}).status_code == 404


def test_cross_tenant_reference_blocked(a, b):
    tpl_a = httpx.get(f"{API}/r/templates", headers=a).json()[0]
    r = httpx.post(f"{API}/r/sections", headers=b, json={"template_id": tpl_a["id"], "name": "X"})
    assert r.status_code == 400


def test_client_payload_totals_ignored_and_privacy(a, estimate):
    r = httpx.put(f"{API}/estimates/{estimate['id']}/config", headers=a, json={"inputs": {"total_floors": "4"}, "totals": {"grand_total": "1"}}, timeout=60)
    assert r.status_code == 200 and r.json()["result"]["totals"]["grand_total"] != "1"
    link = httpx.post(f"{API}/estimates/{estimate['id']}/share-links", headers=a, json={"expires_in_days": 2}).json()
    view = httpx.get(f"{API}/portal/s/{link['token']}").text
    assert "internal_cost" not in view and "internal_notes" not in view and "VERIFY UNIT" not in view
    csv = httpx.get(f"{API}/portal/s/{link['token']}/exports/csv").text
    assert "VERIFY UNIT" not in csv
    httpx.post(f"{API}/estimates/{estimate['id']}/share-links/{link['id']}/revoke", headers=a)
    assert httpx.get(f"{API}/portal/s/{link['token']}").status_code == 404
    assert httpx.get(f"{API}/portal/s/not-a-real-token").status_code == 404


def test_issued_revision_immutable(a, estimate):
    eid = estimate["id"]
    r = httpx.post(f"{API}/estimates/{eid}/transition", headers=a, json={"action": "issue"}, timeout=60)
    assert r.status_code == 200, r.text
    before = httpx.get(f"{API}/estimates/{eid}", headers=a).json()["revision"]
    pdf1 = httpx.get(f"{API}/estimates/{eid}/exports/csv", headers=a).content
    line = httpx.get(f"{API}/r/package_options", headers=a, params={"line_item_id": before["result"]["lines"][1]["line_item_id"]}).json()[0]
    httpx.patch(f"{API}/r/package_options/{line['id']}", headers=a, json={"rate": "99999"})
    assert httpx.put(f"{API}/estimates/{eid}/config", headers=a, json={"inputs": {"total_floors": "4"}}).status_code == 409
    after = httpx.get(f"{API}/estimates/{eid}", headers=a).json()["revision"]
    assert after["result"]["totals"] == before["result"]["totals"]
    assert httpx.get(f"{API}/estimates/{eid}/exports/csv", headers=a).content == pdf1
    httpx.patch(f"{API}/r/package_options/{line['id']}", headers=a, json={"rate": line["rate"]})


def test_no_room_dimension_inputs(a):
    tpl = httpx.get(f"{API}/r/templates", headers=a).json()[0]
    keys = {i["key"] for i in httpx.get(f"{API}/r/inputs", headers=a, params={"template_id": tpl["id"]}).json()}
    assert not any(w in k for k in keys for w in ("length", "width", "dimension", "room_area", "plan"))
