import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, download, errMsg, notifyError } from "@/lib/api";
import EstimateWizard from "@/components/EstimateWizard";
import { Empty } from "@/components/ui";

/** Client portal: share link (kind="s") or signed-in client (kind="e"). All totals come from the server. */
export default function ClientEstimate({ kind }) {
  const { token, id } = useParams();
  const ref = kind === "s" ? token : id;
  const base = `/portal/${kind}/${encodeURIComponent(ref)}`;
  const [data, setData] = useState(null);
  const [state, setState] = useState({ inputs: {}, package_id: null, overrides: {} });
  const [result, setResult] = useState(null);
  const [prevTotal, setPrevTotal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(base);
      setData(d); setResult(d.result);
      setState({ inputs: d.estimate.inputs || {}, package_id: d.estimate.package_id, overrides: d.estimate.overrides || {} });
    } catch (e) { setError(errMsg(e)); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const onUpdate = async (patch) => {
    const next = { ...state, ...patch };
    setState(next); setBusy(true);
    const my = ++seq.current;
    try {
      const { data: r } = await api.put(`${base}/config`, patch);
      if (my === seq.current) { setPrevTotal(result?.totals?.grand_total); setResult(r.result); }
      if (patch.inputs) api.get(base).then((x) => setData((d) => ({ ...d, package_totals: x.data.package_totals })));
    } catch (e) { notifyError(e); }
    if (my === seq.current) setBusy(false);
  };

  if (error) return <div className="mx-auto max-w-lg p-10"><Empty title="Estimate unavailable">{error}</Empty></div>;
  if (!data) return <div className="p-10 text-sm text-muted-foreground" data-testid="client-loading">Loading your estimate…</div>;
  return (
    <div className="grain min-h-screen" data-testid="client-estimate">
      <EstimateWizard meta={{ org: data.org, template: data.template, number: data.estimate.number, title: data.estimate.title, revision: data.revision }}
        inputDefs={data.input_defs} packages={data.packages} packageTotals={data.package_totals} optionsByLine={data.options_by_line}
        state={state} result={result} editable={data.permissions.editable} busy={busy} onUpdate={onUpdate} prevTotal={prevTotal}
        exportFormats={data.permissions.can_download ? data.export_formats : []}
        onDownload={(f) => download(`${base}/exports/${f}`, `${data.estimate.number}.${f}`)} />
    </div>
  );
}
