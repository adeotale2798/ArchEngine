import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field, Input, Select, Textarea, Toggle } from "./ui";
import { useList, save } from "@/lib/hooks";
import { notifyError } from "@/lib/api";

function RefSelect({ refRes, params, value, onChange, labelKey = "name", testid }) {
  const { rows } = useList(refRes, params || {});
  return <Select data-testid={testid} value={value || ""} onChange={(e) => onChange(e.target.value || null)} placeholder="— none —"
    options={rows.map((r) => [r.id, r.code ? `${r.code} · ${r[labelKey] || r.name || ""}` : r[labelKey] || r.name])} />;
}

/** Schema-driven field renderer: fields = [{name,label,type,options,ref,params,help,span}] */
export function FieldInput({ f, value, onChange, prefix }) {
  const tid = `${prefix}-${f.name}`;
  if (f.type === "bool") return <div className="pt-6"><Toggle data-testid={tid} checked={!!value} onChange={onChange} label={f.label} /></div>;
  let el;
  if (f.type === "textarea") el = <Textarea data-testid={tid} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === "select") el = <Select data-testid={tid} value={value || ""} onChange={(e) => onChange(e.target.value || null)} options={f.options} placeholder={f.placeholder ?? "— select —"} />;
  else if (f.type === "ref") el = <RefSelect testid={tid} refRes={f.ref} params={f.params} labelKey={f.labelKey} value={value} onChange={onChange} />;
  else if (f.type === "list") el = <Textarea data-testid={tid} value={(value || []).join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} placeholder="One per line" />;
  else el = <Input data-testid={tid} type="text" inputMode={f.type === "number" ? "decimal" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} />;
  return <Field label={f.label} help={f.help}>{el}</Field>;
}

export default function ResourceForm({ resource, fields, initial, base = {}, onSaved, submitLabel = "Save", testid = "resource-form" }) {
  const [data, setData] = useState(initial || {});
  const [busy, setBusy] = useState(false);
  useEffect(() => setData(initial || {}), [initial]);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {};
      fields.forEach((f) => { if (data[f.name] !== undefined) payload[f.name] = f.type === "list" ? (data[f.name] || []).filter(Boolean) : data[f.name] === "" ? null : data[f.name]; });
      const out = await save(resource, initial?.id ? payload : { ...base, ...payload }, initial?.id);
      toast.success("Saved");
      onSaved?.(out);
    } catch (err) { notifyError(err); }
    setBusy(false);
  };
  return (
    <form onSubmit={submit} className="space-y-5" data-testid={testid}>
      <div className="grid gap-5 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.span === 2 || f.type === "textarea" || f.type === "list" ? "md:col-span-2" : ""}>
            <FieldInput f={f} prefix={testid} value={data[f.name]} onChange={(v) => setData((d) => ({ ...d, [f.name]: v }))} />
          </div>
        ))}
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={busy} data-testid={`${testid}-submit`}>{busy ? "Saving…" : submitLabel}</Button></div>
    </form>
  );
}
