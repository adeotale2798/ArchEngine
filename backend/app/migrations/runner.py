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


MIGRATIONS = [("0001_indexes", m0001_indexes), ("0002_platform_seed", m0002_platform_seed),
              ("0003_quotation_import", m0003_quotation_import), ("0004_tenant_b", m0004_tenant_b)]


async def run_migrations():
    done = {m["id"] async for m in db.schema_migrations.find({}, {"id": 1})}
    for mid, fn in MIGRATIONS:
        if mid in done:
            continue
        log.info("applying migration %s", mid)
        await fn()
        await db.schema_migrations.insert_one({"id": mid, "applied_at": now()})
