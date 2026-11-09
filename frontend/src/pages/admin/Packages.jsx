import { useState } from "react";
import { Archive, Copy, Pencil, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { save, useList, useTemplate } from "@/lib/hooks";
import ResourceForm from "@/components/ResourceForm";
import { Badge, Button, Card, Modal, PageHeader, Table } from "@/components/ui";

const FIELDS = (templateId) => [{ name: "code", label: "Code (stable)" }, { name: "name", label: "Display name" }, { name: "description", label: "Description", type: "textarea" },
  { name: "image_url", label: "Card image URL", span: 2 }, { name: "inherits_from", label: "Inherit options from", type: "ref", ref: "packages", params: { template_id: templateId } },
  { name: "is_recommended", label: "Mark as recommended", type: "bool" }];

function Cell({ opt, pkg, line, templateId, field, onSaved }) {
  const [v, setV] = useState(opt?.[field] ?? "");
  const commit = async () => {
    if ((opt?.[field] ?? "") === v) return;
    try { await save("package_options", opt ? { [field]: v || null } : { template_id: templateId, package_id: pkg.id, line_item_id: line.id, [field]: v || null }, opt?.id); toast.success("Saved"); onSaved(); } catch (e) { notifyError(e); }
  };
  return <input aria-label={`${pkg.name} ${line.code} ${field}`} data-testid={`matrix-${field}-${line.code}-${pkg.code}`} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
    className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 hover:border-border focus:border-primary focus:outline-none ${field === "rate" ? "num w-24 text-right" : "min-w-[160px] text-xs"}`} placeholder={opt ? "" : "—"} />;
}

export default function Packages() {
  const { templateId } = useTemplate();
  const pk = useList("packages", { template_id: templateId });
  const lines = useList("line_items", { template_id: templateId });
  const opts = useList("package_options", { template_id: templateId });
  const [edit, setEdit] = useState(null);
  const [field, setField] = useState("rate");
  const act = async (id, a) => { try { await api.post(`/r/packages/${id}/${a}`); toast.success("Done"); pk.reload(); opts.reload(); } catch (e) { notifyError(e); } };
  const priced = lines.rows.filter((l) => field !== "rate" || l.inclusion_default !== "INCLUDED_IN_RATE");
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Catalogue" title="Packages" subtitle="Packages are data, not code. Add Package D, Premium or Economy at any time; inherit options from another package and override only what differs."
        actions={<Button data-testid="add-package-btn" onClick={() => setEdit({})}><Plus size={15} /> Add package</Button>} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {pk.rows.map((p) => (
          <Card key={p.id} className="group overflow-hidden transition-transform hover:-translate-y-1" data-testid={`package-card-${p.code}`}>
            <div className="relative h-36 bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
              {p.is_recommended && <Badge tone="primary" className="absolute right-2 top-2 bg-white"><Star size={11} /> Recommended</Badge>}</div>
            <div className="p-5">
              <div className="num text-[11px] text-muted-foreground">{p.code}</div>
              <div className="font-display text-xl font-semibold">{p.name}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              {p.inherits_from && <div className="mt-2 text-xs">Inherits from <b>{pk.rows.find((x) => x.id === p.inherits_from)?.name}</b></div>}
              <div className="mt-3 flex gap-1">
                <Button variant="ghost" size="sm" data-testid={`package-edit-${p.code}`} onClick={() => setEdit(p)}><Pencil size={13} /></Button>
                <Button variant="ghost" size="sm" data-testid={`package-dup-${p.code}`} onClick={() => act(p.id, "duplicate")}><Copy size={13} /></Button>
                <Button variant="ghost" size="sm" data-testid={`package-archive-${p.code}`} onClick={() => act(p.id, "archive")}><Archive size={13} /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3"><h2 className="mr-auto text-xl font-semibold">Package matrix</h2>
          {[["rate", "Rates"], ["specification_label", "Specifications"]].map(([k, l]) => <Button key={k} size="sm" variant={field === k ? "secondary" : "outline"} data-testid={`matrix-mode-${k}`} onClick={() => setField(k)}>{l}</Button>)}</div>
        <p className="mb-3 text-xs text-muted-foreground">Click a cell to edit; it saves when you leave the cell. Blank = no option (inherits or shows as missing).</p>
        <Table head={["Code", "Line item", ...pk.rows.map((p) => p.name)]}>
          {priced.map((l) => (
            <tr key={l.id}><td className="num text-xs">{l.code}</td><td className="min-w-[180px] text-sm">{l.name}</td>
              {pk.rows.map((p) => { const o = opts.rows.find((x) => x.package_id === p.id && x.line_item_id === l.id);
                return <td key={p.id + field + (o?.id || "")} className="p-1"><Cell opt={o} pkg={p} line={l} field={field} templateId={templateId} onSaved={opts.reload} /></td>; })}
            </tr>
          ))}
        </Table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.name}` : "New package"} wide testid="package-modal">
        {edit && <ResourceForm resource="packages" fields={FIELDS(templateId)} initial={edit} base={{ template_id: templateId }} testid="package-form" onSaved={() => { setEdit(null); pk.reload(); }} />}
      </Modal>
    </div>
  );
}
