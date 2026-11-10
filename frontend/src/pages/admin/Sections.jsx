import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Archive, FolderOpen, Pencil, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useList, useTemplate } from "@/lib/hooks";
import ResourceForm from "@/components/ResourceForm";
import { Badge, Button, Card, Empty, Modal, PageHeader } from "@/components/ui";
import { INCLUSIONS, QTY_MODES } from "@/lib/format";

const SEC_FIELDS = [{ name: "code", label: "Code" }, { name: "name", label: "Name" }, { name: "description", label: "Description", type: "textarea" },
  { name: "image_url", label: "Image URL (shown to clients)", span: 2 }, { name: "client_visible", label: "Visible to client", type: "bool" }];
const SUB_FIELDS = [{ name: "name", label: "Name" }, { name: "code", label: "Code" }, { name: "description", label: "Description", type: "textarea" }];
const LINE_FIELDS = [
  { name: "code", label: "Specification code" },
  { name: "name", label: "Specification name" },
  { name: "description", label: "Description / scope", type: "textarea", span: 2 },
  { name: "unit_id", label: "Quantity unit", type: "ref", ref: "units" },
  { name: "quantity_mode", label: "Quantity basis", type: "select", options: QTY_MODES },
  { name: "fixed_quantity", label: "Default quantity", type: "number", help: "Used when quantity basis is Fixed. Area-based rules can be connected in the Simulator." },
  { name: "inclusion_default", label: "Default inclusion", type: "select", options: INCLUSIONS },
];

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
  const lines = useList("line_items", { template_id: templateId });
  const packages = useList("packages", { template_id: templateId });
  const archived = useList("sections", { template_id: templateId, status: "archived" });
  const [edit, setEdit] = useState(null);
  const reload = () => { secs.reload(); subs.reload(); lines.reload(); packages.reload(); archived.reload(); };
  const addSpecification = (section, subsection = null, civilOnly = false) => setEdit({
    res: "line_items",
    row: { code: "", name: "", description: "", unit_id: null, quantity_mode: "FIXED_QUANTITY", fixed_quantity: "1", inclusion_default: "INCLUDED" },
    section,
    subsection,
    civilOnly,
  });
  const onSpecificationSaved = async (line, civilOnly) => {
    try {
      const targetPackages = packages.rows.filter((pkg) => civilOnly
        ? pkg.code === "ONLY_CIVIL" || /civil/i.test(pkg.name || "")
        : ["TYPE_A", "TYPE_B", "TYPE_C"].includes(pkg.code));
      await Promise.all(targetPackages.map((pkg) => api.post("/r/package_options", {
        template_id: templateId,
        package_id: pkg.id,
        line_item_id: line.id,
        specification_label: "To be configured",
        rate: null,
      })));
      toast.success(civilOnly
        ? "Civil Work item added. Configure its rate in the Simulator."
        : "Specification added to Type A, B, and C. Configure each type’s specification and rate in the Simulator.");
      setEdit(null);
      reload();
    } catch (error) {
      notifyError(error);
      setEdit(null);
      reload();
    }
  };
  return (
    <div>
      <PageHeader eyebrow="Catalogue" title="Sections & subsections" subtitle="Structure the BOQ. Reorder, duplicate or archive — archived entries stay in historical estimates."
        actions={<Button data-testid="add-section-btn" onClick={() => setEdit({ res: "sections", row: {} })}><Plus size={15} /> Add section</Button>} />
      {secs.rows.length === 0 && !secs.loading ? <Empty icon={FolderOpen} title="No sections yet">Add your first section, e.g. Foundation or Plumbing.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {secs.rows.map((s, i) => {
            const children = subs.rows.filter((x) => x.section_id === s.id);
            const directLines = lines.rows.filter((line) => line.section_id === s.id && !line.subsection_id);
            return (
              <Card key={s.id} className="overflow-hidden" data-testid={`section-card-${s.code || s.id}`}>
                {s.image_url && <img src={s.image_url} alt="" className="h-24 w-full object-cover" />}
                <div className="p-5">
                  <Row r={s} res="sections" list={secs.rows} idx={i} onReload={reload} tid="section" onEdit={() => setEdit({ res: "sections", row: s })}>
                    <span className="num text-xs text-muted-foreground">{s.code}</span><span className="font-display text-lg font-semibold">{s.name}</span>
                    {s.client_visible === false && <Badge>internal</Badge>}
                  </Row>
                  <div className="ml-3 mt-2 border-l-2 border-primary/20 pl-4">
                    {directLines.map((line, lineIndex) => <Row key={line.id} r={line} res="line_items" list={directLines} idx={lineIndex}
                      onReload={reload} tid="section-line" onEdit={() => { window.location.href = `/admin/line-items?line=${encodeURIComponent(line.id)}`; }}>
                      <span className="num text-xs text-muted-foreground">{line.code}</span><span className="text-sm">{line.name}</span>
                    </Row>)}
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" data-testid={`add-specification-${s.id}`} onClick={() => addSpecification(s)}><Plus size={13} /> Add to Type A, B & C</Button>
                      <Button variant="ghost" size="sm" data-testid={`add-civil-specification-${s.id}`} onClick={() => addSpecification(s, null, true)}><Plus size={13} /> Add Civil Work item</Button>
                    </div>
                    {children.map((c, j) => (
                      <div key={c.id} className="mt-2 border-t border-border/70 pt-2">
                        <Row r={c} res="subsections" list={children} idx={j} onReload={reload} tid="subsection" onEdit={() => setEdit({ res: "subsections", row: c })}>
                          <span className="text-sm">{c.name}</span>
                        </Row>
                        {lines.rows.filter((line) => line.subsection_id === c.id).map((line, lineIndex, rows) => <Row key={line.id} r={line} res="line_items" list={rows} idx={lineIndex}
                          onReload={reload} tid="subsection-line" onEdit={() => { window.location.href = `/admin/line-items?line=${encodeURIComponent(line.id)}`; }}>
                          <span className="num text-xs text-muted-foreground">{line.code}</span><span className="text-sm">{line.name}</span>
                        </Row>)}
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" data-testid={`add-specification-${c.id}`} onClick={() => addSpecification(s, c)}><Plus size={13} /> Add to Type A, B & C</Button>
                          <Button variant="ghost" size="sm" data-testid={`add-civil-specification-${c.id}`} onClick={() => addSpecification(s, c, true)}><Plus size={13} /> Add Civil Work item</Button>
                        </div>
                      </div>
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
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.row?.id ? "Edit" : edit?.res === "line_items" ? `${edit?.civilOnly ? "Add Civil Work item" : "Add Type A, B & C specification"} · ${edit?.subsection?.name || edit?.section?.name}` : edit?.res === "subsections" ? `New subsection in ${edit?.section?.name}` : "New section"} testid="section-modal" wide>
        {edit && <ResourceForm resource={edit.res} fields={edit.res === "sections" ? SEC_FIELDS : edit.res === "subsections" ? SUB_FIELDS : LINE_FIELDS}
          initial={edit.row.id ? edit.row : edit.res === "line_items" ? edit.row : { client_visible: true }}
          base={{ template_id: templateId, ...(edit.section ? { section_id: edit.section.id } : {}), ...(edit.subsection ? { subsection_id: edit.subsection.id } : {}),
            ...(edit.res === "line_items" ? { client_visible: true, client_can_change_option: true, client_price_visibility: "SHOW_RATE" } : {}) }}
          testid="section-form" onSaved={edit.res === "line_items" ? (line) => onSpecificationSaved(line, edit.civilOnly) : () => { setEdit(null); reload(); }} />}
      </Modal>
    </div>
  );
}
