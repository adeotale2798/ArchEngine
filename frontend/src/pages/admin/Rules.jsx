import { useState } from "react";
import { Plus, Trash2, Play, Sigma } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { save, useList, useTemplate } from "@/lib/hooks";
import CrudTable, { statusBadge } from "@/components/CrudTable";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Textarea, Toggle } from "@/components/ui";

const OPS = [["const", "Number"], ["ref", "Building input / line item"], ["add", "Add (+)"], ["sub", "Subtract (−)"], ["mul", "Multiply (×)"], ["div", "Divide (÷)"],
  ["min", "Minimum of"], ["max", "Maximum of"], ["round", "Round"], ["ceil", "Round up"], ["floor", "Round down"], ["if", "If … then … else"], ["lookup", "Lookup bands"]];
const CMPS = [["gt", ">"], ["gte", "≥"], ["lt", "<"], ["lte", "≤"], ["eq", "="], ["neq", "≠"]];

const blank = (op) => op === "const" ? { const: "1" } : op === "ref" ? { ref: "input.total_floors" } : op === "if"
  ? { op: "if", cond: { op: "gt", args: [{ ref: "input.total_floors" }, { const: "3" }] }, then: { const: "1" }, else: { const: "0" } }
  : op === "lookup" ? { op: "lookup", input: { ref: "input.total_floors" }, bands: [{ min: "1", max: "3", value: "1" }] }
  : ["round", "ceil", "floor"].includes(op) ? { op, args: [{ const: "1" }] } : { op, args: [{ const: "1" }, { const: "1" }] };
const kind = (n) => ("const" in n ? "const" : "ref" in n ? "ref" : n.op);

/** Guided tree editor — produces the safe JSON expression tree; no free-form code. */
function Node({ node, onChange, refs, depth = 0 }) {
  const k = kind(node);
  const set = (patch) => onChange({ ...node, ...patch });
  return (
    <div className={depth ? "ml-2 border-l-2 border-primary/20 pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <Select aria-label="Operation" data-testid={`dsl-op-${depth}`} className="h-9 w-48" value={k} onChange={(e) => onChange(blank(e.target.value))} options={OPS} />
        {k === "const" && <Input aria-label="Number" data-testid={`dsl-const-${depth}`} className="num h-9 w-32" value={node.const} onChange={(e) => onChange({ const: e.target.value })} />}
        {k === "ref" && <Select aria-label="Reference" data-testid={`dsl-ref-${depth}`} className="h-9 w-72" value={node.ref} onChange={(e) => onChange({ ref: e.target.value })} options={refs} />}
        {k === "if" && <span className="text-xs text-muted-foreground">condition compares two values</span>}
      </div>
      {node.args && <>{node.args.map((a, i) => (
        <div key={i} className="flex items-start gap-1"><div className="flex-1"><Node node={a} refs={refs} depth={depth + 1} onChange={(v) => set({ args: node.args.map((x, j) => (j === i ? v : x)) })} /></div>
          {node.args.length > (["round", "ceil", "floor"].includes(k) ? 1 : 2) && <button aria-label="Remove" className="mt-3 text-muted-foreground hover:text-danger" onClick={() => set({ args: node.args.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</div>))}
        {["add", "mul", "min", "max", "sub"].includes(k) && <button data-testid={`dsl-add-arg-${depth}`} className="ml-6 text-xs text-primary" onClick={() => set({ args: [...node.args, { const: "1" }] })}>+ value</button>}</>}
      {k === "if" && <div className="ml-2 space-y-1 border-l-2 border-primary/20 pl-4 text-sm">
        <div className="flex flex-wrap items-center gap-2"><b>If</b>
          <Node node={node.cond.args[0]} refs={refs} depth={depth + 1} onChange={(v) => set({ cond: { ...node.cond, args: [v, node.cond.args[1]] } })} />
          <Select aria-label="Comparison" className="h-9 w-20" value={node.cond.op} onChange={(e) => set({ cond: { ...node.cond, op: e.target.value } })} options={CMPS} />
          <Node node={node.cond.args[1]} refs={refs} depth={depth + 1} onChange={(v) => set({ cond: { ...node.cond, args: [node.cond.args[0], v] } })} /></div>
        <b>Then</b><Node node={node.then} refs={refs} depth={depth + 1} onChange={(v) => set({ then: v })} />
        <b>Else</b><Node node={node.else} refs={refs} depth={depth + 1} onChange={(v) => set({ else: v })} /></div>}
      {k === "lookup" && <div className="ml-2 space-y-2 border-l-2 border-primary/20 pl-4 text-sm">
        <div className="flex items-center gap-2">Input <Node node={node.input} refs={refs} depth={depth + 1} onChange={(v) => set({ input: v })} /></div>
        {node.bands.map((b, i) => <div key={i} className="flex items-center gap-2" data-testid={`dsl-band-${i}`}>from <Input className="num h-8 w-20" value={b.min ?? ""} onChange={(e) => set({ bands: node.bands.map((x, j) => j === i ? { ...x, min: e.target.value } : x) })} />
          to <Input className="num h-8 w-20" value={b.max ?? ""} placeholder="∞" onChange={(e) => set({ bands: node.bands.map((x, j) => j === i ? { ...x, max: e.target.value || null } : x) })} />
          → <Input className="num h-8 w-24" value={b.value} onChange={(e) => set({ bands: node.bands.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />
          <button aria-label="Remove band" onClick={() => set({ bands: node.bands.filter((_, j) => j !== i) })}><Trash2 size={13} /></button></div>)}
        <button className="text-xs text-primary" onClick={() => set({ bands: [...node.bands, { min: "", max: "", value: "0" }] })}>+ band</button></div>}
    </div>
  );
}

function RuleBuilder({ rule, templateId, onSaved }) {
  const inputs = useList("inputs", { template_id: templateId });
  const lines = useList("line_items", { template_id: templateId });
  const units = useList("units");
  const [r, setR] = useState({ name: "", purpose: "", client_explanation: "", internal_approval_note: "", requires_review: false, expression: { op: "mul", args: [{ ref: "input.total_floors" }, { const: "1" }] }, test_cases: [{ inputs: { total_floors: "4", total_bathrooms: "2" }, expected: "" }], ...rule });
  const [out, setOut] = useState(null);
  const refs = [...inputs.rows.map((i) => [`input.${i.key}`, `Input · ${i.label}`]), ...lines.rows.map((l) => [`item.${l.code}`, `Item qty · ${l.code} ${l.name}`])];
  const test = async () => { try { setOut((await api.post(`/templates/${templateId}/rules/test`, { expression: r.expression, test_cases: r.test_cases })).data); } catch (e) { notifyError(e); } };
  const submit = async () => {
    try { const { id, organisation_id, created_at, updated_at, created_by, updated_by, status, sort_order, template_id, ...body } = r; await save("rules", id ? body : { ...body, template_id: templateId }, id); toast.success("Rule saved"); onSaved(); } catch (e) { notifyError(e); }
  };
  const setCase = (i, patch) => setR((x) => ({ ...x, test_cases: x.test_cases.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  return (
    <div className="space-y-6" data-testid="rule-builder">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Rule name"><Input data-testid="rule-name" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        <Field label="Output unit"><Select data-testid="rule-unit" value={r.output_unit_id || ""} onChange={(e) => setR({ ...r, output_unit_id: e.target.value || null })} placeholder="— same as line item —" options={units.rows.map((u) => [u.id, u.code])} /></Field>
        <Field label="Purpose" className="md:col-span-2"><Input data-testid="rule-purpose" value={r.purpose || ""} onChange={(e) => setR({ ...r, purpose: e.target.value })} /></Field>
      </div>
      <Card className="p-4"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formula</div><Node node={r.expression} refs={refs} onChange={(v) => setR({ ...r, expression: v })} /></Card>
      <Card className="space-y-3 p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Test cases</div>
        {r.test_cases.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm" data-testid={`rule-case-${i}`}>
            {inputs.rows.map((inp) => <label key={inp.key} className="flex items-center gap-1">{inp.key}<Input className="num h-8 w-16" value={c.inputs?.[inp.key] ?? ""} onChange={(e) => setCase(i, { inputs: { ...c.inputs, [inp.key]: e.target.value } })} /></label>)}
            <label className="flex items-center gap-1">expected<Input data-testid={`rule-case-expected-${i}`} className="num h-8 w-24" value={c.expected ?? ""} onChange={(e) => setCase(i, { expected: e.target.value })} /></label>
            <button aria-label="Remove case" onClick={() => setR({ ...r, test_cases: r.test_cases.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
          </div>))}
        <div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => setR({ ...r, test_cases: [...r.test_cases, { inputs: {}, expected: "" }] })}><Plus size={13} /> Case</Button>
          <Button variant="outline" size="sm" data-testid="rule-test-btn" onClick={test}><Play size={13} /> Run tests</Button></div>
        {out && <div data-testid="rule-test-output" className="space-y-1 text-sm">
          {out.errors.map((e) => <div key={e} className="text-danger">{e}</div>)}
          {out.explanation && <div className="num rounded bg-muted px-3 py-2 text-xs" data-testid="rule-preview">Quantity = {out.explanation}</div>}
          {out.results.map((x, i) => <div key={i} className="flex gap-2">Case {i + 1}: <span className="num">{x.value ?? x.error}</span>{x.passed !== undefined && <Badge tone={x.passed ? "success" : "danger"}>{x.passed ? "pass" : "fail"}</Badge>}</div>)}
        </div>}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Client explanation"><Textarea data-testid="rule-client-explanation" value={r.client_explanation || ""} onChange={(e) => setR({ ...r, client_explanation: e.target.value })} /></Field>
        <Field label="Internal approval note"><Textarea value={r.internal_approval_note || ""} onChange={(e) => setR({ ...r, internal_approval_note: e.target.value })} /></Field>
      </div>
      <div className="flex items-center justify-between"><Toggle checked={r.requires_review} onChange={(v) => setR({ ...r, requires_review: v })} label="Requires architect review" />
        <Button data-testid="rule-save-btn" onClick={submit}>Save rule</Button></div>
    </div>
  );
}

export default function Rules() {
  const { templateId } = useTemplate();
  const [edit, setEdit] = useState(null);
  const [k, setK] = useState(0);
  return (
    <div>
      <PageHeader eyebrow="Rules" title="Calculation rules" subtitle="Guided formula builder with human-readable preview and test inputs. Formulas are stored as a validated expression tree — nothing is ever executed as code."
        actions={<Button data-testid="add-rule-btn" onClick={() => setEdit({})}><Sigma size={15} /> New rule</Button>} />
      <Notice tone="info" className="mb-6">Attach a rule to a line item by choosing quantity mode <b>Custom formula / Lookup table / Composite</b> in the line item's Quantity tab. Circular references between items are detected and block publishing.</Notice>
      {templateId && <CrudTable key={k} resource="rules" params={{ template_id: templateId }} fields={[]} canEdit={false} testid="rules"
        extraActions={(r) => <Button variant="ghost" size="sm" data-testid={`rule-open-${r.id}`} onClick={() => setEdit(r)}>Open builder</Button>}
        columns={[["name", "Name", (r) => <b>{r.name}</b>], ["purpose", "Purpose"], ["requires_review", "Review", (r) => r.requires_review ? <Badge tone="warning">required</Badge> : "—"], ["status", "Status", statusBadge]]} />}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Rule · ${edit.name}` : "New calculation rule"} wide testid="rule-modal">
        {edit && <RuleBuilder rule={edit} templateId={templateId} onSaved={() => { setEdit(null); setK((x) => x + 1); }} />}
      </Modal>
    </div>
  );
}
