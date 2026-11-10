import { useEffect, useState } from "react";
import { AlertTriangle, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { notifyError } from "@/lib/api";
import { save, useList, useTemplate } from "@/lib/hooks";
import RulePreview from "@/components/RulePreview";
import { Button, Card, Empty, Field, Input, Notice, PageHeader, Select, Textarea, Toggle } from "@/components/ui";

const newBand = () => ({ label: "", min_floors: "", max_floors: "", quantity: "", unit_id: null, specification: "", rates: {}, client_note: "", approval_reference: "", requires_review: false, status: "active" });

function SetEditor({ rs, lines, units, pkgs, templateId, onSaved }) {
  const [d, setD] = useState(rs);
  useEffect(() => setD(rs), [rs]);
  const setBand = (i, patch) => setD((x) => ({ ...x, bands: x.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const submit = async () => {
    try {
      const body = { name: d.name, line_item_id: d.line_item_id, input_key: d.input_key || "total_floors", approval_note: d.approval_note, bands: d.bands.map(({ id, ...b }) => ({ ...(id ? { id } : {}), ...b, max_floors: b.max_floors || null })) };
      await save("foundation_rules", d.id ? body : { ...body, template_id: templateId }, d.id); toast.success("Foundation rule saved"); onSaved();
    } catch (e) { notifyError(e); }
  };

  return (
    <Card className="space-y-5 p-6" data-testid={`foundation-set-${d.id || "new"}`}>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Rule set name"><Input data-testid="fr-name" value={d.name || ""} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Applies to line item"><Select data-testid="fr-line" value={d.line_item_id || ""} onChange={(e) => setD({ ...d, line_item_id: e.target.value || null })} placeholder="— choose —"
          options={lines.filter((l) => l.quantity_mode === "FLOOR_BAND_LOOKUP").map((l) => [l.id, `${l.code} · ${l.name}`])} /></Field>
        <Field label="Driven by input key"><Input data-testid="fr-input" value={d.input_key || "total_floors"} onChange={(e) => setD({ ...d, input_key: e.target.value })} /></Field>
      </div>
      <p className="text-sm text-muted-foreground">Bands are inclusive on both ends (min ≤ floors ≤ max). Leave max empty for “and above”. Rate per package overrides the line item's package rate; leave blank to use it.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            {["Label", "Floors from", "to", "Quantity", "Unit", "Foundation specification", ...pkgs.map((p) => `Rate · ${p.name}`), "Client note", "Approval ref.", "Review", ""].map((h) => <th key={h} className="border-b border-border px-1.5 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {d.bands.map((b, i) => (
              <tr key={i} data-testid={`band-row-${i}`} className="align-top">
                <td className="p-1"><Input data-testid={`band-label-${i}`} className="h-9 w-36" value={b.label} onChange={(e) => setBand(i, { label: e.target.value })} /></td>
                <td className="p-1"><Input data-testid={`band-min-${i}`} className="num h-9 w-16" value={b.min_floors ?? ""} onChange={(e) => setBand(i, { min_floors: e.target.value })} /></td>
                <td className="p-1"><Input data-testid={`band-max-${i}`} className="num h-9 w-16" placeholder="∞" value={b.max_floors ?? ""} onChange={(e) => setBand(i, { max_floors: e.target.value })} /></td>
                <td className="p-1"><Input data-testid={`band-qty-${i}`} className="num h-9 w-20" value={b.quantity ?? ""} onChange={(e) => setBand(i, { quantity: e.target.value })} /></td>
                <td className="p-1"><Select className="h-9 w-20" value={b.unit_id || ""} onChange={(e) => setBand(i, { unit_id: e.target.value || null })} placeholder="item" options={units.map((u) => [u.id, u.code])} /></td>
                <td className="p-1"><Textarea data-testid={`band-spec-${i}`} className="min-h-[38px] w-56 text-xs" value={b.specification || ""} onChange={(e) => setBand(i, { specification: e.target.value })} /></td>
                {pkgs.map((p) => <td key={p.id} className="p-1"><Input data-testid={`band-rate-${i}-${p.code}`} className="num h-9 w-24" value={b.rates?.[p.id] ?? ""} onChange={(e) => setBand(i, { rates: { ...b.rates, [p.id]: e.target.value || null } })} /></td>)}
                <td className="p-1"><Textarea className="min-h-[38px] w-40 text-xs" value={b.client_note || ""} onChange={(e) => setBand(i, { client_note: e.target.value })} /></td>
                <td className="p-1"><Input data-testid={`band-approval-${i}`} className="h-9 w-28" value={b.approval_reference || ""} onChange={(e) => setBand(i, { approval_reference: e.target.value })} /></td>
                <td className="p-1 pt-2"><Toggle checked={b.requires_review} onChange={(v) => setBand(i, { requires_review: v })} /></td>
                <td className="p-1"><Button variant="ghost" size="sm" aria-label="Remove band" data-testid={`band-remove-${i}`} onClick={() => setD({ ...d, bands: d.bands.filter((_, j) => j !== i) })}><Trash2 size={14} /></Button></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <Field label="Architect / structural engineer approval note"><Textarea data-testid="fr-approval-note" value={d.approval_note || ""} onChange={(e) => setD({ ...d, approval_note: e.target.value })} /></Field>
      <div className="flex justify-between"><Button variant="outline" data-testid="add-band-btn" onClick={() => setD({ ...d, bands: [...d.bands, newBand()] })}><Plus size={14} /> Add band</Button>
        <Button data-testid="fr-save-btn" onClick={submit}><Save size={14} /> Save rule set</Button></div>
    </Card>
  );
}

export default function FoundationRules() {
  const { templateId } = useTemplate();
  const sets = useList("foundation_rules", { template_id: templateId });
  const lines = useList("line_items", { template_id: templateId });
  const units = useList("units");
  const pkgs = useList("packages", { template_id: templateId });
  const [draft, setDraft] = useState(null);
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Construction rules" title="Foundation rules by total floors" subtitle="Map floor-count bands to architect-approved foundation specifications, quantities and rates."
        actions={<Button data-testid="new-foundation-set-btn" onClick={() => setDraft({ name: "", bands: [newBand()] })}><Plus size={15} /> New rule set</Button>} />
      <Notice tone="warning" icon={AlertTriangle}><b>Estimation mapping only.</b> These bands select a costing specification; they do not certify structural adequacy. Actual foundation design depends on structural design and site/geotechnical conditions and must be approved by the architect/structural engineer. Floor counts outside every band block issue and request architect review.</Notice>
      {draft && <SetEditor rs={draft} lines={lines.rows} units={units.rows} pkgs={pkgs.rows} templateId={templateId} onSaved={() => { setDraft(null); sets.reload(); }} />}
      {sets.rows.length === 0 && !draft ? <Empty title="No foundation rules yet">Set a line item's quantity mode to “Floor-band lookup”, then create a rule set here.</Empty> :
        sets.rows.map((rs) => <SetEditor key={rs.id} rs={rs} lines={lines.rows} units={units.rows} pkgs={pkgs.rows} templateId={templateId} onSaved={sets.reload} />)}
      <RulePreview inputKey="total_floors" lineIds={sets.rows.map((s) => s.line_item_id)} title="Floor change simulator — Foundation" />
    </div>
  );
}
