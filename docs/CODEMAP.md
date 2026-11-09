# Code map (compact dependency graph)

```
frontend ──HTTP /api──► backend/server.py
  App.jsx ─ routes ─► layouts/AdminShell ─► pages/admin/*        (auth: lib/auth.jsx, data: lib/hooks.jsx → /api/r/*)
                    └► pages/client/ClientEstimate ─► components/EstimateWizard  (also used by pages/admin/Simulator)
  components/CrudTable → ResourceForm → /api/r/{resource}       (generic list/edit/archive/duplicate/history)
  components/RulePreview → /api/templates/{id}/simulate          (before/after comparison)

backend/server.py
  ├─ modules/identity.py   /auth, /org, /org/users, /overview, /audit, /error-logs, /platform
  ├─ modules/catalogue.py  /r/{resource}  ← modules/schemas.py (RESOURCES registry)
  ├─ modules/templates.py  /templates/{id}/validate|publish|versions|simulate|rules/test|import|export.csv
  │     build_snapshot() ──► engine/validation.py ──► engine/calculator.py ──► engine/dsl.py
  └─ modules/estimates.py  /estimates*, /portal/{s|e}/{ref}*, /client/estimates
        version_snapshot() → engine/calculator.calculate / client_view → exports/render.py (pdf|xlsx|csv)
core/: deps.tenant() (ALL tenant queries) · permissions.ROLES · audit.audit() · errors middleware · ratelimit · security
migrations/runner.py → seed.py (orgs, units) → quotation_seed.py (source PDF transcription)
```

Collections: organisations, users, memberships, estimate_templates, template_versions, sections, subsections, line_items, packages,
package_options, input_definitions, calculation_rules, foundation_rule_sets, slab_rule_sets, bathroom_rule_sets, unit_definitions,
unit_conversions, rate_cards, rate_card_items, estimate_instances, estimate_revisions, estimate_approvals, estimate_share_links,
estimate_exports, audit_events, error_logs, import_logs, login_attempts, counters, schema_migrations.
