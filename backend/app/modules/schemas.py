"""Schemas for admin-managed catalogue resources. Every field is persisted; nothing is hard-coded per package."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.money import D
from app.engine.calculator import INCLUSIONS, QTY_MODES

Status = Literal["active", "archived", "draft"]
Num = Optional[str]


class Base(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sort_order: Optional[int] = None
    status: Optional[Status] = None

    @field_validator("*", mode="before")
    @classmethod
    def _nums(cls, v, info):
        name = info.field_name
        if name in NUMERIC_FIELDS and v not in (None, ""):
            D(v)  # raises ValueError -> 422 with a clear message
            return str(v)
        if isinstance(v, str):
            return v.strip()
        return v


NUMERIC_FIELDS = {"fixed_quantity", "factor", "rate", "internal_cost", "min_value", "max_value", "floor_adjustment",
                  "slabs_per_floor", "quantity_per_floor", "quantity_per_bathroom", "factor"}


class TemplateIn(Base):
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    intro_text: Optional[str] = None
    assumptions: Optional[list[str]] = None
    exclusions: Optional[list[str]] = None
    hero_image_url: Optional[str] = None


class SectionIn(Base):
    template_id: Optional[str] = None
    code: Optional[str] = Field(None, max_length=40)
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    client_visible: Optional[bool] = None
    image_url: Optional[str] = None


class SubsectionIn(SectionIn):
    section_id: Optional[str] = None


class LineItemIn(Base):
    template_id: Optional[str] = None
    section_id: Optional[str] = None
    subsection_id: Optional[str] = None
    code: Optional[str] = Field(None, max_length=60)
    name: Optional[str] = Field(None, max_length=300)
    description: Optional[str] = None
    trade_tag: Optional[str] = None
    unit_id: Optional[str] = None
    quantity_mode: Optional[Literal[tuple(QTY_MODES)]] = None
    fixed_quantity: Num = None
    input_key: Optional[str] = None
    quantity_input_key: Optional[str] = None
    factor: Num = None
    rule_id: Optional[str] = None
    inclusion_default: Optional[Literal[tuple(INCLUSIONS)]] = None
    client_visible: Optional[bool] = None
    client_can_change_option: Optional[bool] = None
    client_can_change_quantity: Optional[bool] = None
    client_price_visibility: Optional[Literal["SHOW_RATE", "LINE_TOTAL_ONLY", "HIDDEN"]] = None
    is_assumption: Optional[bool] = None
    internal_notes: Optional[str] = None
    client_notes: Optional[str] = None
    exclusions: Optional[str] = None
    source_ref: Optional[str] = None
    image_url: Optional[str] = None


class PackageIn(Base):
    template_id: Optional[str] = None
    code: Optional[str] = Field(None, max_length=40)
    name: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    image_url: Optional[str] = None
    inherits_from: Optional[str] = None
    is_recommended: Optional[bool] = None


class PackageOptionIn(Base):
    template_id: Optional[str] = None
    package_id: Optional[str] = None
    line_item_id: Optional[str] = None
    specification_label: Optional[str] = None
    specification_details: Optional[str] = None
    inclusion_status: Optional[Literal[tuple(INCLUSIONS)]] = None
    unit_id: Optional[str] = None
    rate: Num = None
    internal_cost: Num = None
    rate_card_item_id: Optional[str] = None
    client_note: Optional[str] = None


class InputDefIn(Base):
    template_id: Optional[str] = None
    key: Optional[str] = Field(None, pattern=r"^[a-z][a-z0-9_]{1,40}$")
    label: Optional[str] = None
    input_type: Optional[Literal["integer", "decimal", "boolean", "select"]] = None
    unit_id: Optional[str] = None
    required: Optional[bool] = None
    default_value: Optional[str] = None
    min_value: Num = None
    max_value: Num = None
    options: Optional[list[str]] = None
    help_text: Optional[str] = None
    client_visible: Optional[bool] = None
    client_editable: Optional[bool] = None


class RuleIn(Base):
    template_id: Optional[str] = None
    name: Optional[str] = None
    purpose: Optional[str] = None
    expression: Optional[dict[str, Any]] = None
    output_unit_id: Optional[str] = None
    client_explanation: Optional[str] = None
    internal_approval_note: Optional[str] = None
    requires_review: Optional[bool] = None
    test_cases: Optional[list[dict[str, Any]]] = None


class BandIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: Optional[str] = None
    label: str = ""
    min_floors: str
    max_floors: Optional[str] = None
    quantity: Optional[str] = None
    unit_id: Optional[str] = None
    specification: Optional[str] = None
    rates: dict[str, Optional[str]] = {}
    client_note: Optional[str] = None
    approval_reference: Optional[str] = None
    requires_review: bool = False
    effective_from: Optional[str] = None
    status: Status = "active"

    @field_validator("min_floors", "max_floors", "quantity")
    @classmethod
    def _n(cls, v):
        if v not in (None, ""):
            D(v)
        return v or None


class FoundationRuleSetIn(Base):
    template_id: Optional[str] = None
    name: Optional[str] = None
    line_item_id: Optional[str] = None
    input_key: Optional[str] = None
    quantity_input_key: Optional[str] = None
    approval_note: Optional[str] = None
    bands: Optional[list[BandIn]] = None


class SlabRuleIn(Base):
    template_id: Optional[str] = None
    name: Optional[str] = None
    line_item_id: Optional[str] = None
    input_key: Optional[str] = None
    quantity_input_key: Optional[str] = None
    included_floor_types: Optional[str] = None
    floor_adjustment: Num = None
    slabs_per_floor: Num = None
    quantity_basis: Optional[Literal["COUNT", "AREA", "VOLUME", "LUMP_SUM"]] = None
    quantity_per_floor: Num = None
    unit_id: Optional[str] = None
    is_assumption: Optional[bool] = None
    counting_notes: Optional[str] = None
    client_explanation: Optional[str] = None


class BathroomRuleIn(Base):
    template_id: Optional[str] = None
    name: Optional[str] = None
    line_item_id: Optional[str] = None
    input_key: Optional[str] = None
    quantity_per_bathroom: Num = None
    unit_id: Optional[str] = None
    client_explanation: Optional[str] = None


class UnitIn(Base):
    code: Optional[str] = Field(None, max_length=20)
    name: Optional[str] = None
    dimension: Optional[Literal["length", "area", "volume", "weight", "count", "time", "trade", "lump_sum"]] = None


class ConversionIn(Base):
    from_unit_id: Optional[str] = None
    to_unit_id: Optional[str] = None
    factor: Num = None
    note: Optional[str] = None


class RateCardIn(Base):
    name: Optional[str] = None
    description: Optional[str] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None


class RateCardItemIn(Base):
    rate_card_id: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    unit_id: Optional[str] = None
    rate: Num = None
    internal_cost: Num = None


# name -> (collection, model, scope, required fields on create, refs field->collection, unique fields)
RESOURCES = {
    "templates": ("estimate_templates", TemplateIn, "org", ["name"], {}, []),
    "sections": ("sections", SectionIn, "template", ["template_id", "name"], {}, ["code"]),
    "subsections": ("subsections", SubsectionIn, "template", ["template_id", "section_id", "name"], {"section_id": "sections"}, []),
    "line_items": ("line_items", LineItemIn, "template", ["template_id", "section_id", "code", "name"],
                   {"section_id": "sections", "subsection_id": "subsections", "unit_id": "units", "rule_id": "calculation_rules"}, ["code"]),
    "packages": ("packages", PackageIn, "template", ["template_id", "code", "name"], {"inherits_from": "packages"}, ["code"]),
    "package_options": ("package_options", PackageOptionIn, "template", ["template_id", "package_id", "line_item_id"],
                        {"package_id": "packages", "line_item_id": "line_items", "unit_id": "units", "rate_card_item_id": "rate_card_items"}, []),
    "inputs": ("input_definitions", InputDefIn, "template", ["template_id", "key", "label"], {"unit_id": "units"}, ["key"]),
    "rules": ("calculation_rules", RuleIn, "template", ["template_id", "name", "expression"], {"output_unit_id": "units"}, []),
    "foundation_rules": ("foundation_rule_sets", FoundationRuleSetIn, "template", ["template_id", "name"], {"line_item_id": "line_items"}, []),
    "slab_rules": ("slab_rule_sets", SlabRuleIn, "template", ["template_id", "name", "quantity_basis"], {"line_item_id": "line_items", "unit_id": "units"}, []),
    "bathroom_rules": ("bathroom_rule_sets", BathroomRuleIn, "template", ["template_id", "name", "quantity_per_bathroom"], {"line_item_id": "line_items", "unit_id": "units"}, []),
    "units": ("unit_definitions", UnitIn, "org", ["code", "name", "dimension"], {}, ["code"]),
    "conversions": ("unit_conversions", ConversionIn, "org", ["from_unit_id", "to_unit_id", "factor"], {"from_unit_id": "unit_definitions", "to_unit_id": "unit_definitions"}, []),
    "rate_cards": ("rate_cards", RateCardIn, "org", ["name"], {}, []),
    "rate_card_items": ("rate_card_items", RateCardItemIn, "org", ["rate_card_id", "code", "rate"], {"rate_card_id": "rate_cards", "unit_id": "unit_definitions"}, []),
}
# refs to "units" collection name normalisation
for _k, _v in RESOURCES.items():
    for f, c in list(_v[4].items()):
        if c == "units":
            _v[4][f] = "unit_definitions"
