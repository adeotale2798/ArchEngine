# Construction Cost Engine — Master Architecture & Product Specification (V4)

**Purpose:** Authoritative product, architecture, data, calculation, security, UX and acceptance specification for building the application in Emergent.

**Version:** 4.0  
**Date:** 9 November 2026  
**Currency default:** INR (organisation-configurable)  
**Primary deployment target:** Low-cost hosted web application with a clean path to self-hosting/local deployment  
**Status:** Build specification — all rates, quantities, engineering rules and source quotation values must be configured/verified by the organisation's architect/admin.

---

# 0. Read this first — authoritative scope

This V4 supersedes earlier drafts wherever they conflict. Build the product as a **multi-organisation, admin-configurable construction estimate and specification platform**.

It is not a generic construction project-management suite, and it is not a room-by-room measurement or CAD takeoff application.

## 0.1 What the client enters

The client answers a short, admin-configurable building brief. The initial required inputs are:

- Total number of floors / storeys in the proposed building.
- Total number of bathrooms.
- Package selection (Type A, Type B, Type C, and any future package enabled by the organisation).
- Any other building-level input explicitly enabled by the architect/admin for that estimate template.

The client does **not** enter room dimensions, wall lengths, ceiling heights, window dimensions, floor plans, slab drawings or other room-by-room measurements.

The client can then review configured sections, select/change only permitted specifications, see the estimate update, save the configuration and download the estimate.

## 0.2 What the architect/admin configures

The organisation's architect/admin owns the construction knowledge and calculation model:

- Sections, subsections and line items.
- Package definitions and package-specific specification options.
- Units and rate denominators.
- Rates and rate-card versions.
- Building input definitions (for example floor count and bathroom count).
- Formula rules and quantity drivers.
- Floor-count-based foundation specification/rate selection.
- Per-floor slab quantity rules.
- Per-bathroom quantity rules for bathroom-related items.
- Inclusion/exclusion, optionality and client-edit permissions.
- Valid ranges, thresholds, assumptions, notes and warnings.
- Client-facing estimate layout and export settings.

**The application must never invent structural design, foundation dimensions, reinforcement, concrete grades, quantities, rates, wastage or engineering assumptions.** It executes rules that the authorised architect/admin explicitly configures and approves. A floor-count rule is a cost-estimation selection rule, not an engineering design calculation or substitute for structural design.

## 0.3 Core architecture principle

Use a metadata-driven catalogue and a versioned calculation engine. Do not hard-code Type A/B/C, Plumbing, Civil Work, Foundation, Slab, Bathroom, units, formula names or floor thresholds in the frontend or backend. Admins must be able to add and configure them through the UI.

---

# 1. Product goals and non-goals

## 1.1 Goals

1. Let an organisation create and maintain reusable construction estimate templates.
2. Let admins manage all sections, subsections, line items, package options, units, rates and formulas without developer intervention.
3. Let clients provide only the building-level inputs required by the selected template.
4. Calculate quantity and cost using transparent, versioned rules.
5. Make the effect of each client selection/input visible.
6. Generate a professional, downloadable estimate with clear assumptions and exclusions.
7. Preserve issued estimates exactly as they were when generated.
8. Support multiple architect firms/organisations without data leakage.
9. Support future additions through configuration first, code only for genuinely new calculation capabilities.
10. Keep the application maintainable, secure, testable, exportable and deployable at low cost.

## 1.2 Non-goals for this release

Do not build:
- CAD, BIM, drawing upload takeoff or geometry extraction.
- Room-by-room measurement forms.
- Contractor/vendor management, procurement or purchase orders.
- Inventory, labour attendance, payroll or site progress tracking.
- Accounting ledger, payment collection or bank integrations.
- CRM, marketing automation or messaging platform.
- Structural engineering design, reinforcement design or code-compliance certification.
- AI-generated quantities or unverified AI engineering recommendations.

Keep extension points for later, but do not implement these modules now.

---

# 2. User roles, organisation model and permissions

## 2.1 Multi-tenant organisation model

The platform must support multiple independent architect firms/organisations. Each organisation owns its own:
- Templates, sections, subsections and line items.
- Package types and package options.
- Building input definitions and calculation rules.
- Units, conversions, rate cards and rates.
- Estimate documents, revisions, users, branding and settings.

Every tenant-owned record must include `organisation_id`. Enforce tenant isolation in backend queries and authorization policies, not only in the UI.

A platform-level Super Admin may manage organisations and platform settings. A tenant's data must never be visible to another tenant.

## 2.2 Roles

| Role | Main permissions |
|---|---|
| Platform Super Admin | Platform and organisation administration; support access only under controlled audit |
| Organisation Owner/Admin | Full organisation catalogue, formulas, rates, users, branding, publishing and estimate access |
| Architect / Estimator | Create estimates, configure project inputs, review calculations, override permitted values, issue estimates if authorised |
| Reviewer / Approver | Review, comment, approve or return estimates; no catalogue editing unless separately granted |
| Client | Access only estimates explicitly shared with them; enter enabled brief inputs; select permitted packages/options; download permitted documents |

Permissions must be capability-based as well as role-based where useful. Example capabilities: `catalogue.manage`, `rates.view_internal`, `rules.publish`, `estimate.create`, `estimate.issue`, `estimate.download`, `estimate.client_configure`.

## 2.3 Client visibility controls

For every line item and every field, admin can configure:
- Visible to client / internal only.
- Client can change specification / read-only.
- Client can change quantity / read-only.
- Show unit rate / hide unit rate / show only line total.
- Mandatory / optional / excluded.
- Show explanatory note / hide internal note.

Never expose internal cost, margin, supplier cost, internal commentary, draft rate history or admin-only assumptions through client APIs, HTML, exports or browser payloads.

---

# 3. End-to-end workflows

## 3.1 Admin setup workflow

1. Create organisation and users.
2. Create estimate template (e.g. Residential Building Estimate).
3. Define building brief inputs (floors, bathrooms and any additional inputs).
4. Create sections and optional subsections.
5. Create line items under sections/subsections.
6. Configure units and rate denominators.
7. Define packages (Type A/B/C or any future names).
8. Configure package-specific specifications, inclusions and rates.
9. Attach quantity drivers and calculation rules to applicable line items.
10. Configure floor-count foundation selection and slab quantity rules.
11. Configure bathroom-driven quantity rules.
12. Validate rules, missing rates, incompatible units and overlapping thresholds.
13. Preview a sample estimate using test inputs.
14. Publish a versioned template/catalogue.
15. Share a client estimate link or create a client access invitation.

## 3.2 Client workflow

1. Open secure estimate link or sign in.
2. Read project/estimate introduction and scope.
3. Enter total floors and total bathrooms (and only other enabled inputs).
4. Select an available package.
5. See sections, subsections, specifications and included/excluded items.
6. Change only options explicitly marked client-editable.
7. See a clear before/after comparison and updated costs.
8. Review assumptions, exclusions, warnings and validity period.
9. Save a configuration (if enabled).
10. Download PDF, Excel and/or CSV as permitted.
11. Request a revised estimate if changes require architect review.

## 3.3 Architect review and issue workflow

Draft → Calculated → Validation → Review (optional) → Approved → Issued → Superseded/Expired.

Do not permit an estimate with unresolved critical calculation errors to be issued. Warnings may be allowed only if policy permits and are displayed in the document.

---

# 4. Building brief inputs — configurable, not hard-coded

## 4.1 Initial required fields

| Input key | Label | Type | Validation | Used by |
|---|---|---|---|---|
| `total_floors` | Total number of floors | Integer | Positive; configurable min/max; clarify whether ground floor is included | Foundation selection, slab count, floor-driven items |
| `total_bathrooms` | Total number of bathrooms | Integer | Zero or positive; configurable maximum | Bathroom fixtures, plumbing points and bathroom finishes |

The template must define the meaning of "floor" clearly. For example, does the count include stilt, basement, ground floor, terrace floor or only occupied storeys? Do not assume. Display the organisation's configured help text next to the field.

## 4.2 Future input types

Admins may add inputs through a form:
- Integer, decimal, yes/no, single select, multi-select, date, text (limited use).
- Units for numeric inputs.
- Required/optional, min/max, default, validation, help text.
- Visibility to client, editable by client, internal-only.
- Dependencies and conditional visibility.
- Whether input changes trigger recalculation or require architect review.

Possible future examples: basement count, parking levels, lift count, building use, terrace treatment, water tank capacity, number of kitchens, number of kitchens/utility areas. These are examples only; do not add them as mandatory inputs without the organisation configuring them.

## 4.3 Input snapshots

Every estimate stores the exact input values used for that calculation. Changing an input creates a new calculation revision; it must not silently alter an issued estimate.

---

# 5. Catalogue architecture

Use a flexible hierarchy:

`Organisation → Estimate Template → Section → Subsection (optional) → Line Item Definition → Package Option(s)`

A line item may be directly under a section or under a subsection.

## 5.1 Example sections

Illustrative only; the actual catalogue must come from the organisation's quotation and admin configuration:
- Site preparation
- Foundation and plinth
- RCC / structural work
- Floor slabs
- Masonry
- Plumbing and sanitary
- Electrical
- Flooring
- Doors and windows
- Plastering
- Painting and finishing
- Waterproofing
- Water storage / tank
- External development

Do not create invented rates or source specifications. Seed only verified quotation data or clearly marked empty starter templates.

## 5.2 Admin actions

For every hierarchy level, admins can:
- Add, edit, duplicate, reorder, move, archive and restore.
- Add subsections and nested line items.
- Set display name, code, description, notes and sort order.
- Set active/draft/archived status.
- Set client visibility and edit permissions.
- Set mandatory/optional/excluded status.
- Attach package options, units, rates and quantity rules.
- Preview client presentation.
- View audit history and who changed/published the record.

Do not permanently delete records referenced by an estimate. Use archive/soft-delete and preserve historical snapshots.

## 5.3 Line item definition fields

Minimum fields:
- Stable ID and organisation ID.
- Template ID, section ID, optional subsection ID.
- Internal code, client label, description.
- Category/trade tag (admin-defined).
- Default unit and quantity mode.
- Quantity driver/rule reference.
- Inclusion status and optionality.
- Package applicability.
- Client visibility and editability.
- Internal notes and client notes.
- Sort order, status, created/updated by and timestamps.
- Version and effective dates.

---

# 6. Package and specification engine

Packages are data records, not code branches. Type A/B/C are initial package examples only.

Each package can define, for each line item:
- Selected specification/option.
- Specification description and attributes.
- Inclusion status.
- Unit (if package-specific).
- Quantity rule override (only if explicitly allowed).
- Rate or rate-card reference.
- Client can change option? yes/no.
- Client can change quantity? yes/no.
- Client-visible price mode.
- Notes, exclusions and warranty/brand fields if relevant.

Admins can add Package D, Premium, Economy or any future package from the UI. A package may inherit shared defaults and override individual line items. Store inheritance explicitly and resolve it deterministically; show the resolved value in admin preview.

A client override must be stored separately from the original package default. Provide Reset to package default per line item and Reset all options.

---

# 7. Calculation engine — configurable, transparent and safe

## 7.1 Design

Build a deterministic, server-side calculation service. Do not execute arbitrary JavaScript, Python, SQL or user-provided code from admin-entered formulas.

Use a controlled formula DSL / expression tree with a whitelist of operations:
- Numeric constants and references to approved input keys.
- Addition, subtraction, multiplication, division.
- Min, max, round, ceil, floor.
- Comparisons and conditional `if/else`.
- Lookup tables / threshold bands.
- Count and sum over explicitly defined collections.
- Unit conversion only through configured conversion records.

No eval, Function constructor, arbitrary code execution or database query injection.

Every formula must be:
- Named and versioned.
- Bound to an approved input/line-item/rule.
- Validated for missing references, circular dependencies and invalid units.
- Testable with admin-entered sample inputs.
- Explainable in human-readable terms.
- Stored as a versioned immutable snapshot when an estimate is calculated/issued.

## 7.2 Calculation dependency graph

Calculate in dependency order:
1. Validate building brief inputs.
2. Resolve selected package and client overrides.
3. Resolve conditional inclusion and specification options.
4. Resolve floor-count rules (foundation category and floor-dependent items).
5. Resolve bathroom-driven quantities.
6. Resolve per-floor slab quantities.
7. Resolve other line-item quantities.
8. Resolve rates and unit conversions.
9. Calculate line totals.
10. Roll up subsection totals, section totals and estimate totals.
11. Apply configured adjustments, taxes and contingency separately.
12. Validate totals and produce calculation trace.

Reject circular dependencies and report the dependency path in admin validation.

## 7.3 Supported quantity modes

Each line item chooses one:
- `FIXED_QUANTITY`: admin-configured quantity.
- `INPUT_MULTIPLIER`: quantity = selected input × configured factor.
- `PER_FLOOR`: quantity = total floors × configured quantity per floor.
- `PER_BATHROOM`: quantity = total bathrooms × configured quantity per bathroom.
- `FLOOR_BAND_LOOKUP`: quantity/specification/rate resolved from a configured floor-count band.
- `LOOKUP_TABLE`: quantity/rate/specification resolved by an admin-defined table.
- `LUMP_SUM`: fixed amount, no quantity multiplication.
- `MANUAL_INTERNAL`: authorised architect/estimator enters quantity.
- `CLIENT_MANUAL`: only when explicitly enabled for that line item; not the default.
- `COMPOSITE`: controlled sum of child quantities/rules.

The admin UI may present friendly labels, but persist stable enum keys and rule references.

## 7.4 Foundation cost based on total floors

This is a critical feature.

The admin configures a **Foundation Rule Set** for a template or project type. The rule set can use floor-count bands or a lookup matrix, for example:
- 1–3 floors → architect-approved foundation package option/rule.
- 4–5 floors → architect-approved foundation package option/rule.
- 6–8 floors → architect-approved foundation package option/rule.
- 9+ floors → architect-approved foundation package option/rule.

These bands are examples only. Do not seed these values as engineering truth. The architect must define the actual ranges, specifications, quantities and rates for their building typology and structural design basis.

For each band, admin can configure:
- Minimum and maximum floor count (inclusive/exclusive clearly defined).
- Applicable foundation line items.
- Package/specification option selected.
- Quantity rule and unit.
- Rate or rate-card item.
- Client-visible explanation.
- Internal engineering reference/approval note.
- Effective date and version.
- Whether architect review is mandatory.

Validation requirements:
- No overlapping bands unless priority is explicitly configured.
- No gaps in a required floor-count range.
- All required band rows have valid specification, unit, quantity rule and rate.
- Out-of-range floor count blocks final calculation and requests architect review.
- A change in total floors recalculates dependent foundation items and displays the cost impact.

**Safety:** The application is not to calculate structural adequacy from floor count alone. Floor count is a configured estimation driver. Actual foundation design depends on structural design and site/geotechnical conditions. The app must not state that a foundation is structurally sufficient or compliant. Display a clear note that the architect/structural engineer must approve the applicable foundation specification.

## 7.5 Per-floor slab calculation and units

Slab-related line items must use the units selected by the architect/admin. Typical possible units include:
- Number of slabs (`Nos`) when counting slab levels.
- Area (`sq ft`, `sq m`) when the approved estimate uses area.
- Volume (`cu ft`, `cu m`) when a verified volume is explicitly configured.
- Lump sum (`LS`) where the source quotation is lump-sum.

The admin must choose the correct unit and configure the quantity basis. Supported examples:
- Slab count = configured slab count per floor × applicable floor count.
- Slab area = configured/approved area per floor × applicable floor count.
- Slab lump sum = configured cost per floor × applicable floor count.

Do not assume slab area equals building floor count. If no footprint/area is collected from the client, the app can only use an admin-configured standard area, fixed quantity, or lump-sum basis. Label such quantities as template assumptions / indicative quantities. Do not present them as measured actual area.

Admin can define whether the ground floor, terrace slab, stilt, basement or roof slab is included in the count. Support explicit exclusions and special slab rows (e.g. terrace slab) as separately configured items.

## 7.6 Bathroom-driven calculation

For bathroom-driven line items, use:
`Quantity = total_bathrooms × configured_quantity_per_bathroom`

Examples that an admin may configure:
- Sanitary fixture sets per bathroom.
- Plumbing points per bathroom.
- Waterproofing allowance per bathroom (if priced on a configured per-bathroom basis).
- Bathroom tile/finish package (only if the admin has a defensible fixed or template quantity).

Do not assume every bathroom has the same number of fixtures or identical layout. Admin may configure bathroom types (e.g. standard/premium) or per-bathroom option groups later. For V1, a single bathroom count is sufficient unless the quotation requires more detail. If one bathroom count is not enough to represent the actual scope, make the additional input optional and admin-configurable.

## 7.7 Rates and pricing

Support:
- Shared rate across packages.
- Package-specific rate.
- Line-item-specific rate.
- Rate-card version and effective dates.
- Internal cost and client selling rate as separate fields where needed.
- Optional margin/markup only if enabled and permission-controlled.
- Tax treatment configurable by organisation and estimate template.
- Wastage/overhead/contingency only as explicit separate rules.

Base line calculation:
- Quantity-based: `line_total = normalized_quantity × unit_rate`.
- Lump sum: `line_total = configured_lump_sum`.
- Optional: included only when selected.
- Excluded: not included in totals.
- Unpriced: flagged; do not silently calculate as zero and call complete.

Use decimal-safe arithmetic (e.g. decimal type / fixed precision), never binary floating point for monetary totals. Define rounding policy at organisation level and apply consistently. Store raw calculation precision and rounded display values.

## 7.8 Contingency and taxes

Contingency is a separate configurable allowance, not a hidden line-item markup. If enabled, show:
- Base estimate subtotal.
- Tax/fees (if configured).
- Contingency percentage and amount.
- Final indicative budget.

Default may be 10% only if the organisation chooses it. It must be editable and may be disabled. Do not double count contingency, tax, overhead or margin. The estimate document must explain the basis.

---

# 8. Units and conversions

Admin-managed unit catalogue supports:
- Length: mm, cm, m, ft, in, running ft.
- Area: sq ft, sq m, sq yd.
- Volume: cu ft, cu m, litre.
- Weight: g, kg, tonne.
- Count: Nos, pieces, sets, pairs.
- Time: hour, day, shift.
- Trade-specific: bag, roll, sheet, bundle, brass, guntha and custom units.
- Lump sum: LS, job, lot.

Store unit dimension/category and conversion factor only when conversion is valid. Trade-specific conversions must be organisation-defined; do not assume that a bag, brass, bundle or local trade unit has a universal conversion.

A rate's denominator unit must match the line item's quantity unit or be linked by an explicit conversion. Block incompatible unit combinations.

---

# 9. Estimate calculation result and explainability

Every calculated estimate must retain:
- Input values and their units.
- Selected package and option overrides.
- Catalogue/template/package/rate-card versions.
- Formula/rule versions.
- Resolved quantity and unit for each line item.
- Rate and rate source.
- Line total and roll-up totals.
- Inclusion/exclusion status.
- Warnings, assumptions and validation results.
- Calculation timestamp and engine version.

For each line item, provide a human-readable trace, e.g.:
`Bathrooms: 4 × configured 1 set per bathroom = 4 sets`
or
`Floors: 5 × configured 1 slab per floor = 5 Nos`

For foundation:
`Total floors: 7 → matched architect-configured band [configured band label] → selected [configured specification]`.
Do not show an invented band or engineering claim.

Admin can inspect full calculation details. Client sees a simplified explanation appropriate to their permissions.

---

# 10. Estimate document and download system

The end client must be able to download a professional estimate. This is a mandatory feature, not a later enhancement.

## 10.1 Required download formats

- PDF: primary client-facing document, branded and print-ready.
- Excel (`.xlsx`): structured estimate with sections, line items, quantities, units, rates (only if client-visible), line totals and summary.
- CSV: flat line-item export for spreadsheet import.
- Optional JSON export for organisation backup/integration (admin only).

## 10.2 PDF content

The PDF should include:
1. Organisation logo, name, address and contact details.
2. Estimate title, unique estimate number, issue date and validity date.
3. Client name/contact only if collected and permitted.
4. Project name/address only if collected and permitted.
5. Building brief: total floors, total bathrooms and other enabled inputs.
6. Selected package and package description.
7. Executive cost summary.
8. Section/subsection-wise BOQ.
9. Line item description/specification, quantity, unit, rate (if client-visible), amount.
10. Optional/excluded items clearly marked.
11. Assumptions and calculation notes.
12. Scope inclusions and exclusions.
13. Taxes/fees and contingency shown separately.
14. Grand total / indicative budget.
15. Estimate validity, payment/commercial terms if configured.
16. Architect approval/signature area if enabled.
17. Disclaimer that it is an estimate, not a structural design certificate or final measured BOQ, where applicable.

Do not put internal cost, margins, private notes or hidden rates in the client PDF.

## 10.3 Excel workbook

Recommended sheets:
- `Estimate Summary`
- `Detailed BOQ`
- `Specifications`
- `Assumptions & Exclusions`

Include formulas only where safe and useful; the server-calculated values remain authoritative. Clearly label exported figures as a snapshot. Hide no sensitive values in hidden sheets—never export them in the first place.

## 10.4 CSV

CSV should contain one row per estimate line item, with columns such as:
`estimate_number, section, subsection, item_code, item_name, specification, quantity, unit, unit_rate, amount, inclusion_status, package, notes`.

Only include rate columns if the client is authorised to see rates. CSV encoding must support Indian names and currency characters (UTF-8). Protect against spreadsheet formula injection by escaping cells beginning with `=`, `+`, `-`, or `@`.

## 10.5 Secure download behaviour

- Client can download only their own estimate via authenticated access or a signed, expiring share link.
- Share tokens must be random, revocable, scoped to one estimate and rate-limited.
- Never use sequential IDs as download authorization.
- PDF/XLSX/CSV generation happens server-side from a validated immutable estimate snapshot.
- Log export event, actor, format, timestamp and estimate revision.
- Re-downloading an issued revision must return the same snapshot content, unless the user explicitly requests a new revision.
- Allow admin to revoke client access and regenerate a new share link.
- Provide clear download buttons on the client estimate page and a download history for authorised users.

---

# 11. Admin interface — required screens

## 11.1 Main navigation

- Overview
- Estimate Templates
- Building Inputs
- Sections & Subsections
- Line Item Catalogue
- Package Manager
- Calculation Rules
- Foundation Rules
- Slab Rules
- Bathroom Rules
- Units & Conversions
- Rate Cards
- Estimate Documents
- Client Estimates
- Versions & Audit Log
- Organisation Settings
- Users & Permissions

## 11.2 Overview dashboard

Show:
- Active templates, sections, line items and packages.
- Draft/published catalogue versions.
- Missing rates and invalid rules.
- Estimates awaiting review.
- Recently issued estimates.
- Quick actions: add section, add line item, add package, create formula, create estimate.

## 11.3 Catalogue editor

Use a left-side hierarchy tree and right-side detail editor. Allow search, filters, drag/reorder, add, duplicate, archive and restore. A line item editor has tabs:
- General
- Package specifications
- Quantity & calculation
- Units
- Rates
- Client visibility
- Notes & exclusions
- History

## 11.4 Formula/rule builder

Use a guided form, not a raw code editor. Admin chooses:
- Rule name and purpose.
- Input/line-item dependencies.
- Quantity mode.
- Unit.
- Formula builder or lookup-table editor.
- Effective version.
- Sample test cases.
- Client explanation.
- Review requirement.

Show a plain-language preview and calculated output for test values. Display errors for missing inputs, invalid units, circular dependencies and overlapping bands.

## 11.5 Foundation rule editor

Dedicated matrix/table:
- Floor count from/to.
- Selected foundation specification.
- Applicable line items.
- Quantity mode and unit.
- Rate card/rate.
- Client note.
- Internal approval reference.
- Effective dates and status.

Include a warning: rules are estimation mappings and do not certify structural adequacy.

## 11.6 Slab rule editor

Admin chooses:
- Which floor types are included.
- Number of slabs per floor.
- Unit: Nos / area / volume / lump sum.
- Quantity per floor or approved template quantity.
- Whether special slabs (terrace/roof/basement) are separate.
- Rate denominator and rate.
- Client-facing explanation.

## 11.7 Bathroom rule editor

Admin maps bathroom count to applicable items and configured quantities per bathroom. Support optional bathroom type groups in future without forcing that complexity into the first client workflow.

## 11.8 Client preview

Admin can enter sample floors/bathrooms, select package, change options and preview exactly what the client sees—including totals and download document.

---

# 12. Client interface — required screens

1. Welcome / estimate introduction.
2. Building brief (floors, bathrooms and enabled questions).
3. Package selection.
4. Estimate configuration with section navigation.
5. Specification comparison and reset.
6. Estimate summary and assumptions.
7. Save/share/download.
8. Download confirmation / revision details.

Keep the client UI responsive, accessible and simple. Do not expose admin navigation, raw formula details, internal notes or hidden pricing.

Show an item-level cost change when a specification changes. Use clear states: Included, Optional, Excluded, Requires review, Unpriced, and Not applicable.

---

# 13. Data model — logical entities

Use relational storage (PostgreSQL recommended for hosted multi-tenant production; SQLite may be acceptable for a single-organisation local prototype only if migration path is preserved). Use migrations and stable IDs. Do not store the whole application as one unstructured JSON blob.

Core tables/entities:

## Organisation and identity
- `organisations`
- `users`
- `memberships`
- `roles`
- `permissions`
- `role_permissions`
- `audit_events`

## Catalogue and templates
- `estimate_templates`
- `template_versions`
- `sections`
- `subsections`
- `line_item_definitions`
- `line_item_versions`
- `package_types`
- `package_versions`
- `package_line_item_options`
- `package_option_versions`

## Building inputs and rules
- `input_definitions`
- `input_definition_versions`
- `calculation_rules`
- `calculation_rule_versions`
- `calculation_rule_inputs`
- `calculation_rule_dependencies`
- `foundation_rule_sets`
- `foundation_rule_bands`
- `slab_rule_sets`
- `bathroom_rule_sets`
- `rule_test_cases`

## Units and rates
- `unit_definitions`
- `unit_conversions`
- `rate_cards`
- `rate_card_versions`
- `rate_card_items`

## Estimates
- `estimate_instances`
- `estimate_input_values`
- `estimate_revisions`
- `estimate_line_items`
- `estimate_calculation_traces`
- `estimate_validation_issues`
- `estimate_approvals`
- `estimate_share_links`
- `estimate_exports`

Use foreign keys, unique constraints, indexes, created/updated timestamps and actor IDs. Apply tenant scoping consistently.

## 13.1 Snapshot strategy

An issued estimate must snapshot all resolved values needed to reproduce it:
- Template/catalogue/package/rate/rule version IDs.
- Input values.
- Resolved specifications.
- Quantities, units, rates, totals and adjustments.
- Client-visible notes and disclaimers.
- Document layout/version.

Never recompute an old issued estimate using today's catalogue or today's rate card. A new catalogue publication affects only new estimates or explicitly revised drafts.

---

# 14. API and service architecture

Use a modular monolith for V1. Avoid microservices until there is a demonstrated scale need.

Suggested modules:
- Identity & organisation
- Catalogue
- Packages
- Building inputs
- Rules/calculation
- Units
- Rates
- Estimates/revisions
- Documents/exports
- Sharing
- Audit

Suggested API groups (names illustrative; Emergent may use its framework conventions):
- `/auth/*`
- `/organisations/*`
- `/templates/*`
- `/catalogue/sections/*`
- `/catalogue/line-items/*`
- `/packages/*`
- `/inputs/*`
- `/rules/*`
- `/units/*`
- `/rate-cards/*`
- `/estimates/*`
- `/estimates/{id}/calculate`
- `/estimates/{id}/validate`
- `/estimates/{id}/issue`
- `/estimates/{id}/exports/{format}`
- `/estimates/{id}/share-links`

All write APIs validate permissions, tenant ownership, input schemas and referential integrity. The client must never submit a final total that the backend trusts; the server recalculates all totals.

---

# 15. Technical architecture and engineering standards

## 15.1 Recommended stack

Emergent should use its strongest supported stable stack, but preserve these architectural requirements:
- Frontend: modern responsive React/Next.js or Emergent's supported equivalent.
- Backend: typed API/service layer.
- Database: PostgreSQL for hosted multi-tenant deployment; SQLite only for local prototype/single-user development where appropriate.
- ORM/migrations: Prisma, Drizzle or equivalent with migration files.
- Authentication: secure session/token implementation with role and tenant checks.
- Document generation: server-side PDF, XLSX and CSV libraries.
- File storage: private object storage or protected local storage; never public-by-default.
- Tests: unit, integration, authorization and end-to-end tests.
- Version control: Git from the first commit.

Do not add unnecessary infrastructure such as Kubernetes, microservices, message brokers or paid services without a clear requirement.

## 15.2 Code structure

Organise by domain/module rather than dumping all logic into page components. Keep:
- UI components separate from domain calculations.
- Calculation engine independent from React/UI.
- Database access behind repositories/services.
- Validation schemas shared where safe.
- Export rendering separate from calculation logic.
- Tests beside or mapped to domain modules.
- Configuration and secrets in environment variables.

## 15.3 Quality requirements

- Type safety and runtime validation.
- Centralised error handling.
- Structured logs with request/estimate IDs.
- No secrets committed to Git.
- No production database credentials in frontend bundles.
- Database backups and documented restore process.
- Accessibility: keyboard navigation, labels, contrast, readable tables.
- Responsive layout for desktop, tablet and mobile.
- Pagination/search for large catalogues.
- Optimistic UI only when rollback/error handling is correct.
- No silent calculation failures.

---

# 16. Validation, audit and versioning

## 16.1 Rule validation

Before publishing, validate:
- All required package options exist.
- All included priced items have valid rates.
- Quantity rule has required inputs.
- Units are compatible.
- No circular dependencies.
- Foundation bands have no unintended gaps/overlaps.
- Floor/bathroom ranges are valid.
- Slab counting basis is explicit.
- No invalid negative quantities/rates unless explicitly permitted.
- All client-visible labels and notes exist where required.

## 16.2 Audit events

Record who changed what and when for:
- Rates.
- Package options.
- Formula rules.
- Foundation/slab/bathroom rule sets.
- Units/conversions.
- Template publication.
- Estimate inputs, overrides, approvals and issuance.
- Client downloads/share access.

Audit log must be append-only for normal users. Corrections are new events, not edits to historical audit records.

## 16.3 Versioning

Use draft/published states. Publishing creates an immutable version. Issued estimates point to exact versions. Admin changes create a new draft/version; they do not mutate published historical snapshots.

---

# 17. Security and privacy

Mandatory:
- Tenant isolation enforced server-side.
- Role/capability checks on every protected endpoint.
- Secure password/session handling.
- CSRF protection where relevant.
- Rate limiting on login, share links and exports.
- Expiring/revocable share tokens.
- Input validation and output encoding.
- Protection against formula injection in CSV/XLSX.
- No arbitrary formula code execution.
- No public access to private generated documents.
- Audit export/download activity.
- Backup/restore documentation.
- Data deletion/export policy for organisation admins.
- Avoid collecting personal/client data that is not required.

---

# 18. Import, export and portability

Admin must be able to:
- Export catalogue and rate cards to CSV/XLSX.
- Import catalogue rows using a validated template.
- Preview import changes before commit.
- Detect duplicate codes, missing units and invalid rates.
- Choose whether import creates new records or updates matching stable codes.
- Download estimate PDFs/XLSX/CSV.
- Export organisation data in a documented format for backup/migration.

Never silently overwrite published catalogue versions during import. Import into a draft and validate before publishing.

---

# 19. Acceptance tests — release gate

## Catalogue and admin
1. Admin creates a new section without code changes.
2. Admin creates a subsection under Plumbing and adds a line item.
3. Admin creates Package D without code changes.
4. Admin configures different package specifications and rates.
5. Admin configures unit, quantity mode, visibility and client edit permission.
6. Admin duplicates, reorders and archives catalogue entries.
7. Admin publishes a new version while historical estimates remain unchanged.

## Building inputs and calculations
8. Client enters total floors and total bathrooms.
9. Admin configures floor-count bands for foundation.
10. Changing floors from a lower band to a higher configured band selects the correct admin-defined foundation option and recalculates affected costs.
11. The UI explains which configured rule was applied.
12. The system never claims structural adequacy based only on floor count.
13. Admin configures slab count/area/volume/lump-sum calculation per floor.
14. Changing total floors recalculates slab quantities according to the explicit slab rule.
15. If no slab footprint/area is available, the estimate labels configured per-floor area as an assumption or uses the configured count/lump sum; it does not pretend to measure actual area.
16. Admin configures bathroom-driven line items.
17. Changing bathroom count recalculates applicable items.
18. Missing inputs, rates or invalid units produce clear warnings/errors and block issue when critical.
19. Circular dependencies are detected and rejected.
20. No arbitrary executable formula can be entered or run.

## Client experience and downloads
21. Client cannot enter room dimensions or upload floor plans in V1.
22. Client can change only permitted specification options.
23. Client can reset one option and all options.
24. Client sees updated estimate totals and assumptions.
25. Client can download PDF, XLSX and CSV where enabled.
26. Export excludes all internal-only rates, margins and notes.
27. Share links are scoped, expiring and revocable.
28. Issued estimate downloads reproduce the same historical snapshot.

## Security and reliability
29. Tenant A cannot access Tenant B records through UI or direct API calls.
30. Client cannot access another client's estimate by changing an ID.
31. Server recalculates totals; client-submitted totals are ignored.
32. CSV formula injection is neutralised.
33. Audit records capture rate/rule edits and exports.
34. Database backup and restore are documented and tested.

---

# 20. Implementation sequence — build in controlled phases

Do not attempt every feature in one giant generation pass. Build in phases while maintaining the final architecture.

**Phase 1 — Foundation**
- Repo, environment, database schema/migrations, authentication, organisation tenancy, roles.
- Responsive app shell and navigation.
- Audit event foundation.

**Phase 2 — Catalogue administration**
- Templates, sections, subsections, line items.
- Units, packages, package options and rates.
- Search, reorder, duplicate, archive, import/export draft.

**Phase 3 — Building inputs and rule engine**
- Configurable input definitions.
- Safe formula DSL.
- Quantity modes and dependency graph.
- Rule tests and validation.

**Phase 4 — Special construction rules**
- Floor-count foundation matrix.
- Per-floor slab rules.
- Per-bathroom rules.
- Admin test simulator and calculation trace.

**Phase 5 — Client configuration**
- Building brief.
- Package selection.
- Specification overrides and reset.
- Recalculation and client summary.

**Phase 6 — Estimate lifecycle and documents**
- Revisions, review, approval, issue.
- PDF, XLSX and CSV generation.
- Secure downloads and share links.

**Phase 7 — Hardening**
- Tenant/security tests.
- Calculation regression tests.
- Backup/restore.
- Accessibility, responsive polish, performance and deployment docs.

At the end of each phase, run tests and provide a concise implementation report. Do not skip acceptance tests.

---

# 21. Seed data and source quotation rules

Use the user's supplied quotation as the source of initial catalogue data only after reading/transcribing it accurately. Preserve:
- Exact source wording.
- Exact package labels and specifications.
- Exact units and quantities as printed.
- Exact rates and totals as printed.
- Page/row reference or source note where possible.

If a printed arithmetic total does not match its quantity × rate, preserve the printed source value and flag the discrepancy for admin verification. Do not auto-correct it. Do not invent missing specifications, rates, units or quantities. Do not assume a source value applies to every floor, bathroom or building.

All example floor bands, formula factors, slab areas, bathroom fixture counts and rates in this document are architectural examples, not construction instructions or source quotation data. They must be configured and approved by the organisation.

---

# 22. Final instruction to Emergent

Build a production-minded, modular, multi-tenant, admin-configurable construction estimate application. The client provides total floors, total bathrooms and other explicitly enabled building-level inputs; the client does not enter room dimensions. The architect/admin configures the catalogue, packages, units, rates and all calculation rules.

The foundation rule must map total floor count to an architect-configured foundation specification/cost rule. Slab quantities must use an explicit admin-configured per-floor basis and correct unit. Bathroom-driven items must use admin-configured per-bathroom quantities. These are estimation rules only; never invent or certify structural design.

The end client must be able to review, save and download a branded PDF estimate and, where enabled, XLSX/CSV. Issued estimates must be immutable snapshots tied to exact catalogue/rule/rate versions.

Prioritise correctness, explainability, tenant security, editability, versioning, exports and maintainability over flashy features. Do not hard-code catalogue structures, package names, formula thresholds or rates. Do not add unrelated construction-management modules. Do not use fake rates or fake quotation data. Where information is missing, create an admin configuration field and mark the item incomplete rather than guessing.
