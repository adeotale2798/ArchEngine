# Architecture Decision Log

Each entry: decision · why · consequence. Newest last. Add a new entry instead of editing old ones.

**D-001 MongoDB instead of PostgreSQL.** The hosting platform provisions MongoDB and the spec allows "equivalent". Every tenant-owned document carries `organisation_id`, compound unique indexes `(organisation_id, id)` exist on every collection, and all queries pass through `deps.tenant()`. Consequence: relational FKs are enforced in the service layer (`catalogue._check_refs`). The data model mirrors the spec's tables 1:1 so a later Postgres port is mechanical.

**D-002 Versioned migrations in code.** `app/migrations/runner.py` applies ordered, idempotent migrations and records them in `schema_migrations`. Seeds are migrations too, so a fresh database is reproducible.

**D-003 Draft working copy + immutable published snapshots.** Admins edit live documents (the draft). Publishing serialises the whole template configuration (sections, items, packages, options, inputs, rules, bands, units, conversions, rate-card items, org tax settings) into `template_versions.snapshot_json` with a SHA-256 hash. Estimates pin a version id. Why: simplest model that guarantees "issued estimates never change after catalogue edits" without per-row version tables. Trade-off: snapshot size grows with catalogue size (fine for thousands of rows).

**D-004 Revisions.** Only the current DRAFT revision is mutable. Issue stores `content_hash`, `valid_until`, issuer; later issued revisions mark older ones SUPERSEDED. Re-downloads render from the stored revision result (PDF is generated with `invariant=1` so bytes are reproducible).

**D-005 Safe formula DSL.** Formulas are JSON trees (`const`, `ref`, add/sub/mul/div/min/max/round/ceil/floor, comparisons, if, lookup bands). Validation limits nodes (200) and depth (20); refs may only be `input.<key>` or `item.<code>`. Nothing is evaluated as code. Item references form a dependency graph; cycles are reported with the path and block publishing.

**D-006 Engine is a pure function.** `calculate(snapshot, inputs, package, overrides, manual)` has no I/O, which makes it deterministic, unit-testable and reusable for the admin simulator, client portal and publish validation.

**D-007 Decimal everywhere.** Money and quantities are parsed with `Decimal(str(x))`, stored as strings, rounded ROUND_HALF_UP to 2 dp per line; totals are sums of rounded lines. Tax is computed on (subtotal + contingency); both are separate rows, never hidden in rates.

**D-008 Construction rules as dedicated rule sets.** Quantity modes `FLOOR_BAND_LOOKUP`, `PER_FLOOR`, `PER_BATHROOM` resolve through foundation/slab/bathroom rule documents bound to a line item. Bands are inclusive-inclusive; overlaps = critical, gaps = warning, out-of-range floors = critical "architect review". Rules never claim structural adequacy.

**D-009 Units.** Only exact mathematical conversions are seeded. Trade units (bag, brass, guntha…) have none until an org defines them. A rate unit that differs from the quantity unit without a conversion blocks the line (UNIT_MISMATCH).

**D-010 Client privacy by whitelist.** `calculator.client_view()` projects an explicit list of client-safe fields. Internal cost, internal notes, traces and hidden rates never leave the server through portal APIs or exports; renderers only receive the client view.

**D-011 Own JWT auth instead of a managed provider.** The spec requires a low-cost self-hostable path and a tenant/membership model with a seeded super admin. bcrypt(12) hashes, 12h HS256 bearer tokens (no cookies → no CSRF surface), per-IP+email lockout after 5 failures, in-process sliding-window rate limits for login/share/export. For multi-instance deployments move limits to Redis.

**D-012 Source quotation import.** `quotation_seed.py` transcribes the Aniket Deotale PDF exactly. Arithmetic mismatches (e.g. Type A water tank 21 000 vs 10 000 × 21, Only-Civil totals) are preserved in `import_logs.flags` and surfaced on Overview; the engine computes quantity × rate. Units are copied from the printed "(sft)" header and flagged where implausible. Missing items (Sr. 45–46, Only-Civil specifications, bathroom quantities, GST rate) are flagged, never invented. The template stays **unpublished** until the architect verifies it.

**D-013 Quotation modelling.** Printed rows "First/Second/Third Floor Roof" (1290 sft each) became one PER_FLOOR line (floors − 1) so floor count drives it; Ground Floor Roof and Terrace slab stay fixed rows; Plinth Level is the floor-band (foundation) item with one band (4 floors = the source G+3 case) marked "requires review". Default input: 4 floors reproduces the printed Type B total ₹1,35,22,000 exactly.

**D-014 Super admin provision only.** A platform super admin exists (seeded from env) with `POST /api/platform/organisations`; the platform UI is deferred by request. The super admin is also org_admin of the seed organisation.

**D-015 Generic catalogue CRUD.** One tenant-scoped router (`/api/r/{resource}`) with Pydantic schemas per resource provides list/search/create/update/archive/restore/duplicate/reorder/history for all catalogue entities. One code path = one security model, fewer tokens and fewer bugs. Records are archived, never deleted.

**D-016 Error logging.** Unhandled backend exceptions and browser errors (window.onerror, React error boundary) are stored in `error_logs` with request ids and shown in Admin → Error Logs.

**D-017 Frontend.** Vite + React + Tailwind with a small hand-written component kit (design tokens in `index.css`): Outfit headings, IBM Plex Sans/Mono for data. Admin = dense "blueprint" sidebar; client = editorial wizard with imagery and a sticky cost dock. The same `EstimateWizard` powers the client portal and the admin Preview Simulator, so the preview is exactly what clients see.

**D-018 Code map instead of an external graph tool.** Rather than adding a runtime dependency, `docs/CODEMAP.md` holds a compact module/dependency graph (the intent of Graphify) so future work can navigate the repo cheaply.
