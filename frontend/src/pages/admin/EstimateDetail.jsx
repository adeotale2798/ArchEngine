import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Copy, Download, Link2, Send, ShieldCheck, Undo2, FilePlus2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { api, download, notifyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { STATUS, date, inr } from "@/lib/format";
import { Badge, Button, Card, Field, Input, Notice, PageHeader, Select, Table, Tabs, Toggle } from "@/components/ui";

function Lifecycle({ est, rev, onDone }) {
  const { can } = useAuth();
  const [comment, setComment] = useState("");
  const [rebase, setRebase] = useState(false);
  const go = async (action) => {
    try { await api.post(`/estimates/${est.id}/transition`, { action, comment, rebase }); toast.success(`Done: ${action}`); setComment(""); onDone(); } catch (e) { notifyError(e); }
  };
  const s = rev.status;
  return (
    <Card className="space-y-3 p-5" data-testid="lifecycle-card">
      <h3 className="font-semibold">Review & issue</h3>
      <div className="flex flex-wrap gap-1 text-[11px]">{["DRAFT", "IN_REVIEW", "APPROVED", "ISSUED"].map((x) => <Badge key={x} tone={x === s ? STATUS[x].tone : "muted"}>{STATUS[x].label}</Badge>)}</div>
      <Input data-testid="transition-comment" placeholder="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {s === "DRAFT" && <Button size="sm" variant="outline" data-testid="submit-review-btn" onClick={() => go("submit")}><Send size={13} /> Submit for review</Button>}
        {s === "IN_REVIEW" && can("estimate.approve") && <Button size="sm" variant="outline" data-testid="approve-btn" onClick={() => go("approve")}><CheckCircle2 size={13} /> Approve</Button>}
        {["IN_REVIEW", "APPROVED"].includes(s) && can("estimate.approve") && <Button size="sm" variant="ghost" data-testid="return-btn" onClick={() => go("return")}><Undo2 size={13} /> Return to draft</Button>}
        {["DRAFT", "IN_REVIEW", "APPROVED"].includes(s) && can("estimate.issue") && <Button size="sm" data-testid="issue-btn" onClick={() => go("issue")}><ShieldCheck size={13} /> Issue</Button>}
        {["ISSUED", "APPROVED", "IN_REVIEW"].includes(s) && <Button size="sm" variant="outline" data-testid="revise-btn" onClick={() => go("revise")}><FilePlus2 size={13} /> New revision</Button>}
      </div>
      {["ISSUED", "APPROVED", "IN_REVIEW"].includes(s) && <Toggle checked={rebase} onChange={setRebase} label="New revision uses latest published catalogue" data-testid="rebase-toggle" />}
      {rev.result.critical_count > 0 && <Notice tone="danger">{rev.result.critical_count} critical issue(s) block approval and issue.</Notice>}
    </Card>
  );
}

function Sharing({ est, clients, onDone }) {
  const [links, setLinks] = useState([]);
  const [days, setDays] = useState("14");
  const [conf, setConf] = useState(true);
  const [email, setEmail] = useState("");
  const [fresh, setFresh] = useState(null);
  const load = useCallback(() => api.get(`/estimates/${est.id}/share-links`).then((r) => setLinks(r.data)), [est.id]);
  useEffect(() => { load(); }, [load]);
  const create = async () => { try { const { data } = await api.post(`/estimates/${est.id}/share-links`, { expires_in_days: Number(days), can_configure: conf, can_download: true }); setFresh(`${location.origin}/share/${data.token}`); load(); } catch (e) { notifyError(e); } };
  const revoke = async (id) => { await api.post(`/estimates/${est.id}/share-links/${id}/revoke`); toast.success("Link revoked"); load(); };
  const grant = async () => { try { await api.post(`/estimates/${est.id}/clients`, { email }); setEmail(""); toast.success("Access granted"); onDone(); } catch (e) { notifyError(e); } };
  return (
    <Card className="space-y-4 p-5" data-testid="sharing-card">
      <h3 className="font-semibold">Client access</h3>
      <div className="flex gap-2"><Input data-testid="share-days" className="w-20" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Expiry days" /><span className="self-center text-xs">days</span>
        <Button size="sm" data-testid="create-share-link-btn" onClick={create}><Link2 size={13} /> Create link</Button></div>
      <Toggle checked={conf} onChange={setConf} label="Client may configure (while draft)" />
      {fresh && <div className="space-y-2 rounded border border-success/40 bg-success/5 p-3 text-xs"><div className="font-semibold">Copy now — shown only once</div>
        <div className="num break-all" data-testid="share-link-url">{fresh}</div><Button size="sm" variant="outline" data-testid="copy-share-link" onClick={() => { navigator.clipboard?.writeText(fresh); toast.success("Copied"); }}><Copy size={12} /> Copy</Button></div>}
      <ul className="space-y-1 text-xs">{links.map((l) => <li key={l.id} className="flex items-center gap-2" data-testid={`share-link-${l.id}`}><span className="num">{l.token_prefix}…</span>
        <span className="text-muted-foreground">exp {date(l.expires_at)} · used {l.use_count}×</span>
        {l.revoked ? <Badge>revoked</Badge> : <button className="ml-auto text-danger" data-testid={`revoke-link-${l.id}`} onClick={() => revoke(l.id)}>Revoke</button>}</li>)}</ul>
      <div className="border-t border-border pt-3"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client logins</div>
        {clients.map((c) => <div key={c.id} className="flex items-center justify-between text-sm">{c.email}<button aria-label="Revoke client" onClick={async () => { await api.delete(`/estimates/${est.id}/clients/${c.id}`); onDone(); }}><X size={13} /></button></div>)}
        <div className="mt-2 flex gap-2"><Input data-testid="grant-client-email" placeholder="client@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /><Button size="sm" variant="outline" data-testid="grant-client-btn" onClick={grant}><UserPlus size={13} /></Button></div></div>
    </Card>
  );
}

export default function EstimateDetail() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [tab, setTab] = useState("boq");
  const [exportsLog, setExportsLog] = useState([]);
  const load = useCallback(async () => {
    try { const { data } = await api.get(`/estimates/${id}`); setD(data); setCfg({ inputs: data.estimate.inputs, package_id: data.estimate.package_id, manual_quantities: data.estimate.manual_quantities || {} });
      setExportsLog((await api.get(`/estimates/${id}/exports-history`)).data); } catch (e) { notifyError(e); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!d) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const { estimate: est, revision: rev } = d;
  const r = rev.result;
  const draft = rev.status === "DRAFT";
  const apply = async () => { try { await api.put(`/estimates/${id}/config`, cfg); toast.success("Recalculated on server"); load(); } catch (e) { notifyError(e); } };
  const manualLines = r.lines.filter((l) => l.quantity_mode === "MANUAL_INTERNAL");
  return (
    <div>
      <PageHeader eyebrow={`${est.number} · revision ${rev.revision_number} · template v${rev.template_version}`} title={est.title} subtitle={`${est.client_name || "No client name"} ${est.project_name ? "· " + est.project_name : ""}`}
        actions={<>{["pdf", "xlsx", "csv"].map((f) => <Button key={f} variant="outline" data-testid={`admin-download-${f}`} onClick={() => download(`/estimates/${id}/exports/${f}`, `${est.number}.${f}`).then(load)}><Download size={14} /> {f.toUpperCase()}</Button>)}
          <Badge tone={STATUS[rev.status]?.tone} data-testid="revision-status">{STATUS[rev.status]?.label}</Badge></>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-5" data-testid="estimate-config">
            <div className="grid gap-4 md:grid-cols-4">
              {d.input_defs.map((i) => <Field key={i.key} label={i.label}><Input data-testid={`cfg-input-${i.key}`} disabled={!draft} className="num" value={cfg.inputs?.[i.key] ?? ""} onChange={(e) => setCfg({ ...cfg, inputs: { ...cfg.inputs, [i.key]: e.target.value } })} /></Field>)}
              <Field label="Package"><Select data-testid="cfg-package" disabled={!draft} value={cfg.package_id || ""} onChange={(e) => setCfg({ ...cfg, package_id: e.target.value })} options={d.packages.map((p) => [p.id, p.name])} /></Field>
              {manualLines.map((l) => <Field key={l.line_item_id} label={`Qty · ${l.code}`}><Input className="num" disabled={!draft} value={cfg.manual_quantities[l.line_item_id] ?? ""} onChange={(e) => setCfg({ ...cfg, manual_quantities: { ...cfg.manual_quantities, [l.line_item_id]: e.target.value } })} /></Field>)}
              <div className="flex items-end"><Button data-testid="recalculate-btn" disabled={!draft} onClick={apply}>Recalculate</Button></div>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[["Subtotal", r.totals.subtotal], [`Contingency ${r.totals.contingency_enabled ? r.totals.contingency_rate + "%" : "(off)"}`, r.totals.contingency], [`${r.totals.tax_label} ${r.totals.tax_rate}%`, r.totals.tax], ["Grand total", r.totals.grand_total]].map(([l, v], n) => (
              <Card key={l} className={n === 3 ? "bg-secondary p-5 text-white" : "p-5"}><div className="text-xs uppercase tracking-wider opacity-70">{l}</div><div className="num mt-1 text-xl font-semibold" data-testid={`admin-total-${n}`}>{inr(v)}</div></Card>))}
          </div>
          <Tabs tabs={[["boq", "BOQ & trace"], ["issues", `Issues (${r.issues.length})`], ["revisions", "Revisions"], ["downloads", "Download history"]]} value={tab} onChange={setTab} />
          {tab === "boq" && <Table head={["Code", "Item / specification", "Qty", "Rate", "Amount", "Status", "Calculation trace"]}>
            {r.lines.map((l) => <tr key={l.line_item_id} data-testid={`boq-row-${l.code}`}><td className="num text-xs">{l.code}</td><td className="min-w-[220px]"><div className="font-medium">{l.name}</div><div className="text-xs text-muted-foreground">{l.specification}</div></td>
              <td className="num whitespace-nowrap">{l.quantity} {l.unit}</td><td className="num">{l.rate ? inr(l.rate) : "—"}{l.internal_cost && <div className="text-[10px] text-muted-foreground">cost {inr(l.internal_cost)}</div>}</td>
              <td className="num">{Number(l.amount) ? inr(l.amount) : "—"}</td><td><Badge tone={STATUS[l.status]?.tone}>{STATUS[l.status]?.label}</Badge></td><td className="num max-w-[320px] text-[11px] text-muted-foreground">{l.trace}</td></tr>)}
          </Table>}
          {tab === "issues" && <ul className="space-y-2 text-sm" data-testid="issues-list">{r.issues.map((i, n) => <li key={n} className="flex gap-2"><Badge tone={i.severity === "critical" ? "danger" : "warning"}>{i.severity}</Badge>{i.message}</li>)}{!r.issues.length && <li>No issues.</li>}</ul>}
          {tab === "revisions" && <Table head={["Rev", "Status", "Template", "Created", "Issued", "Valid until", ""]}>
            {d.revisions.map((v) => <tr key={v.id}><td className="num">{v.revision_number}</td><td><Badge tone={STATUS[v.status]?.tone}>{STATUS[v.status]?.label}</Badge></td><td className="num">v{v.template_version}</td><td className="text-xs">{date(v.created_at)}</td><td className="text-xs">{date(v.issued_at)}</td><td className="text-xs">{v.valid_until || "—"}</td>
              <td><Button size="sm" variant="ghost" data-testid={`rev-pdf-${v.revision_number}`} onClick={() => download(`/estimates/${id}/exports/pdf?revision_id=${v.id}`, "rev.pdf")}><Download size={12} /> PDF</Button></td></tr>)}
          </Table>}
          {tab === "downloads" && <Table head={["When", "Format", "Rev", "Channel", "Actor", "SHA-256"]}>{exportsLog.map((x) => <tr key={x.id}><td className="text-xs">{date(x.created_at)}</td><td className="uppercase">{x.format}</td><td className="num">{x.revision_number}</td><td>{x.channel}</td><td className="text-xs">{x.actor}</td><td className="num text-[10px]">{x.sha256.slice(0, 16)}…</td></tr>)}</Table>}
        </div>
        <div className="space-y-6"><Lifecycle est={est} rev={rev} onDone={load} /><Sharing est={est} clients={d.clients} onDone={load} />
          <Card className="p-5"><h3 className="mb-2 font-semibold">Approvals</h3>{d.approvals.map((a) => <div key={a.id} className="text-xs"><b className="capitalize">{a.action}</b> by {a.actor_email} · {date(a.created_at)}{a.comment && ` — “${a.comment}”`}</div>)}</Card></div>
      </div>
    </div>
  );
}
