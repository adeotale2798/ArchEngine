import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bath, Building, Check, Download, FileSpreadsheet, FileText, Info, Lock, Minus, Plus, RotateCcw, Sheet, Star, TriangleAlert } from "lucide-react";
import { inr, STATUS } from "@/lib/format";
import { Badge, Button, Card, Notice, cx } from "./ui";

const STEPS = [["intro", "Welcome"], ["brief", "Building brief"], ["package", "Package"], ["specs", "Specifications"], ["summary", "Summary & download"]];
const ICONS = { total_floors: Building, total_bathrooms: Bath };
const FMT = { pdf: [FileText, "PDF estimate"], xlsx: [FileSpreadsheet, "Excel workbook"], csv: [Sheet, "CSV (line items)"] };

function Stepper({ step, setStep }) {
  return (
    <ol className="mb-10 flex flex-wrap gap-2" data-testid="wizard-steps">
      {STEPS.map(([k, l], i) => { const idx = STEPS.findIndex((s) => s[0] === step); return (
        <li key={k}><button data-testid={`step-${k}`} onClick={() => setStep(k)} className={cx("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
          k === step ? "border-primary bg-primary text-white" : i < idx ? "border-primary/40 text-primary" : "border-border text-muted-foreground hover:bg-muted")}>
          <span className="num">{i < idx ? <Check size={12} /> : i + 1}</span>{l}</button></li>); })}
    </ol>
  );
}

function Counter({ def, value, onChange, disabled }) {
  const Icon = ICONS[def.key] || Info;
  const n = Number(value ?? 0);
  const lo = def.min_value != null ? Number(def.min_value) : 0;
  const hi = def.max_value != null ? Number(def.max_value) : 999;
  return (
    <Card className="p-8 shadow-[0_10px_30px_-15px_rgba(60,40,20,.25)]" data-testid={`brief-${def.key}`}>
      <div className="flex items-start gap-4"><div className="rounded-lg bg-primary/10 p-3 text-primary"><Icon size={26} /></div>
        <div className="flex-1"><div className="font-display text-xl font-semibold">{def.label}</div><p className="mt-1 text-sm text-muted-foreground">{def.help_text}</p></div></div>
      <div className="mt-6 flex items-center gap-5">
        <Button variant="outline" size="lg" aria-label={`Decrease ${def.label}`} data-testid={`brief-${def.key}-minus`} disabled={disabled || n <= lo} onClick={() => onChange(String(n - 1))}><Minus size={18} /></Button>
        <div className="num w-20 text-center text-5xl font-semibold" data-testid={`brief-${def.key}-value`}>{n}</div>
        <Button variant="outline" size="lg" aria-label={`Increase ${def.label}`} data-testid={`brief-${def.key}-plus`} disabled={disabled || n >= hi} onClick={() => onChange(String(n + 1))}><Plus size={18} /></Button>
        <span className="text-xs text-muted-foreground">allowed {lo}–{hi}</span>
      </div>
    </Card>
  );
}

function CostDock({ result, prevTotal, busy }) {
  const t = result?.totals;
  const delta = prevTotal != null && t ? Number(t.grand_total) - Number(prevTotal) : 0;
  return (
    <Card className="sticky top-6 space-y-3 bg-card/95 p-6 backdrop-blur-xl" data-testid="cost-dock">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Indicative budget · {result?.package?.name}</div>
      <div className={cx("num text-4xl font-semibold transition-opacity", busy && "opacity-50")} data-testid="grand-total">{inr(t?.grand_total)}</div>
      {delta !== 0 && <div className={cx("num text-sm font-semibold", delta > 0 ? "text-danger" : "text-success")} data-testid="total-delta">{delta > 0 ? "+" : "−"}{inr(Math.abs(delta))} from your last change</div>}
      <div className="space-y-1.5 border-t border-border pt-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="num" data-testid="subtotal">{inr(t?.subtotal)}</span></div>
        {t?.contingency_enabled && <div className="flex justify-between"><span>Contingency ({t.contingency_rate}%)</span><span className="num" data-testid="contingency">{inr(t.contingency)}</span></div>}
        {t?.tax_enabled && <div className="flex justify-between"><span>{t.tax_label} ({t.tax_rate}%)</span><span className="num" data-testid="tax">{inr(t.tax)}</span></div>}
      </div>
      {result?.issues?.length > 0 && <div className="space-y-1 border-t border-border pt-3">{result.issues.slice(0, 4).map((i, n) => <div key={n} className="flex gap-2 text-xs text-warning"><TriangleAlert size={13} className="shrink-0" />{i.message}</div>)}</div>}
    </Card>
  );
}

export default function EstimateWizard({ meta, inputDefs, packages, packageTotals = {}, optionsByLine = {}, state, result, editable, busy, onUpdate, exportFormats = [], onDownload, prevTotal }) {
  const [step, setStep] = useState("intro");
  const lines = result?.lines || [];
  const linesBySection = useMemo(() => (result?.sections || []).map((s) => ({ ...s, lines: lines.filter((l) => l.section_id === s.id) })), [result, lines]);
  const next = () => setStep(STEPS[Math.min(STEPS.findIndex((s) => s[0] === step) + 1, STEPS.length - 1)][0]);
  const prev = () => setStep(STEPS[Math.max(STEPS.findIndex((s) => s[0] === step) - 1, 0)][0]);
  const setOverride = (lid, patch) => onUpdate({ overrides: { ...state.overrides, [lid]: { ...(state.overrides?.[lid] || {}), ...patch } } });
  const resetOne = (lid) => { const o = { ...state.overrides }; delete o[lid]; onUpdate({ overrides: o }); };
  const nOverrides = Object.keys(state.overrides || {}).length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><div className="font-display text-2xl font-extrabold" data-testid="org-brand" style={{ color: meta.org?.branding?.primary_color }}>{meta.org?.name}</div>
          <div className="text-xs text-muted-foreground">{meta.org?.branding?.tagline}</div></div>
        <div className="text-right text-xs text-muted-foreground"><div className="num font-semibold text-foreground" data-testid="estimate-number">{meta.number}{meta.revision ? ` · rev ${meta.revision.revision_number}` : ""}</div>
          {meta.revision && <Badge tone={STATUS[meta.revision.status]?.tone}>{STATUS[meta.revision.status]?.label}</Badge>}</div>
      </header>
      <Stepper step={step} setStep={setStep} />
      {!editable && <Notice tone="info" icon={Lock} className="mb-6">This estimate is locked for review or has been issued. You can view and download it; ask your architect for a revision to make changes.</Notice>}
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 animate-rise" key={step}>
          {step === "intro" && (
            <div className="grid items-center gap-10 md:grid-cols-[1.1fr_1fr]" data-testid="step-intro-panel">
              <div><div className="font-mono text-xs uppercase tracking-[.3em] text-primary">Your estimate</div>
                <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-5xl">{meta.title}</h1>
                <p className="mt-4 text-muted-foreground">{meta.template?.intro_text}</p>
                <ul className="mt-6 space-y-2 text-sm">{["Tell us floors and bathrooms — no measurements", "Choose a package and compare", "Adjust permitted specifications", "Download PDF, Excel or CSV"].map((x) => <li key={x} className="flex gap-2"><Check size={16} className="text-primary" />{x}</li>)}</ul>
                <Button size="lg" className="mt-8" data-testid="intro-start-btn" onClick={next}>Start <ArrowRight size={16} /></Button></div>
              <img src={meta.template?.hero_image_url || "https://images.unsplash.com/photo-1603901622056-0a5bee231395?w=1200&q=70"} alt="Architectural drawings on a desk" className="h-80 w-full rounded-lg object-cover shadow-xl md:h-[420px]" />
            </div>)}
          {step === "brief" && (
            <div className="space-y-6" data-testid="step-brief-panel">
              <h2 className="text-3xl font-bold">Building brief</h2>
              <p className="text-muted-foreground">Only building-level counts. Your architect's rules turn these into foundation, slab and bathroom quantities — watch the budget update.</p>
              {inputDefs.map((d) => d.input_type === "integer" || d.input_type === "decimal"
                ? <Counter key={d.key} def={d} value={state.inputs?.[d.key]} disabled={!editable || d.client_editable === false} onChange={(v) => onUpdate({ inputs: { ...state.inputs, [d.key]: v } })} />
                : <Card key={d.key} className="p-6"><b>{d.label}</b>: {String(state.inputs?.[d.key] ?? "—")}</Card>)}
              <ImpactList lines={lines.filter((l) => ["PER_FLOOR", "PER_BATHROOM", "FLOOR_BAND_LOOKUP", "INPUT_MULTIPLIER"].includes(l.quantity_mode) || l.client_trace?.match(/Floors|Bathrooms|floors/))} />
            </div>)}
          {step === "package" && (
            <div data-testid="step-package-panel"><h2 className="mb-6 text-3xl font-bold">Choose a package</h2>
              <div className="grid gap-6 sm:grid-cols-2">
                {packages.map((p) => { const active = state.package_id === p.id; return (
                  <button key={p.id} disabled={!editable} data-testid={`package-option-${p.code}`} onClick={() => onUpdate({ package_id: p.id })}
                    className={cx("group relative overflow-hidden rounded-lg border-2 bg-card text-left transition-transform hover:-translate-y-1", active ? "border-primary shadow-xl" : "border-border")}>
                    <div className="h-44 overflow-hidden bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}</div>
                    {p.is_recommended && <Badge tone="primary" className="absolute right-3 top-3 bg-white"><Star size={11} /> Recommended</Badge>}
                    <div className="p-6"><div className="flex items-center justify-between"><span className="font-display text-2xl font-semibold">{p.name}</span>{active && <Check className="text-primary" />}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                      {packageTotals[p.id] && <div className="num mt-4 text-lg font-semibold" data-testid={`package-total-${p.code}`}>{inr(packageTotals[p.id].grand_total)}{!packageTotals[p.id].complete && <span className="ml-2 text-xs text-warning">needs review</span>}</div>}</div>
                  </button>); })}
              </div></div>)}
          {step === "specs" && (
            <div className="space-y-8" data-testid="step-specs-panel">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-3xl font-bold">Specifications</h2>
                {editable && <Button variant="outline" disabled={!nOverrides} data-testid="reset-all-btn" onClick={() => onUpdate({ overrides: {} })}><RotateCcw size={14} /> Reset all to package ({nOverrides})</Button>}</div>
              {linesBySection.map((s) => (
                <section key={s.id} data-testid={`spec-section-${s.code || s.id}`}>
                  <div className="mb-3 flex items-end gap-4">{s.image_url && <img src={s.image_url} alt="" className="h-14 w-20 rounded object-cover" />}
                    <h3 className="text-xl font-semibold">{s.name}</h3><span className="num ml-auto text-sm text-muted-foreground">{inr(s.subtotal)}</span></div>
                  <div className="divide-y divide-border rounded-lg border border-border bg-card">
                    {s.lines.map((l) => <SpecRow key={l.line_item_id} l={l} editable={editable} options={optionsByLine[l.line_item_id] || []} onPick={(pid) => setOverride(l.line_item_id, { option_package_id: pid })}
                      onToggle={(v) => setOverride(l.line_item_id, { selected: v })} onReset={() => resetOne(l.line_item_id)} hasOverride={!!state.overrides?.[l.line_item_id]} />)}
                  </div>
                </section>))}
            </div>)}
          {step === "summary" && (
            <div className="space-y-8" data-testid="step-summary-panel">
              <h2 className="text-3xl font-bold">Estimate summary</h2>
              <Card className="divide-y divide-border">{(result?.sections || []).map((s) => <div key={s.id} className="flex justify-between px-6 py-3 text-sm" data-testid={`summary-section-${s.code || s.id}`}><span>{s.name}</span><span className="num">{inr(s.subtotal)}</span></div>)}
                <div className="flex justify-between bg-muted/50 px-6 py-4 font-semibold"><span>Grand total (indicative)</span><span className="num" data-testid="summary-grand-total">{inr(result?.totals?.grand_total)}</span></div></Card>
              <p className="text-xs text-muted-foreground">{result?.totals?.basis}</p>
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="p-6"><h3 className="mb-3 font-semibold">Assumptions</h3><ul className="space-y-1.5 text-sm" data-testid="assumptions-list">{(result?.assumptions || []).map((a) => <li key={a}>• {a}</li>)}
                  {lines.filter((l) => l.is_assumption).map((l) => <li key={l.line_item_id} className="text-muted-foreground">• {l.name}: indicative template quantity</li>)}</ul></Card>
                <Card className="p-6"><h3 className="mb-3 font-semibold">Exclusions</h3><ul className="space-y-1.5 text-sm" data-testid="exclusions-list">{(result?.exclusions || []).map((a) => <li key={a}>• {a}</li>)}</ul></Card>
              </div>
              <Notice tone="warning" icon={Info}>{result?.disclaimer}</Notice>
              <div><h3 className="mb-3 font-semibold">Download</h3><div className="flex flex-wrap gap-3">
                {exportFormats.map((f) => { const [I, l] = FMT[f]; return <Button key={f} size="lg" variant={f === "pdf" ? "primary" : "outline"} data-testid={`download-${f}-btn`} onClick={() => onDownload(f)}><I size={17} />{l}<Download size={14} /></Button>; })}
                {exportFormats.length === 0 && <span className="text-sm text-muted-foreground">Downloads are not enabled for this estimate.</span>}</div></div>
            </div>)}
          <div className="mt-10 flex justify-between">{step !== "intro" && <Button variant="ghost" data-testid="wizard-back-btn" onClick={prev}><ArrowLeft size={15} /> Back</Button>}
            {step !== "summary" && step !== "intro" && <Button className="ml-auto" data-testid="wizard-next-btn" onClick={next}>Continue <ArrowRight size={15} /></Button>}</div>
        </div>
        <div className="hidden lg:block"><CostDock result={result} prevTotal={prevTotal} busy={busy} /></div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-5 py-3 backdrop-blur-xl lg:hidden"><div className="flex justify-between text-sm"><span>Indicative total</span><span className="num font-semibold" data-testid="mobile-grand-total">{inr(result?.totals?.grand_total)}</span></div></div>
    </div>
  );
}

function ImpactList({ lines }) {
  if (!lines.length) return null;
  return (
    <Card className="p-6" data-testid="brief-impact">
      <h3 className="mb-3 font-semibold">How your brief drives the estimate</h3>
      <ul className="space-y-3 text-sm">{lines.map((l) => <li key={l.line_item_id} className="flex flex-wrap justify-between gap-2"><div><b>{l.name}</b><div className="num text-xs text-muted-foreground">{l.client_trace}</div></div>
        <span className="num">{l.status === "INCLUDED" || l.status === "REQUIRES_REVIEW" ? inr(l.amount) : STATUS[l.status]?.label}</span></li>)}</ul>
    </Card>
  );
}

function SpecRow({ l, options, editable, onPick, onToggle, onReset, hasOverride }) {
  const st = STATUS[l.status] || { label: l.status, tone: "muted" };
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1fr_auto]" data-testid={`spec-row-${l.code}`}>
      <div><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{l.name}</span><Badge tone={st.tone}>{st.label}</Badge>{l.is_overridden && <Badge tone="primary">your choice</Badge>}{l.is_assumption && <Badge>indicative qty</Badge>}</div>
        <div className="mt-1 text-sm">{l.specification}</div>
        {l.client_notes && <div className="mt-1 text-xs text-muted-foreground">{l.client_notes}</div>}
        {editable && l.can_change_option && options.length > 1 && (
          <div className="mt-2 flex flex-wrap items-center gap-2"><select aria-label={`Change specification for ${l.name}`} data-testid={`spec-select-${l.code}`} className="h-9 rounded-md border border-border bg-card px-2 text-sm" value={l.spec_source_package_id || ""} onChange={(e) => onPick(e.target.value)}>
            {options.map((o) => <option key={o.package_id} value={o.package_id}>{o.package_name}: {o.label}</option>)}</select>
            {hasOverride && <Button variant="ghost" size="sm" data-testid={`spec-reset-${l.code}`} onClick={onReset}><RotateCcw size={13} /> Reset</Button>}</div>)}
        {editable && l.inclusion === "OPTIONAL" && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" data-testid={`optional-toggle-${l.code}`} checked={!!l.optional_selected} onChange={(e) => onToggle(e.target.checked)} /> Include this optional item</label>}
      </div>
      <div className="text-right text-sm"><div className="num">{l.quantity && l.status !== "INCLUDED_IN_RATE" ? `${l.quantity} ${l.unit || ""}` : ""}{l.rate ? ` × ${inr(l.rate)}` : ""}</div>
        <div className="num font-semibold">{l.amount && Number(l.amount) > 0 ? inr(l.amount) : ""}</div></div>
    </div>
  );
}
