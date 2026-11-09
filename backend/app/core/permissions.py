CAPABILITIES = [
    "catalogue.view", "catalogue.manage", "rates.view_internal", "rules.publish",
    "estimate.view", "estimate.create", "estimate.approve", "estimate.issue", "estimate.download",
    "audit.view", "org.manage", "users.manage",
]

ROLES = {
    "org_admin": {"label": "Organisation Admin / Architect", "caps": set(CAPABILITIES)},
    "architect": {"label": "Architect / Estimator", "caps": {
        "catalogue.view", "catalogue.manage", "rates.view_internal", "rules.publish", "estimate.view",
        "estimate.create", "estimate.issue", "estimate.approve", "estimate.download", "audit.view"}},
    "reviewer": {"label": "Reviewer / Approver", "caps": {
        "catalogue.view", "rates.view_internal", "estimate.view", "estimate.approve", "estimate.download", "audit.view"}},
    "client": {"label": "Client", "caps": set()},
}
