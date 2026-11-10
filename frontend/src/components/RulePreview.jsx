import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import { Badge, Button, Card, Input, Select } from "./ui";

/** Before/after simulator on the draft configuration for the given input key. */
const SIM_DEFAULTS = {
  total_floors: { from: "2", to: "5" },
  total_bathrooms: { from: "2", to: "3" },
  total_plinth_level: { from: "1", to: "2" },
};

export default function RulePreview({ inputKey, lineIds, title = "Preview simulator" }) {
  const { templateId } = useTemplate();
  const [pkgs, setPkgs] = useState([]);
  const [pkg, setPkg] = useState("");
  const defaults = SIM_DEFAULTS[inputKey] || { from: "2", to: "5" };
  const [a, setA] = useState(defaults.from);
  const [b, setB] = useState(defaults.to);
  const [res, setRes] = useState(null);
  const niceInputKey = (inputKey || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const displayTitle = title || "Preview Simulator";
  useEffect(() => { if (templateId) api.get("/r/packages", { params: { template_id: templateId } }).then((r) => { setPkgs(r.data); setPkg(r.data[0]?.id || ""); }); }, [templateId]);
  const run = async () => {
    try {
      const base = { total_floors: "4", total_bathrooms: "2" };
      const [ra, rb] = await Promise.all([{ ...base, [inputKey]: a }, { ...base, [inputKey]: b }].map((inputs) => api.post(`/templates/${templateId}/simulate`, { inputs, package_id: pkg }).then((r) => r.data)));
      setRes({ ra, rb });
    } catch (e) { notifyError(e); }
  };
  const rows = res ? res.ra.lines.filter((l) => !lineIds || lineIds.includes(l.line_item_id)) : [];
  return (
    <Card className="p-6" data-testid="rule-preview-sim">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">{displayTitle}</h3>
        <span className="text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Live comparison</span>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Package</div>
            <Select aria-label="Package" data-testid="sim-package" className="w-full" value={pkg} onChange={(e) => setPkg(e.target.value)} options={pkgs.map((p) => [p.id, p.name])} />
          </div>
          <div className="min-w-[240px]">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">Input</div>
            <div className="flex items-center gap-3 rounded-md border border-border bg-card px-2 py-1.5">
              <span className="min-w-[120px] text-sm text-muted-foreground">{niceInputKey}</span>
              <span className="text-base text-foreground">=</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">From</span>
                <Input data-testid="sim-value-a" className="num inline-flex h-9 w-16" value={a} onChange={(e) => setA(e.target.value)} />
              </div>
              <ArrowRight size={16} className="text-muted-foreground" />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">To</span>
                <Input data-testid="sim-value-b" className="num inline-flex h-9 w-16" value={b} onChange={(e) => setB(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="pb-1"><Button data-testid="sim-run-btn" onClick={run}>Compare</Button></div>
        </div>
        <div className="text-sm text-muted-foreground">
          Sample values only — these are demo defaults, not your live project data. Replace them with real values to compare the actual estimate. This example shows how <span className="font-medium text-foreground">{niceInputKey}</span> changes from <span className="num font-medium text-foreground">{a}</span> to <span className="num font-medium text-foreground">{b}</span>.
        </div>
      </div>
      {res && (
        <div className="mt-5 space-y-3 text-sm" data-testid="sim-results">
          {rows.map((l) => { const lb = res.rb.lines.find((x) => x.line_item_id === l.line_item_id);
            return (
              <div key={l.line_item_id} className="rounded border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 font-medium"><span className="num text-xs text-muted-foreground">{l.code}</span>{l.name}
                  <span className="num ml-auto">{inr(l.amount)} → <b>{inr(lb?.amount)}</b></span></div>
                <div className="num mt-1 text-xs text-muted-foreground">A: {l.trace || "—"}</div>
                <div className="num text-xs text-muted-foreground">B: {lb?.trace || "—"}</div>
                {lb?.status !== "INCLUDED" && <Badge tone="warning" className="mt-1">{lb?.status}</Badge>}
              </div>); })}
          <div className="num text-right text-base">Grand total: {inr(res.ra.totals.grand_total)} → <b data-testid="sim-total-b">{inr(res.rb.totals.grand_total)}</b></div>
          {[...res.ra.issues, ...res.rb.issues].filter((i) => i.severity === "critical").slice(0, 6).map((i, n) => <div key={n} className="text-xs text-danger">{i.message}</div>)}
        </div>
      )}
    </Card>
  );
}
