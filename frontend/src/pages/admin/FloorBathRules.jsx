import { Info } from "lucide-react";
import { useList, useTemplate } from "@/lib/hooks";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import RulePreview from "@/components/RulePreview";
import { Badge, Notice, PageHeader } from "@/components/ui";

export function SlabRules() {
  const { templateId } = useTemplate();
  const sets = useList("slab_rules", { template_id: templateId });
  const fields = [{ name: "name", label: "Rule name" }, { name: "line_item_id", label: "Applies to line item (mode: Per floor)", type: "ref", ref: "line_items", params: { template_id: templateId } },
    { name: "input_key", label: "Floor input key", placeholder: "total_floors" }, { name: "floor_adjustment", label: "Floor count adjustment", type: "number", help: "e.g. −1 when the ground floor roof is a separate row" },
    { name: "slabs_per_floor", label: "Slabs per floor", type: "number" },
    { name: "quantity_basis", label: "Counting basis", type: "select", options: [["COUNT", "Number of slabs (Nos)"], ["AREA", "Area per slab"], ["VOLUME", "Volume per slab"], ["LUMP_SUM", "Lump sum per floor"]] },
    { name: "quantity_per_floor", label: "Approved quantity per slab (area/volume)", type: "number" }, { name: "unit_id", label: "Unit", type: "ref", ref: "units" },
    { name: "included_floor_types", label: "Which floors are included (ground, terrace, stilt, basement…)", type: "textarea" },
    { name: "counting_notes", label: "Counting notes", type: "textarea" }, { name: "client_explanation", label: "Client-facing explanation", type: "textarea" },
    { name: "is_assumption", label: "Label as template assumption (no footprint collected)", type: "bool" }];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Construction rules" title="Slab rules per floor" subtitle="Quantity = (total floors + adjustment) × slabs per floor × approved quantity per slab, in the unit you choose." />
      <Notice tone="info" icon={Info}>Clients don't provide a footprint, so per-floor areas are template quantities. Mark them as assumptions so estimates never present them as measured. Terrace, roof or basement slabs can be separate line items.</Notice>
      {templateId && <CrudTable resource="slab_rules" params={{ template_id: templateId }} base={{ template_id: templateId, input_key: "total_floors", slabs_per_floor: "1", quantity_basis: "COUNT", is_assumption: true }} fields={fields} testid="slab-rules"
        columns={[["name", "Name", (r) => <b>{r.name}</b>], ["quantity_basis", "Basis", (r) => <Badge tone="info">{r.quantity_basis}</Badge>],
          ["formula", "Quantity", (r) => <span className="num text-xs">({r.input_key || "total_floors"} {r.floor_adjustment ? `${Number(r.floor_adjustment) < 0 ? "" : "+"}${r.floor_adjustment}` : ""}) × {r.slabs_per_floor || 1}{["AREA", "VOLUME"].includes(r.quantity_basis) ? ` × ${r.quantity_per_floor}` : ""}</span>],
          ["is_assumption", "Assumption", (r) => (r.is_assumption ? "yes" : "no")], ["status", "Status", statusBadge]]} />}
      <RulePreview inputKey="total_floors" lineIds={sets.rows.map((s) => s.line_item_id)} title="Floor change simulator — slabs" />
    </div>
  );
}

export function BathroomRules() {
  const { templateId } = useTemplate();
  const sets = useList("bathroom_rules", { template_id: templateId });
  const fields = [{ name: "name", label: "Rule name" }, { name: "line_item_id", label: "Applies to line item (mode: Per bathroom)", type: "ref", ref: "line_items", params: { template_id: templateId } },
    { name: "input_key", label: "Bathroom input key", placeholder: "total_bathrooms" }, { name: "quantity_per_bathroom", label: "Quantity per bathroom", type: "number" },
    { name: "unit_id", label: "Unit", type: "ref", ref: "units" }, { name: "client_explanation", label: "Client-facing explanation", type: "textarea" }];
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Construction rules" title="Bathroom rules" subtitle="Quantity = total bathrooms × configured quantity per bathroom. Map any bathroom-driven item: sanitary sets, plumbing points, waterproofing allowance." />
      <Notice tone="info" icon={Info}>Not every bathroom is identical. Only configure a per-bathroom quantity you can defend; add optional inputs (e.g. premium bathrooms) later if one count is not enough.</Notice>
      {templateId && <CrudTable resource="bathroom_rules" params={{ template_id: templateId }} base={{ template_id: templateId, input_key: "total_bathrooms" }} fields={fields} testid="bathroom-rules"
        emptyText="The source quotation has no per-bathroom quantities, so nothing was imported. Create a line item with mode “Per bathroom”, then add a rule here."
        columns={[["name", "Name", (r) => <b>{r.name}</b>], ["quantity_per_bathroom", "Qty / bathroom", (r) => <span className="num">{r.quantity_per_bathroom}</span>], ["status", "Status", statusBadge]]} />}
      <RulePreview inputKey="total_bathrooms" lineIds={sets.rows.map((s) => s.line_item_id)} title="Bathroom change simulator" />
    </div>
  );
}
