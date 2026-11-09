import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Archive, FolderOpen, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useList, useTemplate } from "@/lib/hooks";
import ResourceForm from "@/components/ResourceForm";
import { Badge, Button, Card, Empty, Modal, PageHeader } from "@/components/ui";

const SEC_FIELDS = [{ name: "code", label: "Code" }, { name: "name", label: "Name" }, { name: "description", label: "Description", type: "textarea" },
  { name: "image_url", label: "Image URL (shown to clients)", span: 2 }, { name: "client_visible", label: "Visible to client", type: "bool" }];
const SUB_FIELDS = [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { name: "description", label: "Description", type: "textarea" }];

function Row({ r, res, onEdit, onReload, list, idx, children, tid }) {
  const act = async (a) => { try { await api.post(`/r/${res}/${r.id}/${a}`); toast.success("Done"); onReload(); } catch (e) { notifyError(e); } };
  const move = async (d) => {
    const ids = list.map((x) => x.id);
    const j = idx + d;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await api.post(`/r/${res}/reorder`, { ids }); onReload();
  };
  return (
    <div className="flex items-center gap-2 py-1.5" data-testid={`${tid}-${r.id}`}>
      {children}
      <div className="ml-auto flex shrink-0">
        <Button variant="ghost" size="sm" aria-label="Move up" data-testid={`${tid}-up-${r.id}`} onClick={() => move(-1)}><ArrowUp size={13} /></Button>
        <Button variant="ghost" size="sm" aria-label="Move down" data-testid={`${tid}-down-${r.id}`} onClick={() => move(1)}><ArrowDown size={13} /></Button>
        <Button variant="ghost" size="sm" aria-label="Edit" data-testid={`${tid}-edit-${r.id}`} onClick={onEdit}><Pencil size={13} /></Button>
        <Button variant="ghost" size="sm" aria-label="Duplicate" data-testid={`${tid}-dup-${r.id}`} onClick={() => act("duplicate")}><Copy size={13} /></Button>
        <Button variant="ghost" size="sm" aria-label="Archive" data-testid={`${tid}-archive-${r.id}`} onClick={() => act("archive")}><Archive size={13} /></Button>
      </div>
    </div>
  );
}

export default function Sections() {
  const { templateId } = useTemplate();
  const secs = useList("sections", { template_id: templateId });
  const subs = useList("subsections", { template_id: templateId });
  const archived = useList("sections", { template_id: templateId, status: "archived" });
  const [edit, setEdit] = useState(null);
  const reload = () => { secs.reload(); subs.reload(); archived.reload(); };
  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Sections & subsections" subtitle="Structure the BOQ. Reorder, duplicate or archive — archived entries stay in historical estimates."
        actions={<Button data-testid="add-section-btn" onClick={() => setEdit({ res: "sections", row: {} })}><Plus size={15} /> Add section</Button>} />
      {secs.rows.length === 0 && !secs.loading ? <Empty icon={FolderOpen} title="No sections yet">Add your first section, e.g. Foundation or Plumbing.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {secs.rows.map((s, i) => {
            const children = subs.rows.filter((x) => x.section_id === s.id);
            return (
              <Card key={s.id} className="overflow-hidden" data-testid={`section-card-${s.code || s.id}`}>
                {s.image_url && <img src={s.image_url} alt="" className="h-24 w-full object-cover" />}
                <div className="p-5">
                  <Row r={s} res="sections" list={secs.rows} idx={i} onReload={reload} tid="section" onEdit={() => setEdit({ res: "sections", row: s })}>
                    <span className="num text-xs text-muted-foreground">{s.code}</span><span className="font-display text-lg font-semibold">{s.name}</span>
                    {s.client_visible === false && <Badge>internal</Badge>}
                  </Row>
                  <div className="ml-3 mt-2 border-l-2 border-primary/20 pl-4">
                    {children.map((c, j) => (
                      <Row key={c.id} r={c} res="subsections" list={children} idx={j} onReload={reload} tid="subsection" onEdit={() => setEdit({ res: "subsections", row: c })}>
                        <span className="text-sm">{c.name}</span>
                      </Row>
                    ))}
                    <Button variant="ghost" size="sm" data-testid={`add-subsection-${s.id}`} onClick={() => setEdit({ res: "subsections", row: {}, section: s })}><Plus size={13} /> Subsection</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {archived.rows.length > 0 && (
        <div className="mt-8"><h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Archived sections</h3>
          {archived.rows.map((s) => <div key={s.id} className="flex items-center gap-3 text-sm">{s.name}<Button variant="ghost" size="sm" data-testid={`restore-section-${s.id}`} onClick={async () => { await api.post(`/r/sections/${s.id}/restore`); reload(); }}><RotateCcw size={13} /> Restore</Button></div>)}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.row?.id ? "Edit" : edit?.res === "subsections" ? `New subsection in ${edit?.section?.name}` : "New section"} testid="section-modal">
        {edit && <ResourceForm resource={edit.res} fields={edit.res === "sections" ? SEC_FIELDS : SUB_FIELDS} initial={edit.row.id ? edit.row : { client_visible: true }}
          base={{ template_id: templateId, ...(edit.section ? { section_id: edit.section.id } : {}) }} testid="section-form" onSaved={() => { setEdit(null); reload(); }} />}
      </Modal>
    </div>
  );
}
