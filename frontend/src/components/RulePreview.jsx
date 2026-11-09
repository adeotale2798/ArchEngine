import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { inr } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import { Badge, Button, Card, Input, Select } from "./ui";

/** Before/after simulator on the draft configuration for the given input key. */
export default function RulePreview({ inputKey, lineIds, title = "Preview simulator" }) {
  const { templateId } = useTemplate();
  const [pkgs, setPkgs] = useState([]);
  const [pkg, setPkg] = useState("");
  const [a, setA] = useState("2");
  const [b, setB] = useState("5");
  const [res, setRes] = useState(null);
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
      <h3 className="mb-4 text-lg font-semibold">{title}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <Select aria-label="Package" data-testid="sim-package" className="w-48" value={pkg} onChange={(e) => setPkg(e.target.value)} options={pkgs.map((p) => [p.id, p.name])} />
        <label className="text-sm">{inputKey} = <Input data-testid="sim-value-a" className="num inline-flex w-20" value={a} onChange={(e) => setA(e.target.value)} /></label>
        <ArrowRight size={16} className="mb-3" />
        <label className="text-sm"><Input data-testid="sim-value-b" className="num inline-flex w-20" value={b} onChange={(e) => setB(e.target.value)} /></label>
        <Button data-testid="sim-run-btn" onClick={run}>Compare</Button>
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
