# ArchEngine — Construction Cost Engine (V4)

Multi-tenant, admin-configurable construction estimate engine for architect firms. Architects configure the catalogue, packages, units, rates and calculation rules. Clients answer a short building brief (total floors, total bathrooms), pick a package, compare the package variants side-by-side, adjust the options they are allowed to change, and download a branded estimate (PDF / XLSX / CSV).

> Clients never enter room dimensions, wall lengths or floor plans. Floor-count rules are costing mappings, not structural design.

## Quick start

### 1) Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### 2) Frontend
```bash
cd frontend
npm install
npm run start
```

Open the app at http://localhost:5173 (Vite will display the exact port if it changes).

## Full environment setup

### MongoDB connection
ArchEngine reads the database from `backend/.env`:

```env
DB_NAME=archengine_local
MONGO_URL=mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority
```

The repository includes a working local example in `backend/.env`, and a template in `backend/.env.example` for new machines.

To confirm the connection is healthy:

```bash
cd backend
.venv\Scripts\python.exe -c "from pymongo import MongoClient; c = MongoClient('mongodb+srv://<username>:<password>@<cluster>/<database>?retryWrites=true&w=majority'); print(c.admin.command('ping'))"
```

If you want to test the configured app instance directly:

```bash
cd backend
.venv\Scripts\python.exe -c "from app.core.db import db; print(db.name); print(db.list_collection_names()[:10])"
```

## Local setup notes

- Use `.env` only inside `backend/` for the Mongo connection and app secrets.
- Frontend loads from Vite environment variables only when required; the default local dev server works without extra config for most flows.
- If MongoDB is not reachable, start by checking the Atlas URI, username, password and network access.
- Migrations and seed data run automatically when the backend starts.

## Run checks

```bash
cd backend
.venv\Scripts\python.exe -m pytest -q tests

cd ../frontend
npm run build
```

## Stack
| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite + Tailwind |
| Backend | FastAPI + Motor |
| Database | MongoDB with versioned migrations |
| Engine | Python Decimal-only DSL |
| Documents | ReportLab, openpyxl, CSV export |

## Repository layout
```text
backend/
  server.py              app wiring, startup migrations, router assembly
  app/core/              config, db, security, auth, permissions, audit
  app/engine/            calculators, DSL validation, rule interpreter
  app/modules/           catalogue, estimates, templates, identity, exports
  app/migrations/        runner.py, seed.py, quotation_seed.py
  tests/                 api security and engine regression tests
frontend/src/           React pages, components, app shell, hooks, API helpers
scripts/                backup.sh, restore.sh
docs/                   architecture notes and source documents
```

## Key flows
1. Templates are validated and published as locked catalogue versions.
2. Client estimates pin the latest published version and recalculate draft revisions on update.
3. Submit, approve and issue steps freeze the estimate revision and trigger rev n+1 rules.
4. Clients receive a share link or login-based estimate view for package comparison and download.

More: `DECISIONS.md`, `DEPLOYMENT.md`, `BACKUP_RESTORE.md`.
