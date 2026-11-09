import { useList } from "@/lib/hooks";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import { Badge, Notice, PageHeader } from "@/components/ui";

const DIMS = [["length", "Length"], ["area", "Area"], ["volume", "Volume"], ["weight", "Weight"], ["count", "Count"], ["time", "Time"], ["trade", "Trade-specific"], ["lump_sum", "Lump sum"]];

export default function Units() {
  const { rows: units } = useList("units");
  const code = (id) => units.find((u) => u.id === id)?.code || "?";
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Pricing" title="Units & conversions" subtitle="A rate's unit must match the quantity unit or be linked by an explicit conversion below. Incompatible combinations block the estimate." />
      <CrudTable resource="units" title="Unit catalogue" testid="units" fields={[{ name: "code", label: "Code" }, { name: "name", label: "Name" }, { name: "dimension", label: "Dimension", type: "select", options: DIMS }]}
        columns={[["code", "Code", (r) => <span className="num font-semibold">{r.code}</span>], ["name", "Name"], ["dimension", "Dimension", (r) => <Badge tone="info">{r.dimension}</Badge>], ["status", "Status", statusBadge]]} />
      <div>
        <Notice tone="warning" className="mb-4">Trade units (bag, brass, bundle, guntha…) have no universal conversion. Add one only if your firm defines it.</Notice>
        <CrudTable resource="conversions" title="Conversions" testid="conversions"
          fields={[{ name: "from_unit_id", label: "From unit", type: "ref", ref: "units" }, { name: "to_unit_id", label: "To unit", type: "ref", ref: "units" }, { name: "factor", label: "Factor (1 from = factor × to)", type: "number" }, { name: "note", label: "Note" }]}
          columns={[["from", "Conversion", (r) => <span className="num">1 {code(r.from_unit_id)} = {r.factor} {code(r.to_unit_id)}</span>], ["note", "Note"], ["status", "Status", statusBadge]]} />
      </div>
    </div>
  );
}
