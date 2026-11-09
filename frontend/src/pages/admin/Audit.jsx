import { useEffect, useState } from "react";
import { api, notifyError } from "@/lib/api";
import { date } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import { Badge, Input, PageHeader, Table, Tabs } from "@/components/ui";

export default function AuditPage() {
  const { templateId } = useTemplate();
  const [tab, setTab] = useState("audit");
  const [rows, setRows] = useState([]);
  const [versions, setVersions] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { api.get("/audit", { params: { limit: 500 } }).then((r) => setRows(r.data)).catch(notifyError); }, []);
  useEffect(() => { if (templateId) api.get(`/templates/${templateId}/versions`).then((r) => setVersions(r.data)); }, [templateId]);
  const shown = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Versions & audit log" subtitle="Append-only record of who changed what and when — rates, options, rules, publications, estimate approvals and client downloads." />
      <Tabs tabs={[["audit", "Audit events"], ["versions", "Template versions"]]} value={tab} onChange={setTab} />
      {tab === "audit" && <>
        <Input data-testid="audit-search" className="mb-4 w-72" placeholder="Filter (action, user, entity…)" value={q} onChange={(e) => setQ(e.target.value)} />
        <Table head={["When", "Actor", "Action", "Entity", "Changes"]}>
          {shown.map((e) => <tr key={e.id} data-testid="audit-row"><td className="whitespace-nowrap text-xs">{date(e.created_at)}</td><td className="text-xs">{e.actor_email || "system"}</td>
            <td><Badge tone={["download", "publish", "issue"].includes(e.action) ? "primary" : "muted"}>{e.action}</Badge></td><td className="text-xs">{e.entity_type}</td>
            <td className="num max-w-[420px] truncate text-[11px] text-muted-foreground">{Object.entries(e.changes || {}).map(([k, v]) => `${k}: ${JSON.stringify(v.to)?.slice(0, 40)}`).join(" · ") || JSON.stringify(e.meta)}</td></tr>)}
        </Table></>}
      {tab === "versions" && <Table head={["Version", "Published", "By", "Hash", "Counts", "Notes"]}>
        {versions.map((v) => <tr key={v.id}><td className="num font-semibold">v{v.version}</td><td className="text-xs">{date(v.published_at)}</td><td className="text-xs">{v.published_by_email}</td>
          <td className="num text-[10px]">{v.hash.slice(0, 12)}</td><td className="text-xs">{v.counts?.line_items} items · {v.counts?.packages} packages</td><td className="text-xs">{v.notes}</td></tr>)}
      </Table>}
    </div>
  );
}
