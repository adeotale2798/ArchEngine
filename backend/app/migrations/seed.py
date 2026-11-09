"""Reusable seed helpers (idempotent)."""
from app.core.db import db, new_id, now
from app.core.security import hash_password

UNITS = [("mm", "Millimetre", "length"), ("cm", "Centimetre", "length"), ("m", "Metre", "length"), ("ft", "Foot", "length"),
         ("in", "Inch", "length"), ("rft", "Running foot", "length"), ("sft", "Square foot", "area"), ("sqm", "Square metre", "area"),
         ("sqyd", "Square yard", "area"), ("cft", "Cubic foot", "volume"), ("cum", "Cubic metre", "volume"), ("L", "Litre", "volume"),
         ("g", "Gram", "weight"), ("kg", "Kilogram", "weight"), ("t", "Tonne", "weight"), ("Nos", "Numbers", "count"),
         ("pcs", "Pieces", "count"), ("set", "Sets", "count"), ("pair", "Pairs", "count"), ("hr", "Hour", "time"), ("day", "Day", "time"),
         ("shift", "Shift", "time"), ("bag", "Bag", "trade"), ("roll", "Roll", "trade"), ("sheet", "Sheet", "trade"),
         ("bundle", "Bundle", "trade"), ("brass", "Brass", "trade"), ("guntha", "Guntha", "trade"), ("LS", "Lump sum", "lump_sum"),
         ("job", "Job", "lump_sum"), ("lot", "Lot", "lump_sum")]
# Only exact/standard mathematical conversions. Trade units (bag, brass...) are org-defined: D-009.
CONVERSIONS = [("sqm", "sft", "10.7639104"), ("m", "ft", "3.280839895"), ("ft", "in", "12"), ("cum", "cft", "35.3146667"),
               ("cum", "L", "1000"), ("t", "kg", "1000"), ("sqyd", "sft", "9")]

DEFAULT_SETTINGS = {
    "currency": "INR", "currency_symbol": "₹", "rounding": {"decimals": 2, "mode": "line_half_up"},
    "tax": {"enabled": True, "label": "GST", "rate": "18", "note": "Verify the applicable GST rate for your contract type."},
    "contingency": {"enabled": False, "rate": ""}, "export_formats": ["pdf", "xlsx", "csv"], "estimate_validity_days": 30,
    "require_approval_before_issue": False, "terms": "",
    "disclaimer": ("This is an indicative cost estimate based on the building-level inputs provided and the organisation's configured "
                   "rates and rules. It is not a structural design, a structural adequacy certificate or a final measured BOQ. "
                   "Foundation and structural specifications must be designed and approved by the architect/structural engineer "
                   "based on site and geotechnical conditions."),
}


def doc(org_id, **kw):
    return {"id": new_id(), "organisation_id": org_id, "status": "active", "created_at": now(), "updated_at": now(), **kw}


async def ensure_user(email, password, name, super_admin=False):
    u = await db.users.find_one({"email": email})
    if u:
        return u["id"]
    uid = new_id()
    await db.users.insert_one({"id": uid, "email": email, "name": name, "password_hash": hash_password(password), "active": True,
                               "is_super_admin": super_admin, "must_change_password": False, "created_at": now()})
    return uid


async def ensure_membership(org_id, user_id, role):
    if not await db.memberships.find_one({"organisation_id": org_id, "user_id": user_id}):
        await db.memberships.insert_one({"id": new_id(), "organisation_id": org_id, "user_id": user_id, "role": role, "active": True, "created_at": now()})


async def seed_units(org_id):
    ids = {}
    for code, name, dim in UNITS:
        u = await db.unit_definitions.find_one({"organisation_id": org_id, "code": code})
        if not u:
            u = doc(org_id, code=code, name=name, dimension=dim, sort_order=len(ids) * 10)
            await db.unit_definitions.insert_one(dict(u))
        ids[code] = u["id"]
    for f, t, factor in CONVERSIONS:
        if not await db.unit_conversions.find_one({"organisation_id": org_id, "from_unit_id": ids[f], "to_unit_id": ids[t]}):
            await db.unit_conversions.insert_one(doc(org_id, from_unit_id=ids[f], to_unit_id=ids[t], factor=factor, note="Standard conversion"))
    return ids


async def create_org(name, admin_email, admin_password, admin_name, branding=None, slug=None):
    org = await db.organisations.find_one({"name": name})
    if not org:
        org = {"id": new_id(), "name": name, "slug": slug or name.lower().replace(" ", "-"), "branding": branding or {},
               "settings": DEFAULT_SETTINGS, "created_at": now()}
        await db.organisations.insert_one(dict(org))
    uid = await ensure_user(admin_email, admin_password, admin_name)
    await ensure_membership(org["id"], uid, "org_admin")
    await seed_units(org["id"])
    return {"id": org["id"], "name": name, "admin_user_id": uid}
