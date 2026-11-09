import { useEffect, useState } from "react";
import { CheckCircle2, Download, Rocket, Upload, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api, download, errMsg, notifyError } from "@/lib/api";
import { date } from "@/lib/format";
import { useTemplate } from "@/lib/hooks";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import ResourceForm from "@/components/ResourceForm";
import { Badge, Button, Card, Field, Modal, Notice, PageHeader, Table, Textarea } from "@/components/ui";

const TPL_FIELDS = [
  { name: "name", label: "Template name", span: 2 }, { name: "description", label: "Description", type: "textarea" },
  { name: "intro_text", label: "Client introduction text", type: "textarea" }, { name: "hero_image_url", label: "Client hero image URL", span: 2 },
  { name: "assumptions", label: "Assumptions (client-visible)", type: "list" }, { name: "exclusions", label: "Exclusions (client-visible)", type: "list" },
];

function Validation({ report }) {
  if (!report) return null;
  return (
    <div className="space-y-2" data-testid="validation-report">
      <div className="flex gap-2"><Badge tone={report.critical_count ? "danger" : "success"}>{report.critical_count} critical</Badge><Badge tone="warning">{report.warning_count} warnings</Badge></div>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">{report.issues.map((i, n) => <li key={n} className="flex gap-2"><Badge tone={i.severity === "critical" ? "danger" : "warning"}>{i.severity}</Badge>{i.message}</li>)}</ul>
    </div>
  );
}

function ImportCsv({ templateId }) {
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const run = async (commit) => {
    try { const r = await api.post(`/templates/${templateId}/import`, { csv_text: text, commit }); setRes(r.data); if (r.data.committed) toast.success("Imported into draft"); } catch (e) { notifyError(e); }
  };
  const onFile = (f) => f && f.text().then(setText);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Columns: section, subsection, code, name, description, unit, quantity_mode, fixed_quantity, inclusion, package_code, specification, rate. Rows are matched by stable <b>code</b>; imports always go into the draft and must be validated and published.</p>
      <input type="file" accept=".csv" data-testid="import-file" onChange={(e) => onFile(e.target.files[0])} />
      <Field label="CSV content"><Textarea data-testid="import-text" className="num min-h-[140px] text-xs" value={text} onChange={(e) => setText(e.target.value)} /></Field>
      <div className="flex gap-2"><Button variant="outline" data-testid="import-preview-btn" onClick={() => run(false)}>Preview changes</Button>
        <Button data-testid="import-commit-btn" disabled={!res || res.errors.length > 0} onClick={() => run(true)}>Commit to draft</Button></div>
      {res && (
        <div data-testid="import-result" className="space-y-2 text-sm">
          {res.errors.map((e) => <div key={e} className="text-danger">{e}</div>)}
          <div>{res.plan.filter((p) => p.action === "create").length} to create · {res.plan.filter((p) => p.action === "update").length} to update {res.committed && "· committed"}</div>
        </div>
      )}
    </div>
  );
}

export default function Templates() {
  const { templateId, template, reloadTemplates } = useTemplate();
  const [report, setReport] = useState(null);
  const [versions, setVersions] = useState([]);
  const [notes, setNotes] = useState("");
  const [modal, setModal] = useState(null);
  const loadVersions = () => templateId && api.get(`/templates/${templateId}/versions`).then((r) => setVersions(r.data));
  useEffect(() => { loadVersions(); setReport(null); }, [templateId]); // eslint-disable-line
  const validate = async () => { try { setReport((await api.post(`/templates/${templateId}/validate`)).data); } catch (e) { notifyError(e); } };
  const publish = async () => {
    try {
      const r = await api.post(`/templates/${templateId}/publish`, { notes });
      toast.success(`Published version ${r.data.version}`); setNotes(""); loadVersions(); reloadTemplates();
    } catch (e) { const d = e.response?.data?.detail; if (d?.report) setReport(d.report); toast.error(errMsg(e)); }
  };
  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Templates" title="Estimate templates & versions" subtitle="Edit the draft freely. Publishing freezes an immutable snapshot that new estimates use; issued estimates never change."
        actions={template && <>
          <Button variant="outline" data-testid="export-catalogue-btn" onClick={() => download(`/templates/${templateId}/export.csv`, "catalogue.csv")}><Download size={15} /> Export CSV</Button>
          <Button variant="outline" data-testid="import-catalogue-btn" onClick={() => setModal("import")}><Upload size={15} /> Import CSV</Button>
          <Button variant="outline" data-testid="edit-template-btn" onClick={() => setModal("edit")}>Edit details</Button>
        </>} />
      {template && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-4 p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldAlert size={18} /> Validate & publish</h2>
            <Notice tone="info">Publishing is blocked while critical issues exist (missing rates, overlapping bands, invalid formulas, circular dependencies, unit mismatches).</Notice>
            <Field label="Release notes"><Textarea data-testid="publish-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed in this version?" /></Field>
            <div className="flex gap-2"><Button variant="outline" data-testid="validate-btn" onClick={validate}><CheckCircle2 size={15} /> Validate</Button>
              <Button data-testid="publish-btn" onClick={publish}><Rocket size={15} /> Publish new version</Button></div>
            <Validation report={report} />
          </Card>
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Published versions</h2>
            {versions.length === 0 ? <p className="text-sm text-muted-foreground">Not published yet.</p> : (
              <Table head={["Version", "Published", "By", "Warnings", "Notes"]}>
                {versions.map((v) => <tr key={v.id} data-testid={`version-row-${v.version}`}><td className="num font-semibold">v{v.version}</td><td>{date(v.published_at)}</td><td className="text-xs">{v.published_by_email}</td><td className="num">{v.validation?.warning_count}</td><td className="text-xs">{v.notes}</td></tr>)}
              </Table>
            )}
          </Card>
        </div>
      )}
      <CrudTable resource="templates" title="All templates" fields={TPL_FIELDS} testid="templates"
        columns={[["name", "Name", (r) => <span className="font-medium">{r.name}</span>], ["current_version", "Published", (r) => r.current_version ? `v${r.current_version}` : "Draft"], ["status", "Status", statusBadge]]} />
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Template details" wide testid="template-edit-modal">
        <ResourceForm resource="templates" fields={TPL_FIELDS} initial={template} testid="template-form" onSaved={() => { setModal(null); reloadTemplates(); }} />
      </Modal>
      <Modal open={modal === "import"} onClose={() => setModal(null)} title="Import catalogue rows" wide testid="import-modal"><ImportCsv templateId={templateId} /></Modal>
    </div>
  );
}
