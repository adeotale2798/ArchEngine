# Test credentials

| Role | Email | Password | Notes |
|---|---|---|---|
| Platform super admin (+ org_admin of Terrain) | superadmin@archengine.app | SuperAdmin@2026 | from backend/.env SUPERADMIN_* |
| Architect / Org admin (Terrain Design Studio) | architect@terraindstudio.com | Architect@2026 | from backend/.env ARCHITECT_* |
| Tenant B org admin (isolation tests) | admin@tenantb-demo.com | TenantB@2026 | separate organisation, SEED_TENANT_B=true |

Client users: create via Admin → Users & Settings → Add user (role Client), then grant on an estimate. Share links need no login.
