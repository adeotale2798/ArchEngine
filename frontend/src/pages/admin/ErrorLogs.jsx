import { useEffect, useState } from "react";
import { Bug, Check } from "lucide-react";
import { api, notifyError } from "@/lib/api";
import { date } from "@/lib/format";
import { Badge, Button, Empty, Modal, PageHeader, Table } from "@/components/ui";

export default function ErrorLogs() {
  const [rows, setRows] = useState([]);
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(null);
  const load = () => api.get("/error-logs", { params: all ? {} : { resolved: false } }).then((r) => setRows(r.data)).catch(notifyError);
  useEffect(() => { load(); }, [all]); // eslint-disable-line
  const resolve = async (id) => { await api.post(`/error-logs/${id}/resolve`); load(); };
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Error logs" subtitle="Server exceptions and browser errors are captured automatically with a request reference."
        actions={<Button variant="outline" data-testid="errors-toggle-all" onClick={() => setAll(!all)}>{all ? "Unresolved only" : "Show all"}</Button>} />
      {rows.length === 0 ? <Empty icon={Bug} title="No errors">All clear — nothing has been logged.</Empty> : (
        <Table head={["When", "Source", "Message", "Path", "Ref", ""]}>
          {rows.map((e) => <tr key={e.id} data-testid={`error-row-${e.id}`}><td className="whitespace-nowrap text-xs">{date(e.created_at)}</td><td><Badge tone={e.source === "backend" ? "danger" : "warning"}>{e.source}</Badge></td>
            <td className="max-w-[420px] cursor-pointer truncate text-sm" onClick={() => setOpen(e)}>{e.message}</td><td className="num text-xs">{e.method} {e.path || e.extra?.url}</td><td className="num text-xs">{e.request_id}</td>
            <td>{e.resolved ? <Badge tone="success">resolved</Badge> : <Button size="sm" variant="ghost" data-testid={`resolve-error-${e.id}`} onClick={() => resolve(e.id)}><Check size={13} /> Resolve</Button>}</td></tr>)}
        </Table>)}
      <Modal open={!!open} onClose={() => setOpen(null)} title="Error detail" wide testid="error-detail-modal"><pre className="num max-h-[60vh] overflow-auto whitespace-pre-wrap text-xs">{open?.message}{"\n\n"}{open?.detail}</pre></Modal>
    </div>
  );
}
