# ArchEngine — Construction Cost Engine (V4)

Multi-tenant, admin-configurable construction estimate engine for architect firms. Architects configure the catalogue, packages, units, rates and calculation rules. Clients answer a short building brief (total floors, total bathrooms), pick a package, adjust the options they are allowed to change, and download a branded estimate (PDF / XLSX / CSV).

> Clients never enter room dimensions, wall lengths or floor plans. Floor-count rules are costing mappings, **not** structural design.

## Stack
| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + Tailwind (hand-built components, lucide icons) |
| Backend | FastAPI (modular monolith) + Motor |
| Database | MongoDB with versioned migrations (see `DECISIONS.md` D-001/D-002) |
| Engine | Pure Python, Decimal-only, JSON expression-tree DSL (no eval) |
| Documents | ReportLab (PDF), openpyxl (XLSX), csv (UTF-8, injection-safe) |

## Repository layout
```
backend/
  server.py              app wiring, error handlers, startup migrations
  app/core/              config, db, JWT auth, permissions, tenant scoping, audit, rate limit, error logging
  app/engine/            dsl.py · calculator.py · validation.py
  app/modules/           catalogue (generic CRUD) · templates · estimates (lifecycle, portal, exports) · identity
  app/exports/render.py  client-safe PDF/XLSX/CSV
  app/migrations/        runner.py · seed.py · quotation_seed.py (source PDF transcription)
  tests/                 test_engine.py · test_api_security.py
frontend/src/            components/ · layouts/ · pages/admin/* · pages/client/*
docs/CODEMAP.md          compact dependency map
scripts/                 backup.sh · restore.sh
```

## Setup (local)
```bash
cd backend && cp .env.example .env && pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload     # migrations + seed run on startup
cd frontend && cp .env.example .env && yarn install && yarn start   # http://localhost:3000
```

## Tests
```bash
cd backend && python -m pytest -q tests   # engine + tenant isolation / privacy / immutability (server running)
cd frontend && yarn build                 # build gate
```

## Seed accounts
Set in `backend/.env` (`SUPERADMIN_*`, `ARCHITECT_*`). Change them before production. `SEED_TENANT_B=true` adds a second tenant for isolation tests.

## Key flows
1. **Templates → Validate → Publish** freezes an immutable, hashed version snapshot.
2. **Client Estimates → New** pins the latest published version. Edits recalculate the DRAFT revision on the server.
3. **Submit → Approve → Issue** freezes the revision. **New revision** creates rev n+1, optionally on the latest catalogue.
4. Clients open the estimate by **share link** (random, hashed, expiring, revocable) or by **client login**.

More: `DECISIONS.md`, `DEPLOYMENT.md`, `BACKUP_RESTORE.md`.
