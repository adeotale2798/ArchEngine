import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { useTemplate } from "@/lib/hooks";
import EstimateWizard from "@/components/EstimateWizard";
import { Notice } from "@/components/ui";

/** Admin preview of exactly what clients see, run against the live DRAFT configuration (not persisted). */
export default function Simulator() {
  const { templateId, template } = useTemplate();
  const [ctx, setCtx] = useState(null);
  const [state, setState] = useState({ inputs: {}, package_id: null, overrides: {} });
  const [result, setResult] = useState(null);
  const [prev, setPrev] = useState(null);
  useEffect(() => {
    if (!templateId) return;
    Promise.all([api.get("/r/inputs", { params: { template_id: templateId } }), api.get("/r/packages", { params: { template_id: templateId } }),
      api.get("/r/package_options", { params: { template_id: templateId } }), api.get("/org")]).then(([i, p, o, org]) => {
      const names = Object.fromEntries(p.data.map((x) => [x.id, x.name]));
      const obl = {};
      o.data.forEach((x) => names[x.package_id] && (obl[x.line_item_id] ||= []).push({ package_id: x.package_id, package_name: names[x.package_id], label: x.specification_label }));
      setCtx({ inputs: i.data, packages: p.data, obl, org: org.data });
      const s = { inputs: Object.fromEntries(i.data.map((d) => [d.key, d.default_value])), package_id: (p.data.find((x) => x.is_recommended) || p.data[0])?.id, overrides: {} };
      setState(s); run(s);
    }).catch(notifyError);
  }, [templateId]); // eslint-disable-line
  const run = async (s) => {
    try { const { data } = await api.post(`/templates/${templateId}/simulate`, s); setPrev(result?.totals?.grand_total); setResult(data); } catch (e) { notifyError(e); }
  };
  const onUpdate = (patch) => { const s = { ...state, ...patch }; setState(s); run(s); };
  if (!ctx) return <div className="text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="-mx-4 md:-mx-10">
      <div className="px-4 md:px-10"><Notice tone="info" icon={FlaskConical}>Preview simulator — draft configuration of <b>{template?.name}</b>. Nothing is saved; downloads are available from real estimates.</Notice></div>
      <EstimateWizard meta={{ org: ctx.org, template, number: "PREVIEW", title: template?.name }} inputDefs={ctx.inputs} packages={ctx.packages} optionsByLine={ctx.obl}
        state={state} result={result} editable onUpdate={onUpdate} prevTotal={prev} exportFormats={[]} />
    </div>
  );
}
