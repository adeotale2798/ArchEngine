import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { STATUS, date, inr } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import { Badge, Button, Empty, Field, Input, Modal, Notice, PageHeader, Table } from "@/components/ui";

export default function Estimates() {
  const { templateId, template } = useTemplate();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", client_name: "", client_email: "", project_name: "" });
  useEffect(() => { api.get("/estimates").then((r) => setRows(r.data)).catch(notifyError); }, []);
  const create = async () => {
    try { const { data } = await api.post("/estimates", { ...f, template_id: templateId }); nav(`/admin/estimates/${data.id}`); } catch (e) { notifyError(e); }
  };
  return (
    <div>
      <PageHeader eyebrow="Estimates" title="Client estimates" subtitle="Each estimate is pinned to a published template version. Revisions are immutable once issued."
        actions={<Button data-testid="new-estimate-btn" onClick={() => setOpen(true)}><Plus size={15} /> New estimate</Button>} />
      {rows.length === 0 ? <Empty title="No estimates yet">Publish a template, then create an estimate for a client.</Empty> : (
        <Table head={["Number", "Title", "Client", "Status", "Rev", "Total", "Issues", "Updated"]}>
          {rows.map((e) => (
            <tr key={e.id} data-testid={`estimate-row-${e.number}`} className="cursor-pointer" onClick={() => nav(`/admin/estimates/${e.id}`)}>
              <td className="num font-semibold"><Link to={`/admin/estimates/${e.id}`}>{e.number}</Link></td><td>{e.title}</td><td>{e.client_name || "—"}</td>
              <td><Badge tone={STATUS[e.status]?.tone}>{STATUS[e.status]?.label}</Badge></td><td className="num">{e.revision_number}</td>
              <td className="num">{inr(e.grand_total)}</td><td>{e.critical_count ? <Badge tone="danger">{e.critical_count} critical</Badge> : "—"}</td><td className="text-xs">{date(e.updated_at)}</td>
            </tr>))}
        </Table>)}
      <Modal open={open} onClose={() => setOpen(false)} title="New client estimate" testid="new-estimate-modal">
        <div className="space-y-4">
          {!template?.current_version && <Notice tone="warning">“{template?.name}” has no published version yet. Publish it under Templates first.</Notice>}
          {[["title", "Estimate title"], ["client_name", "Client name"], ["client_email", "Client email (optional)"], ["project_name", "Project / site (optional)"]].map(([k, l]) => (
            <Field key={k} label={l}><Input data-testid={`new-estimate-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>))}
          <div className="flex justify-end"><Button data-testid="create-estimate-submit" onClick={create}>Create estimate</Button></div>
        </div>
      </Modal>
    </div>
  );
}
