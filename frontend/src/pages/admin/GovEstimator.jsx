import { useEffect, useMemo, useState } from "react";
import { Download, Landmark, RotateCcw, Settings2 } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader } from "@/components/ui";
import { inr } from "@/lib/format";
import {
  calculateGovEstimate,
  createGovEstimatorDefaults,
  GOV_ITEMS,
  GOV_MATERIALS,
  GOV_ESTIMATOR_STORAGE_KEY,
  readGovEstimatorInputs,
} from "@/lib/govEstimator";

const money = (value) => inr(value, { dp: 2 });
function downloadCsv(inputs, result) {
  const rows = [
    ["Government Project Estimator · Sheet 1"],
    ["Tender name", inputs.tenderName],
    ["Tender place", inputs.tenderPlace],
    ["Construction area", inputs.constructionArea],
    ["Labour rate", inputs.labourRate],
    [],
    ["Raw material rates"],
    ["Material", "Editable local rate"],
    ...GOV_MATERIALS.map((material) => [material.label, result.rates[material.key].localRate]),
    [],
    ["Item", "Quantity", "Unit", ...GOV_MATERIALS.map((material) => `${material.label} consumption per unit`), "R · Row cost (₹)"],
  ];
  for (const group of result.groups) {
    rows.push([group.name]);
    for (const item of group.items) {
      rows.push([
        `${item.code} · ${item.name}`, item.quantity, item.unit,
        ...GOV_MATERIALS.map((material) => item.coefficients[material.key] ?? ""),
        item.amount,
      ]);
    }
  }
  rows.push([], ["Material totals", ...GOV_MATERIALS.map((material) => result.materialTotals[material.key])],
    ["Materials subtotal", result.materialsTotal], ["Labour cost", result.labourCost], ["Estimated total", result.grandTotal]);
  const csv = rows.map((row) => row.map((cell) => {
    const value = String(cell ?? "");
    return `"${value.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "government-project-estimate.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function GovEstimator() {
  const [inputs, setInputs] = useState(readGovEstimatorInputs);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const result = useMemo(() => calculateGovEstimate(inputs), [inputs]);

  useEffect(() => {
    try { localStorage.setItem(GOV_ESTIMATOR_STORAGE_KEY, JSON.stringify(inputs)); } catch { /* keep the calculator usable if storage is unavailable */ }
  }, [inputs]);

  const patch = (key, value) => setInputs((current) => ({ ...current, [key]: value }));
  const patchRate = (key, value) => setInputs((current) => ({ ...current, materialRates: { ...current.materialRates, [key]: value } }));
  const patchMultiplier = (key, value) => setInputs((current) => ({ ...current, calculationSettings: {
    ...current.calculationSettings,
    materialRateMultipliers: { ...current.calculationSettings.materialRateMultipliers, [key]: value },
  } }));
  const patchQuantity = (code, value) => setInputs((current) => ({ ...current, itemQuantities: { ...current.itemQuantities, [code]: value } }));
  const reset = () => setInputs(createGovEstimatorDefaults());

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden" data-testid="gov-estimator">
      <PageHeader eyebrow="Workspace · Government projects" title="Government project estimator"
        subtitle="Editable project quantities, material rates, and consumption schedule for government tender estimates."
        actions={<>
          <Button variant="outline" data-testid="gov-calculation-settings-open" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /> Calculation settings</Button>
          <Button variant="outline" data-testid="gov-estimator-reset" onClick={reset}><RotateCcw size={15} /> Reset inputs</Button>
          <Button data-testid="gov-estimator-export" onClick={() => downloadCsv(inputs, result)}><Download size={15} /> Export CSV</Button>
        </>} />

      <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <Card className="grid min-w-0 gap-4 p-4 sm:grid-cols-2" data-testid="gov-project-details">
          <div className="sm:col-span-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Tender details</div>
            <h2 className="mt-1 text-xl font-bold">Project inputs</h2></div>
          <Field label="Tender name"><Input data-testid="gov-tender-name" value={inputs.tenderName} onChange={(event) => patch("tenderName", event.target.value)} placeholder="Enter tender / project name" /></Field>
          <Field label="Tender place"><Input data-testid="gov-tender-place" value={inputs.tenderPlace} onChange={(event) => patch("tenderPlace", event.target.value)} placeholder="Enter project location" /></Field>
          <Field label="Construction area" help="Set the project construction area.">
            <Input data-testid="gov-construction-area" type="number" min="0" step="any" value={inputs.constructionArea} onChange={(event) => patch("constructionArea", event.target.value)} />
          </Field>
          <Field label="Labour rate" help="Set the applicable labour rate.">
            <Input data-testid="gov-labour-rate" type="number" min="0" step="any" value={inputs.labourRate} onChange={(event) => patch("labourRate", event.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-3 p-4" data-testid="gov-estimate-summary">
          <div><div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Live estimate</div><h2 className="mt-1 text-xl font-bold">Cost summary</h2></div>
          <div className="flex justify-between gap-3 text-[15px]"><span>Materials subtotal</span><strong className="num">{money(result.materialsTotal)}</strong></div>
          <div className="flex justify-between gap-3 text-[15px]"><span>Labour</span><strong className="num">{money(result.labourCost)}</strong></div>
          <div className="flex justify-between gap-3 border-t border-border pt-3 text-lg font-bold"><span>Current estimate</span><span className="num text-primary">{money(result.grandTotal)}</span></div>
          <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 text-[12px] sm:grid-cols-3 xl:grid-cols-2">
            {GOV_MATERIALS.map((material) => <div key={material.key} className="flex justify-between gap-2"><span className="text-muted-foreground">{material.label}</span><span className="num font-semibold">{money(result.materialTotals[material.key])}</span></div>)}
          </div>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden" data-testid="gov-consumption-workbook">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-4 py-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-wider text-primary">Sheet 1 · Consumption of material</div>
            <h2 className="mt-1 text-xl font-bold">Editable item schedule</h2>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">Edit quantities and consumption in place. R shows the row cost; unit cost is shown beneath it.</p></div>
          <Badge tone="info" className="text-[10px]">{GOV_ITEMS.length} items · {GOV_MATERIALS.length} materials</Badge>
        </div>
        <div className="min-w-0 overflow-x-hidden" data-testid="gov-consumption-scroll">
          <table className="w-full table-fixed border-collapse text-left text-[12px]">
            <colgroup>
              <col style={{ width: "20%" }} /><col style={{ width: "7%" }} /><col style={{ width: "7%" }} />
              {GOV_MATERIALS.map((material) => <col key={material.key} style={{ width: "6.8%" }} />)}
              <col style={{ width: "18.4%" }} />
            </colgroup>
            <thead className="bg-card">
              <tr className="bg-muted/70 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="border-b border-r border-border bg-muted/90 px-2 py-3 text-left">Item</th>
                <th className="border-b border-border px-1 py-3 text-right">Qty</th>
                <th className="border-b border-border px-1 py-3 text-left">Unit</th>
                {GOV_MATERIALS.map((material) => <th key={material.key} className="border-b border-border px-1 py-3 text-center leading-tight">{material.label}<span className="mt-0.5 block text-[10px] font-medium normal-case">per unit</span></th>)}
                <th className="border-b border-l border-border px-2 py-3 text-right text-foreground">R · Row cost (₹)</th>
              </tr>
            </thead>
            <tbody>
              {result.groups.map((group) => <FragmentGroup key={group.name} group={group} inputs={inputs} onQuantityChange={patchQuantity}
                onItemFieldChange={(code, field, value) => setInputs((current) => ({ ...current, [field]: { ...current[field], [code]: value } }))}
                onCoefficientChange={(code, materialKey, value) => setInputs((current) => ({ ...current,
                  itemCoefficients: { ...current.itemCoefficients, [code]: { ...current.itemCoefficients[code], [materialKey]: value } },
                }))} />)}
            </tbody>
            <tfoot className="bg-muted/80 font-bold">
              <tr><th colSpan={3} className="border-t border-border bg-muted/90 px-2 py-2.5 text-left text-[11px]">Materials subtotal</th>
                {GOV_MATERIALS.map((material) => <td key={`${material.key}-consumption-total`} className="border-t border-border px-2 py-3 text-right text-muted-foreground">—</td>)}
                <td className="border-l border-t border-border px-2 py-2.5 text-right text-[12px]">{money(result.materialsTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Notice tone="warning" icon={Landmark}>
        Confirm item units, material consumption values, quantities, and rates against the tender before using the estimate. The source does not specify the steel unit; that field is editable here.
      </Notice>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Calculation settings" wide testid="gov-calculation-settings">
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="p-4"><div className="text-sm font-semibold">Material rate</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Each local rate is multiplied by its editable factor below. The result is the applied rate used for all item estimates.</p>
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs font-medium">Applied rate = local material rate × conversion factor</div></Card>
            <Card className="p-4"><div className="text-sm font-semibold">Item unit cost and R row cost</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">For each material, multiply consumption per unit by its applied rate. Add the material costs for the unit cost, then multiply by the entered item quantity.</p>
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs font-medium">R = quantity × Σ(consumption per unit × applied material rate)</div></Card>
            <Card className="p-4 md:col-span-2"><div className="text-sm font-semibold">Labour</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Labour is calculated separately from material row costs using the project construction area and labour rate.</p>
              <div className="mt-2 rounded bg-muted/50 p-2 text-xs font-medium">Labour cost = construction area × labour rate · Current labour cost: {money(result.labourCost)}</div></Card>
          </div>
          <div>
            <div className="mb-1 text-sm font-semibold">Material rates and conversion factors</div>
            <p className="mb-3 text-xs text-muted-foreground">Change a local rate or factor here. The estimate updates immediately. Keep factors consistent with the rate units used for the tender.</p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[650px] text-left text-sm">
                <thead className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground"><tr>
                  <th className="px-3 py-2">Material</th><th className="px-3 py-2">Local rate</th><th className="px-3 py-2">Conversion factor</th><th className="px-3 py-2 text-right">Applied rate</th>
                </tr></thead>
                <tbody>{GOV_MATERIALS.map((material) => <tr key={material.key} className="border-t border-border">
                  <th className="px-3 py-2 font-semibold">{material.label}</th>
                  <td className="w-36 px-3 py-1.5"><Input aria-label={`${material.label} local rate setting`} data-testid={`gov-setting-rate-${material.key}`} type="number" min="0" step="any"
                    className="num h-8" value={inputs.materialRates[material.key]} onChange={(event) => patchRate(material.key, event.target.value)} /></td>
                  <td className="w-40 px-3 py-1.5"><Input aria-label={`${material.label} conversion factor`} data-testid={`gov-setting-factor-${material.key}`} type="number" min="0" step="any"
                    className="num h-8" value={inputs.calculationSettings.materialRateMultipliers[material.key]}
                    onChange={(event) => patchMultiplier(material.key, event.target.value)} /></td>
                  <td className="num px-3 py-2 text-right font-semibold">{money(result.rates[material.key].calculationRate)}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={() => setSettingsOpen(false)}>Done</Button></div>
        </div>
      </Modal>
    </div>
  );
}

function FragmentGroup({ group, inputs, onQuantityChange, onItemFieldChange, onCoefficientChange }) {
  return <>
    <tr><th colSpan={3 + GOV_MATERIALS.length + 1} className="border-y border-border bg-muted/40 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-foreground">{group.name}<span className="ml-2 font-normal normal-case text-muted-foreground">{money(group.subtotal)}</span></th></tr>
    {group.items.map((item) => <tr key={item.code} className="border-b border-border/70 transition-colors hover:bg-primary/[0.03]">
      <th className="border-r border-border bg-card px-1.5 py-1.5 text-left font-semibold">
        <Input aria-label={`${item.name} item name`} title={item.name} data-testid={`gov-name-${item.code}`} className="h-10 w-full min-w-0 px-1.5 text-[13px] font-semibold"
          value={inputs.itemNames[item.code]} onChange={(event) => onItemFieldChange(item.code, "itemNames", event.target.value)} />
      </th>
      <td className="px-1 py-1.5"><Input aria-label={`${item.name} quantity`} data-testid={`gov-quantity-${item.code}`} type="number" min="0" step="any" className="num h-10 w-full min-w-0 px-1 text-right text-[13px]"
        value={inputs.itemQuantities[item.code]} onChange={(event) => onQuantityChange(item.code, event.target.value)} /></td>
      <td className="px-1 py-1.5"><Input aria-label={`${item.name} unit`} title={item.unit} data-testid={`gov-unit-${item.code}`} className="h-10 w-full min-w-0 px-1 text-[13px]"
        value={inputs.itemUnits[item.code]} onChange={(event) => onItemFieldChange(item.code, "itemUnits", event.target.value)} /></td>
      {GOV_MATERIALS.map((material) => <td key={`${material.key}-consumption`} className="px-0.5 py-1.5">
        <Input aria-label={`${item.name} ${material.label} consumption per unit`} data-testid={`gov-consumption-${item.code}-${material.key}`} type="number" min="0" step="any"
          className="num h-10 w-full min-w-0 px-1 text-right text-[13px]" value={inputs.itemCoefficients[item.code][material.key]}
          onChange={(event) => onCoefficientChange(item.code, material.key, event.target.value)} />
      </td>)}
      <td className="num whitespace-nowrap border-l border-border bg-muted/10 px-2 py-1.5 text-right font-bold text-[16px] leading-tight">{money(item.amount)}
        <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{money(item.unitCost)} / {item.unit}</span>
      </td>
    </tr>)}
  </>;
}
