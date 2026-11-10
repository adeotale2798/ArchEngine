import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Bath, Building, Check, Download, FileSpreadsheet, FileText, Info, Lock, Minus, Plus, RotateCcw, Sheet, Star, TriangleAlert } from "lucide-react";
import { inr, STATUS } from "@/lib/format";
import { Badge, Button, Card, Notice, cx } from "./ui";
import PackageComparison from "@/components/PackageComparison";

const STEPS = [["intro", "Welcome"], ["brief", "Building brief"], ["package", "Package"], ["specs", "Specifications"], ["summary", "Summary & download"]];
const ICONS = { total_floors: Building, total_bathrooms: Bath };
const FMT = { pdf: [FileText, "PDF estimate"], xlsx: [FileSpreadsheet, "Excel workbook"], csv: [Sheet, "CSV (line items)"] };
const TYPE_FINANCIAL_ROWS = [
  { label: "Plinth Level", description: "Excavation, anti-termite, backfilling, RCC foundation and plinth work.", values: { TYPE_A: 750, TYPE_B: 800, TYPE_C: 850 } },
  { label: "Ground Floor Roof", description: "RCC roof slab, masonry, plaster, columns, lintels and finishing items above plinth level.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
  { label: "Upper Floor Roofs (per floor)", description: "RCC roof slab, beams, masonry, plaster and typical upper-floor finish items for each floor.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
  { label: "Terrace Level Slab", description: "Terrace slab, waterproofing preparation and related terrace structure items.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
  { label: "Site development", description: "Filling, anti-termite treatment, landscape, parking and marginal space work.", values: { TYPE_A: 475, TYPE_B: 500, TYPE_C: 550 } },
  { label: "Water tank (UG + OHT)", description: "Underground and overhead water tank RCC and waterproofing work.", values: { TYPE_A: 21, TYPE_B: 23, TYPE_C: 25 } },
  { label: "Compound wall", description: "Boundary wall and elevation treatment as specified.", values: { TYPE_A: 350, TYPE_B: 350, TYPE_C: 350 } },
  { label: "Parapet Wall", description: "Parapet wall and MS pipe work as per design.", values: { TYPE_A: 250, TYPE_B: 250, TYPE_C: 250 } },
  { label: "Terrace Waterproofing", description: "Brickbat coba and waterproofing layer on the terrace.", values: { TYPE_A: 120, TYPE_B: 120, TYPE_C: 120 } },
];

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
    <Card className="animate-card-rise p-8 shadow-[0_18px_40px_-24px_rgba(60,40,20,.25)]" data-testid={`brief-${def.key}`}>
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
    <Card className="sticky top-6 animate-card-rise space-y-3 bg-card/95 p-6 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl" data-testid="cost-dock">
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

function getPackageSortKey(pkg) {
  const raw = `${pkg?.code || ""} ${pkg?.name || ""}`.toUpperCase();
  if (/TYPE[_\s-]*A/.test(raw)) return "A";
  if (/TYPE[_\s-]*B/.test(raw)) return "B";
  if (/TYPE[_\s-]*C/.test(raw)) return "C";
  if (raw.includes("ONLY_CIVIL") || /civil/i.test(pkg?.name || "")) return "ZZZ_CIVIL";
  return `ZZZ_${raw || pkg?.id || "UNKNOWN"}`;
}

export default function EstimateWizard({ meta, inputDefs, packages, packageTotals = {}, optionsByLine = {}, state, result, editable, busy, onUpdate, exportFormats = [], onDownload, prevTotal }) {
  const [step, setStep] = useState("intro");
  const [packageOverrides, setPackageOverrides] = useState(() => state.package_id ? { [state.package_id]: state.overrides || {} } : {});
  const lines = result?.lines || [];
  const comparisonOptions = useMemo(() => Object.values(optionsByLine).flat(), [optionsByLine]);
  const orderedPackages = useMemo(() => [...packages].sort((a, b) => {
    const keyA = getPackageSortKey(a);
    const keyB = getPackageSortKey(b);
    const order = { A: 0, B: 1, C: 2 };
    if (keyA in order && keyB in order) return order[keyA] - order[keyB];
    if (keyA in order) return -1;
    if (keyB in order) return 1;
    if (keyA === "ZZZ_CIVIL" && keyB !== "ZZZ_CIVIL") return 1;
    if (keyA !== "ZZZ_CIVIL" && keyB === "ZZZ_CIVIL") return -1;
    return String(a?.name || a?.code || a?.id).localeCompare(String(b?.name || b?.code || b?.id));
  }), [packages]);
  const typePackages = useMemo(() => orderedPackages.filter((pkg) => pkg.code !== "ONLY_CIVIL" && !/civil/i.test(pkg.name || "")), [orderedPackages]);
  const civilPackages = useMemo(() => orderedPackages.filter((pkg) => pkg.code === "ONLY_CIVIL" || /civil/i.test(pkg.name || "")), [orderedPackages]);
  const typeLineIds = useMemo(() => new Set(comparisonOptions.filter((option) => typePackages.some((pkg) => pkg.id === option.package_id))
    .map((option) => option.line_item_id)), [comparisonOptions, typePackages]);
  const civilLineIds = useMemo(() => new Set(comparisonOptions.filter((option) => civilPackages.some((pkg) => pkg.id === option.package_id))
    .map((option) => option.line_item_id)), [comparisonOptions, civilPackages]);
  const typeLines = useMemo(() => lines.filter((line) => typeLineIds.has(line.line_item_id)), [lines, typeLineIds]);
  const civilLines = useMemo(() => lines.filter((line) => civilLineIds.has(line.line_item_id)), [lines, civilLineIds]);
  const linesBySection = useMemo(() => (result?.sections || []).map((s) => ({ ...s, lines: lines.filter((l) => l.section_id === s.id) })), [result, lines]);
  const next = () => setStep(STEPS[Math.min(STEPS.findIndex((s) => s[0] === step) + 1, STEPS.length - 1)][0]);
  const prev = () => setStep(STEPS[Math.max(STEPS.findIndex((s) => s[0] === step) - 1, 0)][0]);
  const setOverride = (lid, patch) => {
    const overrides = { ...state.overrides, [lid]: { ...(state.overrides?.[lid] || {}), ...patch } };
    setPackageOverrides((current) => ({ ...current, [state.package_id]: overrides }));
    onUpdate({ overrides });
  };
  const resetOne = (lid) => {
    const overrides = { ...state.overrides };
    delete overrides[lid];
    setPackageOverrides((current) => ({ ...current, [state.package_id]: overrides }));
    onUpdate({ overrides });
  };
  const selectPackage = (packageId) => {
    const overrides = packageOverrides[packageId] || {};
    setPackageOverrides((current) => ({ ...current, [packageId]: overrides }));
    onUpdate({ package_id: packageId, overrides });
  };
  const setComparisonOption = (targetPackageId, lineId, sourcePackageId) => {
    const nextForTarget = { ...(packageOverrides[targetPackageId] || (targetPackageId === state.package_id ? state.overrides : {})) };
    if (sourcePackageId) nextForTarget[lineId] = { ...(nextForTarget[lineId] || {}), option_package_id: sourcePackageId };
    else {
      const current = { ...(nextForTarget[lineId] || {}) };
      delete current.option_package_id;
      if (Object.keys(current).length) nextForTarget[lineId] = current;
      else delete nextForTarget[lineId];
    }
    setPackageOverrides((current) => ({ ...current, [targetPackageId]: nextForTarget }));
    if (targetPackageId === state.package_id) onUpdate({ overrides: nextForTarget });
  };
  const nOverrides = Object.keys(state.overrides || {}).length;
  return (
    <div className="mx-auto max-w-6xl px-3 py-5 sm:px-4 md:px-8 md:py-10">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/80 p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.32)] backdrop-blur-sm">
        <div><div className="font-display text-2xl font-extrabold" data-testid="org-brand" style={{ color: meta.org?.branding?.primary_color }}>{meta.org?.name}</div>
          <div className="text-xs text-muted-foreground">{meta.org?.branding?.tagline}</div></div>
        <div className="text-right text-xs text-muted-foreground"><div className="num font-semibold text-foreground" data-testid="estimate-number">{meta.number}{meta.revision ? ` · rev ${meta.revision.revision_number}` : ""}</div>
          {meta.revision && <Badge tone={STATUS[meta.revision.status]?.tone}>{STATUS[meta.revision.status]?.label}</Badge>}</div>
      </header>
      <Stepper step={step} setStep={setStep} />
      {!editable && <Notice tone="info" icon={Lock} className="mb-6">This estimate is locked for review or has been issued. You can view and download it; ask your architect for a revision to make changes.</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:gap-10">
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
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="client-package-options">
                {orderedPackages.map((p) => { const active = state.package_id === p.id; return (
                  <button key={p.id} disabled={!editable} data-testid={`package-option-${p.code}`} onClick={() => selectPackage(p.id)}
                    className={cx("group relative overflow-hidden rounded-2xl border-2 bg-card text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]", active ? "border-primary shadow-xl shadow-primary/10" : "border-border")}> 
                    <div className="h-44 overflow-hidden bg-muted">{p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 animate-glow" />}</div>
                    {p.is_recommended && <Badge tone="primary" className="absolute right-3 top-3 bg-white"><Star size={11} /> Recommended</Badge>}
                    <div className="p-6"><div className="flex items-center justify-between"><span className="font-display text-2xl font-semibold">{p.name}</span>{active && <Check className="text-primary" />}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                      {packageTotals[p.id] && <div className="num mt-4 text-lg font-semibold" data-testid={`package-total-${p.code}`}>{inr(packageTotals[p.id].grand_total)}{!packageTotals[p.id].complete && <span className="ml-2 text-xs text-warning">needs review</span>}</div>}</div>
                  </button>); })}
              </div>
              <div className="mt-8 space-y-5" data-testid="client-package-comparison">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Compare packages</div>
                    <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Compare specifications</h3>
                  </div>
                  <p className="max-w-xl text-sm text-muted-foreground">Drag an item between the packages in your link. Civil Work stays separate from the package specifications.</p>
                </div>

                <div className={cx("grid items-start gap-5", civilPackages.length && "xl:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]")}>
                  {typePackages.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-50 px-4 py-3">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Main package comparison</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {typePackages.map((pkg) => (
                            <div key={pkg.id} className={cx("rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]", state.package_id === pkg.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-white text-slate-500")}>
                              {pkg.name}
                            </div>
                          ))}
                        </div>
                      </div>
                      <PackageComparison packages={typePackages} allPackages={packages}
                        lines={typeLines} options={comparisonOptions} overrides={Object.fromEntries(
                          Object.entries(packageOverrides).map(([packageId, packageLines]) => [packageId,
                            Object.fromEntries(Object.entries(packageLines || {}).map(([lineId, override]) => [lineId, override.option_package_id]).filter(([, sourceId]) => !!sourceId))]),
                        )} results={result && state.package_id ? { [state.package_id]: { lines } } : {}}
                        editable={editable} showRates={false} selectedPackageId={state.package_id}
                        lockedPackageIds={packages.filter((pkg) => pkg.code === "ONLY_CIVIL" || /civil/i.test(pkg.name || "")).map((pkg) => pkg.id)}
                        onOverrideChange={setComparisonOption} />
                    </div>
                  )}

                  {civilPackages.length > 0 && (
                    <div className="space-y-3 rounded-2xl border border-border bg-slate-50 p-3 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.5)]">
                      <div className="flex items-center justify-between gap-2 px-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Civil work</div>
                        <Badge tone="secondary">Separate</Badge>
                      </div>
                      {civilPackages.map((pkg) => (
                        <section key={pkg.id} className="min-w-0 overflow-hidden rounded-xl border border-border bg-white" data-testid="client-civil-comparison">
                          {civilLines.length > 0 ? <PackageComparison packages={[pkg]} allPackages={packages}
                            lines={civilLines} options={comparisonOptions} overrides={Object.fromEntries(
                              Object.entries(packageOverrides).map(([packageId, packageLines]) => [packageId,
                                Object.fromEntries(Object.entries(packageLines || {}).map(([lineId, override]) => [lineId, override.option_package_id]).filter(([, sourceId]) => !!sourceId))]),
                            )} results={result && state.package_id ? { [state.package_id]: { lines } } : {}}
                            editable={editable} showRates={false} selectedPackageId={state.package_id}
                            lockedPackageIds={[pkg.id]} onOverrideChange={setComparisonOption} />
                            : <div className="rounded-lg border border-border p-4 text-xs text-muted-foreground">No Civil Work items are configured for this estimate.</div>}
                        </section>
                      ))}
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_35px_-32px_rgba(15,23,42,0.38)]">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-slate-50 px-4 py-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Financials</div>
                    <Badge tone="info">Type A · B · C</Badge>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                      <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="border-b border-r border-border px-3 py-3">Sr. No</th>
                          <th className="border-b border-r border-border px-3 py-3">Floor level</th>
                          <th className="border-b border-r border-border px-3 py-3">Description</th>
                          <th className="border-b border-r border-border px-3 py-3 text-right">Type A</th>
                          <th className="border-b border-r border-border px-3 py-3 text-right">Type B</th>
                          <th className="border-b border-border px-3 py-3 text-right">Type C</th>
                        </tr>
                      </thead>
                      <tbody>
                        {TYPE_FINANCIAL_ROWS.map((row, index) => (
                          <tr key={row.label} className="align-top text-[13px]">
                            <td className="border-b border-r border-border px-3 py-3 font-semibold text-muted-foreground">{index + 1}</td>
                            <td className="border-b border-r border-border px-3 py-3 font-medium">{row.label}</td>
                            <td className="border-b border-r border-border px-3 py-3 text-muted-foreground">{row.description}</td>
                            <td className="border-b border-r border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_A}</td>
                            <td className="border-b border-r border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_B}</td>
                            <td className="border-b border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_C}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div></div>) }
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.5)] backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-md items-center justify-between rounded-2xl border border-border bg-card px-4 py-2.5 text-sm shadow-sm"><span className="font-medium">Indicative total</span><span className="num font-semibold text-primary" data-testid="mobile-grand-total">{inr(result?.totals?.grand_total)}</span></div></div>
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
