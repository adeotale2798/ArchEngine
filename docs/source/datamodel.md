# Data Model & Calculation Rules Reference — V4

This document supplements `01_Master_Architecture_V4.md`.

## 1. Core relationships

```text
Organisation
 ├── Users / Memberships / Roles
 ├── Estimate Templates
 │    ├── Template Versions
 │    ├── Building Input Definitions
 │    ├── Sections
 │    │    ├── Subsections
 │    │    └── Line Item Definitions
 │    ├── Package Types
 │    │    └── Package Line Item Options
 │    ├── Calculation Rule Sets
 │    │    ├── Foundation Rule Bands
 │    │    ├── Slab Rules
 │    │    └── Bathroom Rules
 │    ├── Unit Definitions / Conversions
 │    └── Rate Cards / Rate Card Items
 └── Estimate Instances
      ├── Input Values
      ├── Revisions
      ├── Resolved Estimate Line Items
      ├── Calculation Traces
      ├── Validation Issues
      ├── Approvals
      ├── Share Links
      └── Export Events
```

## 2. Suggested key fields

### `input_definitions`
- `id`, `organisation_id`, `template_id`, `key`, `label`, `input_type`
- `unit_id` nullable, `required`, `default_value`
- `min_value`, `max_value`, `validation_config`
- `help_text`, `client_visible`, `client_editable`
- `sort_order`, `status`, `version`

Unique: `(organisation_id, template_id, key)`.

### `line_item_definitions`
- `id`, `organisation_id`, `template_id`, `section_id`, `subsection_id`
- `code`, `name`, `description`, `default_unit_id`
- `quantity_mode`, `quantity_rule_id`
- `inclusion_default`, `client_visible`, `client_can_change_option`
- `client_can_change_quantity`, `client_price_visibility`
- `status`, `sort_order`, `version`

Unique item code within template/organisation, unless admin explicitly permits duplicates.

### `package_types`
- `id`, `organisation_id`, `template_id`, `code`, `name`, `description`
- `status`, `sort_order`, `version`

### `package_line_item_options`
- `id`, `package_id`, `line_item_id`, `specification_label`
- `specification_details`, `unit_id`, `quantity_rule_override_id`
- `rate_card_item_id`, `inclusion_status`, `client_editable`
- `sort_order`, `version`

### `calculation_rules`
- `id`, `organisation_id`, `template_id`, `name`, `purpose`
- `rule_type`, `expression_json`, `output_unit_id`
- `status`, `version`, `effective_from`, `effective_to`
- `client_explanation`, `internal_approval_note`

`expression_json` must represent a validated expression tree, not arbitrary source code.

### `foundation_rule_bands`
- `id`, `rule_set_id`, `min_floors`, `max_floors`
- `foundation_option_id`, `quantity_rule_id`, `rate_card_item_id`
- `client_explanation`, `internal_approval_reference`
- `requires_review`, `effective_from`, `effective_to`, `status`

Use an unambiguous interval convention, e.g. minimum inclusive and maximum inclusive. Prevent overlaps and gaps where coverage is required.

### `slab_rule_sets`
- `id`, `template_id`, `name`, `included_floor_types`
- `slabs_per_floor`, `quantity_basis`, `quantity_per_floor`
- `unit_id`, `rate_card_item_id`, `counting_notes`
- `effective_from`, `effective_to`, `status`

For more complex buildings, model separate slab rows/rules per floor type rather than forcing one universal rule.

### `bathroom_rule_sets`
- `id`, `template_id`, `line_item_id`, `quantity_per_bathroom`
- `unit_id`, `rate_card_item_id`, `client_explanation`
- `status`, `version`

### `estimate_revisions`
- `id`, `estimate_id`, `revision_number`, `status`
- `input_snapshot_json`, `catalogue_version_ids`
- `package_version_id`, `rate_card_version_ids`, `rule_version_ids`
- `calculation_engine_version`, `totals_snapshot_json`
- `issued_at`, `issued_by`, `created_at`

### `estimate_line_items`
Store resolved snapshot values, not only foreign keys:
- source line item/package option IDs and version IDs
- display name/specification snapshot
- quantity, unit snapshot, unit rate snapshot
- amount, inclusion status, explanation/trace
- client-visible fields snapshot
- source rule/rate version references

## 3. Safe expression DSL examples

These are structural examples only; actual values and rates are admin configured.

### Per-bathroom quantity
```json
{
  "op": "multiply",
  "args": [
    {"ref": "input.total_bathrooms"},
    {"constant": 1}
  ]
}
```

### Per-floor quantity
```json
{
  "op": "multiply",
  "args": [
    {"ref": "input.total_floors"},
    {"ref": "rule.quantity_per_floor"}
  ]
}
```

### Floor-band lookup
```json
{
  "op": "lookup",
  "input": {"ref": "input.total_floors"},
  "table": "foundation_rule_band",
  "match": "inclusive_range",
  "output": "foundation_option_and_rate"
}
```

The `table` identifier must resolve to a database record owned by the same organisation/template. It must not permit arbitrary table names or SQL.

## 4. Example calculation traces

Illustrative only:
- `Total bathrooms (4) × configured quantity per bathroom (1) = 4 sets`.
- `Total floors (5) × configured slab count per floor (1) = 5 Nos`.
- `Total floors (7) matched configured foundation band "Band name" → configured option and rate`.

Do not copy these example quantities/rules into production unless the architect explicitly configures them.

## 5. Calculation validation rules

- Input key exists and is active.
- Input value satisfies type/range.
- Rule output unit matches line item unit or has explicit conversion.
- All required rate-card items exist and are active.
- Quantity is not negative unless explicitly allowed.
- Divisor is not zero.
- Formula dependency graph is acyclic.
- Foundation bands are unambiguous.
- Slab count basis is explicit.
- Bathroom quantity basis is explicit.
- Currency and rounding policy are consistent.
- All required values are present before issue.

## 6. Snapshot immutability

An estimate revision in `ISSUED` state is immutable. A change creates a new revision. Do not update issued line item values, formula snapshots, rates, inputs or document contents in place.
