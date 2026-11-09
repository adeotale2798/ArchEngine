import { useState } from "react";
import { Plus, Pencil, Copy, Archive, RotateCcw, Search, History } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useList } from "@/lib/hooks";
import ResourceForm from "./ResourceForm";
import HistoryPanel from "./HistoryPanel";
import { Badge, Button, Empty, Input, Modal, Table } from "./ui";

/** Generic list + create/edit/duplicate/archive page section backed by /api/r/{resource}. */
export default function CrudTable({ resource, title, fields, columns, params = {}, base = {}, testid, emptyText, canEdit = true, extraActions }) {
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState("");
  const { rows, reload, loading } = useList(resource, { ...params, ...(showArchived ? { status: "archived" } : {}), ...(q ? { q } : {}) });
  const [editing, setEditing] = useState(null);
  const [hist, setHist] = useState(null);
  const act = async (id, action) => {
    try { await api.post(`/r/${resource}/${id}/${action}`); toast.success(`${action[0].toUpperCase() + action.slice(1)}d`); reload(); } catch (e) { notifyError(e); }
  };
  const tid = testid || resource;
  return (
    <div className="space-y-4" data-testid={`${tid}-section`}>
      <div className="flex flex-wrap items-center gap-3">
        {title && <h2 className="mr-auto text-xl font-semibold">{title}</h2>}
        <div className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" />
          <Input data-testid={`${tid}-search`} className="w-56 pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Button variant="outline" size="md" data-testid={`${tid}-toggle-archived`} onClick={() => setShowArchived((s) => !s)}>{showArchived ? "Show active" : "Show archived"}</Button>
        {canEdit && <Button data-testid={`${tid}-add-btn`} onClick={() => setEditing({})}><Plus size={16} /> Add</Button>}
      </div>
      {!loading && rows.length === 0 ? <Empty title={showArchived ? "Nothing archived" : "Nothing here yet"}>{emptyText}</Empty> : (
        <Table head={[...columns.map((c) => c[1]), ""]}>
          {rows.map((r) => (
            <tr key={r.id} data-testid={`${tid}-row-${r.code || r.key || r.id}`}>
              {columns.map(([k, , render]) => <td key={k}>{render ? render(r) : r[k] ?? "—"}</td>)}
              <td className="whitespace-nowrap text-right">
                {extraActions?.(r)}
                {canEdit && !showArchived && <>
                  <Button variant="ghost" size="sm" aria-label="Edit" data-testid={`${tid}-edit-${r.id}`} onClick={() => setEditing(r)}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="sm" aria-label="Duplicate" data-testid={`${tid}-dup-${r.id}`} onClick={() => act(r.id, "duplicate")}><Copy size={14} /></Button>
                  <Button variant="ghost" size="sm" aria-label="Archive" data-testid={`${tid}-archive-${r.id}`} onClick={() => act(r.id, "archive")}><Archive size={14} /></Button>
                </>}
                {canEdit && showArchived && <Button variant="ghost" size="sm" data-testid={`${tid}-restore-${r.id}`} onClick={() => act(r.id, "restore")}><RotateCcw size={14} /> Restore</Button>}
                <Button variant="ghost" size="sm" aria-label="History" data-testid={`${tid}-history-${r.id}`} onClick={() => setHist(r)}><History size={14} /></Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Edit" : "Add new"} wide testid={`${tid}-modal`}>
        <ResourceForm resource={resource} fields={fields} initial={editing} base={base} testid={`${tid}-form`} onSaved={() => { setEditing(null); reload(); }} />
      </Modal>
      <Modal open={!!hist} onClose={() => setHist(null)} title="Change history" wide testid={`${tid}-history-modal`}>
        {hist && <HistoryPanel resource={resource} id={hist.id} />}
      </Modal>
    </div>
  );
}

export const statusBadge = (r) => <Badge tone={r.status === "active" ? "success" : "muted"}>{r.status}</Badge>;
