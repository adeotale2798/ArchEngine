import { Info } from "lucide-react";
import { useTemplate } from "@/lib/hooks";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import { Badge, Notice, PageHeader } from "@/components/ui";

export const INPUT_FIELDS = [
  { name: "key", label: "Key (stable, used in formulas)", help: "lowercase_with_underscores, e.g. total_floors" }, { name: "label", label: "Client label" },
  { name: "input_type", label: "Type", type: "select", options: [["integer", "Whole number"], ["decimal", "Decimal"], ["boolean", "Yes / No"], ["select", "Single select"]] },
  { name: "unit_id", label: "Unit", type: "ref", ref: "units" }, { name: "default_value", label: "Default value" },
  { name: "min_value", label: "Minimum", type: "number" }, { name: "max_value", label: "Maximum", type: "number" },
  { name: "options", label: "Select options", type: "list" },
  { name: "help_text", label: "Help text — explain exactly what is counted", type: "textarea" },
  { name: "required", label: "Required", type: "bool" }, { name: "client_visible", label: "Visible to client", type: "bool" }, { name: "client_editable", label: "Client can edit", type: "bool" },
];

export default function Inputs() {
  const { templateId } = useTemplate();
  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Building inputs" subtitle="The short brief clients answer. Add any building-level question; formulas and rules reference inputs by key." />
      <Notice tone="info" icon={Info} className="mb-6">Clients never enter room dimensions, wall lengths or floor plans. Keep inputs building-level (e.g. floors, bathrooms, basement count).</Notice>
      {templateId && <CrudTable resource="inputs" params={{ template_id: templateId }} base={{ template_id: templateId, required: true, client_visible: true, client_editable: true, input_type: "integer" }} fields={INPUT_FIELDS} testid="inputs"
        columns={[["key", "Key", (r) => <span className="num">{r.key}</span>], ["label", "Label"], ["input_type", "Type"], ["range", "Range", (r) => <span className="num">{r.min_value ?? "−"} – {r.max_value ?? "∞"}</span>],
          ["default_value", "Default"], ["client", "Client", (r) => <Badge tone={r.client_editable ? "success" : "muted"}>{r.client_visible ? (r.client_editable ? "editable" : "read-only") : "hidden"}</Badge>], ["status", "Status", statusBadge]]} />}
    </div>
  );
}
