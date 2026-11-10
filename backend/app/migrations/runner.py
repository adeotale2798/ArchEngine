"""Versioned, idempotent migrations recorded in the `schema_migrations` collection (D-002)."""
import logging
import os

from pymongo import ASCENDING

from app.core.db import db, now
from app.migrations.quotation_seed import seed_quotation
from app.migrations.seed import create_org, ensure_membership, ensure_user

log = logging.getLogger("archengine.migrations")
TENANT_COLLS = ["estimate_templates", "sections", "subsections", "line_items", "packages", "package_options", "input_definitions",
                "calculation_rules", "foundation_rule_sets", "slab_rule_sets", "bathroom_rule_sets", "unit_definitions", "unit_conversions",
                "rate_cards", "rate_card_items", "estimate_instances", "estimate_revisions", "estimate_share_links", "estimate_exports",
                "estimate_approvals", "template_versions", "audit_events", "import_logs"]


async def m0001_indexes():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.organisations.create_index("id", unique=True)
    await db.memberships.create_index([("organisation_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
    for c in TENANT_COLLS:
        await db[c].create_index([("organisation_id", ASCENDING), ("id", ASCENDING)], unique=True)
    for c in ["sections", "subsections", "line_items", "packages", "package_options", "input_definitions", "calculation_rules"]:
        await db[c].create_index([("organisation_id", ASCENDING), ("template_id", ASCENDING), ("status", ASCENDING)])
    await db.template_versions.create_index([("organisation_id", ASCENDING), ("template_id", ASCENDING), ("version", ASCENDING)], unique=True)
    await db.estimate_revisions.create_index([("estimate_id", ASCENDING), ("revision_number", ASCENDING)], unique=True)
    await db.estimate_share_links.create_index("token_hash", unique=True)
    await db.audit_events.create_index([("organisation_id", ASCENDING), ("created_at", ASCENDING)])
    await db.audit_events.create_index("entity_id")
    await db.error_logs.create_index([("organisation_id", ASCENDING), ("created_at", ASCENDING)])
    await db.login_attempts.create_index("key", unique=True)


async def m0002_platform_seed():
    sa = await ensure_user(os.environ["SUPERADMIN_EMAIL"].lower(), os.environ["SUPERADMIN_PASSWORD"], "Platform Super Admin", super_admin=True)
    org = await create_org("Studioeleven", os.environ["ARCHITECT_EMAIL"].lower(), os.environ["ARCHITECT_PASSWORD"], "Studioeleven Architect",
                           branding={"tagline": "architects & interior designers", "email": os.environ["ARCHITECT_EMAIL"].lower(),
                                     "primary_color": "#C2562B"}, slug="studioeleven")
    await ensure_membership(org["id"], sa, "org_admin")


async def m0003_quotation_import():
    org = await db.organisations.find_one({"slug": "studioeleven"})
    units = {u["code"]: u["id"] async for u in db.unit_definitions.find({"organisation_id": org["id"]})}
    await seed_quotation(org["id"], units, org.get("id"))


async def m0004_tenant_b():
    if os.environ.get("SEED_TENANT_B", "false").lower() == "true":
        await create_org("Demo Tenant B Architects", "admin@tenantb-demo.com", "TenantB@2026", "Tenant B Admin", slug="tenant-b")


async def m0005_enable_specification_comparison():
    template = await db.estimate_templates.find_one({"source_file": "Quotation Of Aniket Deotale ji sir (1).pdf"}, {"_id": 0, "id": 1})
    if template:
        await db.line_items.update_many(
            {"template_id": template["id"], "code": {"$regex": r"^SPEC-"}, "status": "active"},
            {"$set": {"client_can_change_option": True}},
        )


async def m0006_align_quotation_floor_default():
    template = await db.estimate_templates.find_one(
        {"source_file": "Quotation Of Aniket Deotale ji sir (1).pdf"}, {"_id": 0, "id": 1}
    )
    if not template:
        return
    floor_input = await db.input_definitions.find_one(
        {"template_id": template["id"], "key": "total_floors", "status": "active"}, {"_id": 0, "id": 1, "default_value": 1}
    )
    if not floor_input or str(floor_input.get("default_value")) != "3":
        return
    foundation = await db.foundation_rule_sets.find_one(
        {"template_id": template["id"], "line_item_id": {"$exists": True}, "status": "active"}, {"_id": 0, "bands": 1}
    )
    has_g_plus_3_band = any(
        str(band.get("min_floors")) == "4" and str(band.get("max_floors")) == "4"
        for band in (foundation or {}).get("bands", [])
    )
    if has_g_plus_3_band:
        await db.input_definitions.update_one(
            {"id": floor_input["id"]}, {"$set": {"default_value": "4", "updated_at": now()}}
        )


async def m0007_enable_turnkey_price_comparison():
    template = await db.estimate_templates.find_one(
        {"source_file": "Quotation Of Aniket Deotale ji sir (1).pdf"}, {"_id": 0, "id": 1}
    )
    if template:
        await db.line_items.update_many(
            {"template_id": template["id"], "code": {"$regex": r"^(SPEC|FIN)-"}, "status": "active"},
            {"$set": {"client_can_change_option": True}},
        )


MIGRATIONS = [("0001_indexes", m0001_indexes), ("0002_platform_seed", m0002_platform_seed),
              ("0003_quotation_import", m0003_quotation_import), ("0004_tenant_b", m0004_tenant_b),
              ("0005_enable_specification_comparison", m0005_enable_specification_comparison),
              ("0006_align_quotation_floor_default", m0006_align_quotation_floor_default),
              ("0007_enable_turnkey_price_comparison", m0007_enable_turnkey_price_comparison)]


async def run_migrations():
    done = {m["id"] async for m in db.schema_migrations.find({}, {"id": 1})}
    for mid, fn in MIGRATIONS:
        if mid in done:
            continue
        log.info("applying migration %s", mid)
        await fn()
        await db.schema_migrations.insert_one({"id": mid, "applied_at": now()})
