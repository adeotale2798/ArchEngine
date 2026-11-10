import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Plus, Search, Copy, Archive } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { INCLUSIONS, QTY_MODES } from "@/lib/format";
import { save, useList, useTemplate } from "@/lib/hooks";
import { FieldInput } from "@/components/ResourceForm";
import HistoryPanel from "@/components/HistoryPanel";
import { Badge, Button, Card, Empty, Input, Notice, PageHeader, Tabs, cx } from "@/components/ui";

const TABS = [["general", "General"], ["packages", "Package Options"], ["quantity", "Quantity & Calculation"], ["units", "Units"], ["rates", "Rates"],
  ["visibility", "Client Visibility"], ["notes", "Notes"], ["history", "History"]];

function OptionRow({ pkg, line, opt, fields, onSaved, templateId }) {
  const [d, setD] = useState(opt || {});
  useEffect(() => setD(opt || {}), [opt]);
  const submit = async () => {
    try {
      const payload = Object.fromEntries(fields.map((f) => [f.name, d[f.name] === "" ? null : d[f.name] ?? null]));
      await save("package_options", opt?.id ? payload : { ...payload, template_id: templateId, package_id: pkg.id, line_item_id: line.id }, opt?.id);
      toast.success(`${pkg.name} saved`); onSaved();
    } catch (e) { notifyError(e); }
  };
  return (
    <Card className="p-5" data-testid={`option-card-${pkg.code}`}>
      <div className="mb-4 flex items-center gap-2"><span className="font-display text-base font-semibold">{pkg.name}</span>
        {!opt && <Badge tone="warning">no option — inherits{pkg.inherits_from ? " from parent" : " nothing"}</Badge>}</div>
      <div className="grid gap-4 md:grid-cols-3">{fields.map((f) => <div key={f.name} className={f.type === "textarea" ? "md:col-span-3" : ""}><FieldInput f={f} prefix={`opt-${pkg.code}`} value={d[f.name]} onChange={(v) => setD((x) => ({ ...x, [f.name]: v }))} /></div>)}</div>
      <div className="mt-4 flex justify-end"><Button size="sm" data-testid={`option-save-${pkg.code}`} onClick={submit}>Save {pkg.name}</Button></div>
    </Card>
  );
}

function PackageOptions({ line, fields, templateId }) {
  const pk = useList("packages", { template_id: templateId });
  const opts = useList("package_options", { line_item_id: line.id });
  return <div className="space-y-4">{pk.rows.map((p) => <OptionRow key={p.id} pkg={p} line={line} templateId={templateId} fields={fields} opt={opts.rows.find((o) => o.package_id === p.id)} onSaved={opts.reload} />)}</div>;
}

function LineForm({ line, fields, onSaved, tid }) {
  const [d, setD] = useState(line);
  useEffect(() => setD(line), [line]);
  const submit = async () => {
    try { const out = await save("line_items", Object.fromEntries(fields.map((f) => [f.name, d[f.name] === "" ? null : d[f.name] ?? null])), line.id); toast.success("Saved"); onSaved(out); } catch (e) { notifyError(e); }
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">{fields.map((f) => <div key={f.name} className={f.type === "textarea" || f.span === 2 ? "md:col-span-2" : ""}><FieldInput f={f} prefix={tid} value={d[f.name]} onChange={(v) => setD((x) => ({ ...x, [f.name]: v }))} /></div>)}</div>
      <div className="flex justify-end"><Button data-testid={`${tid}-save`} onClick={submit}>Save changes</Button></div>
    </div>
  );
}

function Editor({ line, templateId, onSaved }) {
  const [tab, setTab] = useState("general");
  const mode = line.quantity_mode;
  const general = [{ name: "code", label: "Code" }, { name: "name", label: "Client label" }, { name: "section_id", label: "Section", type: "ref", ref: "sections", params: { template_id: templateId } },
    { name: "subsection_id", label: "Subsection", type: "ref", ref: "subsections", params: { template_id: templateId, section_id: line.section_id } },
    { name: "trade_tag", label: "Trade / category tag" }, { name: "inclusion_default", label: "Default inclusion", type: "select", options: INCLUSIONS },
    { name: "description", label: "Description", type: "textarea" }, { name: "image_url", label: "Image URL", span: 2 }];
  const qty = [{ name: "quantity_mode", label: "Quantity mode", type: "select", options: QTY_MODES },
    ...(mode === "FIXED_QUANTITY" ? [{ name: "fixed_quantity", label: "Fixed quantity", type: "number" }] : []),
    ...(mode === "INPUT_MULTIPLIER" ? [{ name: "input_key", label: "Building input key", help: "e.g. total_floors" }, { name: "factor", label: "Factor", type: "number" }] : []),
    ...(["RULE", "LOOKUP_TABLE", "COMPOSITE"].includes(mode) ? [{ name: "rule_id", label: "Calculation rule", type: "ref", ref: "rules", params: { template_id: templateId } }] : []),
    { name: "is_assumption", label: "Quantity is a template assumption (indicative)", type: "bool" }];
  const modeHelp = { PER_FLOOR: "Configure the per-floor basis in Slab Rules and link it to this item.", PER_BATHROOM: "Configure quantity per bathroom in Bathroom Rules.",
    FLOOR_BAND_LOOKUP: "Configure floor-count bands in Foundation Rules.", LUMP_SUM: "Amount = package rate. No quantity multiplication.",
    MANUAL_INTERNAL: "Architect enters the quantity on each estimate.", CLIENT_MANUAL: "Client enters quantity — enable 'client can change quantity' in Client Visibility." }[mode];
  const optSpec = [{ name: "specification_label", label: "Specification" }, { name: "inclusion_status", label: "Inclusion (blank = default)", type: "select", options: INCLUSIONS, placeholder: "— use default —" },
    { name: "client_note", label: "Client note" }, { name: "specification_details", label: "Specification details / brand / attributes", type: "textarea" }];
  const optRates = [{ name: "rate", label: "Client rate (₹ per rate unit)", type: "number" }, { name: "internal_cost", label: "Internal cost (never exported)", type: "number" },
    { name: "rate_card_item_id", label: "Or use rate card item", type: "ref", ref: "rate_card_items", labelKey: "description" }];
  const optUnits = [{ name: "unit_id", label: "Rate unit for this package (blank = item unit)", type: "ref", ref: "units" }];
  const vis = [{ name: "client_visible", label: "Visible to client", type: "bool" }, { name: "client_can_change_option", label: "Client can switch specification", type: "bool" },
    { name: "client_can_change_quantity", label: "Client can change quantity", type: "bool" },
    { name: "client_price_visibility", label: "Price shown to client", type: "select", options: [["SHOW_RATE", "Show rate and amount"], ["LINE_TOTAL_ONLY", "Line total only"], ["HIDDEN", "Hide price"]] }];
  const notes = [{ name: "client_notes", label: "Client-facing note", type: "textarea" }, { name: "exclusions", label: "Exclusions for this item", type: "textarea" },
    { name: "internal_notes", label: "Internal note (never shown to client)", type: "textarea" }, { name: "source_ref", label: "Source reference", span: 2 }];
  return (
    <Card className="p-6" data-testid="line-editor">
      <div className="mb-4 flex flex-wrap items-center gap-2"><span className="num text-xs text-muted-foreground">{line.code}</span><h2 className="text-2xl font-semibold">{line.name}</h2>
        <Badge tone="info">{QTY_MODES.find((m) => m[0] === mode)?.[1] || mode}</Badge></div>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "general" && <LineForm line={line} fields={general} onSaved={onSaved} tid="li-general" />}
      {tab === "packages" && <PackageOptions line={line} fields={optSpec} templateId={templateId} />}
      {tab === "quantity" && <>{modeHelp && <Notice tone="info" className="mb-4">{modeHelp}</Notice>}<LineForm line={line} fields={qty} onSaved={onSaved} tid="li-qty" /></>}
      {tab === "units" && <><LineForm line={line} fields={[{ name: "unit_id", label: "Quantity unit", type: "ref", ref: "units" }]} onSaved={onSaved} tid="li-units" />
        <h3 className="my-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Package-specific rate units</h3>
        <Notice tone="info" className="mb-4">If a rate unit differs from the quantity unit, a conversion must exist under Units — otherwise the estimate is blocked.</Notice>
        <PackageOptions line={line} fields={optUnits} templateId={templateId} /></>}
      {tab === "rates" && <PackageOptions line={line} fields={optRates} templateId={templateId} />}
      {tab === "visibility" && <LineForm line={line} fields={vis} onSaved={onSaved} tid="li-vis" />}
      {tab === "notes" && <LineForm line={line} fields={notes} onSaved={onSaved} tid="li-notes" />}
      {tab === "history" && <HistoryPanel resource="line_items" id={line.id} />}
    </Card>
  );
}

export default function LineItems() {
  const { templateId } = useTemplate();
  const [searchParams] = useSearchParams();
  const secs = useList("sections", { template_id: templateId });
  const subs = useList("subsections", { template_id: templateId });
  const lines = useList("line_items", { template_id: templateId });
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState({});
  const current = lines.rows.find((l) => l.id === sel);
  useEffect(() => {
    const requestedLine = searchParams.get("line");
    if (requestedLine && lines.rows.some((line) => line.id === requestedLine)) setSel(requestedLine);
  }, [lines.rows, searchParams]);
  const filtered = useMemo(() => lines.rows.filter((l) => !q || `${l.code} ${l.name}`.toLowerCase().includes(q.toLowerCase())), [lines.rows, q]);
  const add = async (section_id, subsection_id) => {
    const code = prompt("New line item code (unique, e.g. PLB-01)");
    if (!code) return;
    try { const out = await save("line_items", { template_id: templateId, section_id, subsection_id, code, name: "New line item", quantity_mode: "FIXED_QUANTITY", inclusion_default: "INCLUDED", client_visible: true, client_price_visibility: "SHOW_RATE" }); await lines.reload(); setSel(out.id); } catch (e) { notifyError(e); }
  };
  const act = async (a) => { try { const r = await api.post(`/r/line_items/${sel}/${a}`); toast.success(a === "duplicate" ? "Duplicated" : "Archived"); await lines.reload(); setSel(a === "duplicate" ? r.data.id : null); } catch (e) { notifyError(e); } };
  const item = (l) => (
    <button key={l.id} data-testid={`tree-line-${l.code}`} onClick={() => setSel(l.id)}
      className={cx("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors", sel === l.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}>
      <span className="num w-16 shrink-0 text-[11px] text-muted-foreground">{l.code}</span><span className="truncate">{l.name}</span></button>
  );
  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Line items" subtitle="Each line item can carry a different specification, inclusion, unit, quantity rule and rate per package."
        actions={current && <><Button variant="outline" data-testid="line-duplicate-btn" onClick={() => act("duplicate")}><Copy size={15} /> Duplicate</Button><Button variant="outline" data-testid="line-archive-btn" onClick={() => act("archive")}><Archive size={15} /> Archive</Button></>} />
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit p-3 lg:sticky lg:top-24" data-testid="line-tree">
          <div className="relative mb-3"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><Input data-testid="line-search" className="pl-9" placeholder="Search code or name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="max-h-[65vh] overflow-y-auto">
            {secs.rows.map((s) => {
              const sl = filtered.filter((l) => l.section_id === s.id);
              const isOpen = open[s.id] ?? !!q;
              return (
                <div key={s.id} className="mb-1">
                  <button className="flex w-full items-center gap-1 rounded px-1 py-1.5 text-sm font-semibold hover:bg-muted" data-testid={`tree-section-${s.id}`} onClick={() => setOpen((o) => ({ ...o, [s.id]: !isOpen }))}>
                    <ChevronRight size={14} className={cx("transition-transform", isOpen && "rotate-90")} />{s.name}<span className="ml-auto text-xs font-normal text-muted-foreground">{sl.length}</span></button>
                  {isOpen && <div className="ml-4 border-l border-border pl-2">
                    {sl.filter((l) => !l.subsection_id).map(item)}
                    {subs.rows.filter((x) => x.section_id === s.id).map((ss) => (
                      <div key={ss.id} className="mt-1"><div className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{ss.name}</div>
                        {sl.filter((l) => l.subsection_id === ss.id).map(item)}
                        <button className="px-2 py-1 text-xs text-primary" data-testid={`add-line-sub-${ss.id}`} onClick={() => add(s.id, ss.id)}>+ add here</button></div>
                    ))}
                    <button className="flex items-center gap-1 px-2 py-1 text-xs text-primary" data-testid={`add-line-${s.id}`} onClick={() => add(s.id, null)}><Plus size={12} /> add line item</button>
                  </div>}
                </div>
              );
            })}
          </div>
        </Card>
        {current ? <Editor line={current} templateId={templateId} onSaved={() => lines.reload()} /> : <Empty title="Select a line item">Pick an item from the tree, or add one under any section or subsection.</Empty>}
      </div>
    </div>
  );
}
