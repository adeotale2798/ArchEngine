import { useState } from "react";
import { useList } from "@/lib/hooks";
import { inr } from "@/lib/format";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import { Button, PageHeader } from "@/components/ui";

export default function RateCards() {
  const [card, setCard] = useState(null);
  const { rows: units } = useList("units");
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Pricing" title="Rate cards" subtitle="Shared, dated rate lists. Package options can reference a rate card item instead of a direct rate. Internal cost is never exported to clients." />
      <CrudTable resource="rate_cards" title="Cards" testid="rate-cards"
        fields={[{ name: "name", label: "Name" }, { name: "description", label: "Description", type: "textarea" }, { name: "effective_from", label: "Effective from (YYYY-MM-DD)" }, { name: "effective_to", label: "Effective to" }]}
        extraActions={(r) => <Button variant={card?.id === r.id ? "secondary" : "ghost"} size="sm" data-testid={`rate-card-open-${r.id}`} onClick={() => setCard(r)}>Items</Button>}
        columns={[["name", "Name", (r) => <b>{r.name}</b>], ["effective_from", "From"], ["effective_to", "To"], ["status", "Status", statusBadge]]} />
      {card && <CrudTable key={card.id} resource="rate_card_items" title={`Items · ${card.name}`} testid="rate-card-items" params={{ rate_card_id: card.id }} base={{ rate_card_id: card.id }}
        fields={[{ name: "code", label: "Code" }, { name: "description", label: "Description" }, { name: "unit_id", label: "Rate unit", type: "ref", ref: "units" }, { name: "rate", label: "Client rate", type: "number" }, { name: "internal_cost", label: "Internal cost", type: "number" }]}
        columns={[["code", "Code", (r) => <span className="num">{r.code}</span>], ["description", "Description"], ["unit", "Unit", (r) => units.find((u) => u.id === r.unit_id)?.code || "—"],
          ["rate", "Rate", (r) => <span className="num">{inr(r.rate, { dp: 2 })}</span>], ["internal_cost", "Internal cost", (r) => <span className="num text-muted-foreground">{inr(r.internal_cost, { dp: 2 })}</span>]]} />}
    </div>
  );
}
