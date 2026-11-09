import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Bug, FileCheck2, Info, Plus } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { date } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import { Badge, Button, Card, Notice, PageHeader } from "@/components/ui";

function Stat({ label, value, to, tid }) {
  return (
    <Link to={to} data-testid={tid} className="group rounded-lg border border-border bg-card p-5 transition-transform hover:-translate-y-0.5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="num mt-2 flex items-end justify-between text-3xl font-semibold">{value ?? "—"}<ArrowUpRight size={16} className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" /></div>
    </Link>
  );
}

export default function Overview() {
  const [d, setD] = useState(null);
  const [val, setVal] = useState(null);
  const { templateId, template } = useTemplate();
  useEffect(() => { api.get("/overview").then((r) => setD(r.data)).catch(notifyError); }, []);
  useEffect(() => { if (templateId) api.post(`/templates/${templateId}/validate`).then((r) => setVal(r.data)).catch(() => {}); }, [templateId]);
  const c = d?.counts || {};
  const imp = d?.imports?.find((i) => i.template_id === templateId);
  return (
    <div>
      <PageHeader eyebrow="Overview" title="Estimate workspace" subtitle="Everything clients see is driven by the catalogue, packages and rules you configure here."
        actions={<>
          <Link to="/admin/sections"><Button variant="outline" data-testid="quick-add-section"><Plus size={15} /> Section</Button></Link>
          <Link to="/admin/line-items"><Button variant="outline" data-testid="quick-add-line"><Plus size={15} /> Line item</Button></Link>
          <Link to="/admin/packages"><Button variant="outline" data-testid="quick-add-package"><Plus size={15} /> Package</Button></Link>
          <Link to="/admin/rules"><Button variant="outline" data-testid="quick-add-rule"><Plus size={15} /> Formula</Button></Link>
          <Link to="/admin/estimates"><Button data-testid="quick-create-estimate"><Plus size={15} /> Estimate</Button></Link>
        </>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Stat label="Templates" value={c.templates} to="/admin/templates" tid="stat-templates" />
        <Stat label="Sections" value={c.sections} to="/admin/sections" tid="stat-sections" />
        <Stat label="Line items" value={c.line_items} to="/admin/line-items" tid="stat-line-items" />
        <Stat label="Packages" value={c.packages} to="/admin/packages" tid="stat-packages" />
        <Stat label="Draft estimates" value={c.estimates_draft} to="/admin/estimates" tid="stat-drafts" />
        <Stat label="Awaiting review" value={c.estimates_in_review} to="/admin/estimates" tid="stat-review" />
        <Stat label="Open errors" value={c.open_errors} to="/admin/errors" tid="stat-errors" />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6" data-testid="validation-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Validation — {template?.name || "no template"}</h2>
            {val && <div className="flex gap-2"><Badge tone={val.critical_count ? "danger" : "success"} data-testid="critical-count">{val.critical_count} critical</Badge><Badge tone="warning">{val.warning_count} warnings</Badge></div>}
          </div>
          {!template?.current_version && <Notice tone="warning" icon={AlertTriangle} className="mb-4">This template is a <b>draft awaiting verification</b>. Review the imported values, then publish it in Templates to start issuing client estimates.</Notice>}
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-2 text-sm">
            {(val?.issues || []).slice(0, 40).map((i, n) => (
              <li key={n} className="flex gap-2"><Badge tone={i.severity === "critical" ? "danger" : "warning"}>{i.severity}</Badge><span>{i.message}</span></li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          {imp && (
            <Card className="p-6" data-testid="import-flags-card">
              <h2 className="mb-1 text-lg font-semibold">Source import — verification needed</h2>
              <p className="mb-3 text-xs text-muted-foreground">{imp.source_file} · {imp.rows_imported} rows · values preserved as printed</p>
              <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
                {imp.flags.map((f, n) => <li key={n} className="flex gap-2"><Info size={15} className="mt-0.5 shrink-0 text-warning" /><span><b>{f.package !== "-" ? `${f.package}: ` : ""}</b>{f.message}</span></li>)}
              </ul>
            </Card>
          )}
          <Card className="p-6">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><FileCheck2 size={18} /> Recently issued</h2>
            {(d?.recent_issued || []).length === 0 ? <p className="text-sm text-muted-foreground">No issued estimates yet.</p> :
              d.recent_issued.map((e) => <Link key={e.id} to={`/admin/estimates/${e.id}`} className="flex justify-between border-b border-border py-2 text-sm last:border-0"><span className="num">{e.number}</span><span className="text-muted-foreground">{date(e.updated_at)}</span></Link>)}
            {c.open_errors > 0 && <Link to="/admin/errors" className="mt-3 flex items-center gap-2 text-sm text-danger"><Bug size={14} /> {c.open_errors} unresolved errors</Link>}
          </Card>
        </div>
      </div>
    </div>
  );
}
