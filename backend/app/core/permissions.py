CAPABILITIES = [
    "overview.view",
    "templates.view",
    "simulator.view",
    "gov_estimator.view",
    "catalogue.view",
    "catalogue.manage",
    "sections.manage",
    "line_items.manage",
    "packages.manage",
    "rules.publish",
    "foundation_rules.manage",
    "slab_rules.manage",
    "bathroom_rules.manage",
    "pricing.view",
    "units.manage",
    "rate_cards.manage",
    "estimate.view",
    "estimate.create",
    "estimate.approve",
    "estimate.issue",
    "estimate.download",
    "audit.view",
    "org.manage",
    "users.manage",
]

CAPABILITY_GROUPS = {
    "Workspace": ["overview.view", "templates.view", "simulator.view", "gov_estimator.view"],
    "Catalogue": ["catalogue.view", "catalogue.manage", "sections.manage", "line_items.manage", "packages.manage"],
    "Rules": ["rules.publish", "foundation_rules.manage", "slab_rules.manage", "bathroom_rules.manage"],
    "Pricing": ["pricing.view", "units.manage", "rate_cards.manage"],
    "Estimates": ["estimate.view", "estimate.create", "estimate.approve", "estimate.issue", "estimate.download"],
    "Governance": ["audit.view", "org.manage", "users.manage"],
}

ROLES = {
    "org_admin": {"label": "Organisation Admin / Architect", "caps": set(CAPABILITIES)},
    "architect": {"label": "Architect / Estimator", "caps": {
        "overview.view", "templates.view", "simulator.view", "gov_estimator.view",
        "catalogue.view", "catalogue.manage", "sections.manage", "line_items.manage", "packages.manage",
        "rules.publish", "foundation_rules.manage", "slab_rules.manage", "bathroom_rules.manage",
        "pricing.view", "units.manage", "rate_cards.manage",
        "estimate.view", "estimate.create", "estimate.approve", "estimate.issue", "estimate.download",
        "audit.view"}},
    "reviewer": {"label": "Reviewer / Approver", "caps": {
        "overview.view", "templates.view", "simulator.view",
        "catalogue.view", "pricing.view", "estimate.view", "estimate.approve", "estimate.download", "audit.view"}},
    "client": {"label": "Client", "caps": {"overview.view", "templates.view", "simulator.view"}},
}


def custom_role_caps(org_settings: dict | None) -> dict[str, set[str]]:
    result = {}
    for entry in ((org_settings or {}).get("custom_roles") or []):
        key = str(entry.get("key") or entry.get("slug") or entry.get("name", "")).strip()
        if not key:
            continue
        result[key] = {str(cap) for cap in entry.get("capabilities", []) if cap}
    return result
