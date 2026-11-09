import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Table, Tabs, Textarea, Toggle } from "@/components/ui";

function OrgSettings() {
  const [org, setOrg] = useState(null);
  useEffect(() => { api.get("/org").then((r) => setOrg(r.data)).catch(notifyError); }, []);
  if (!org) return null;
  const s = org.settings || {};
  const b = org.branding || {};
  const setS = (patch) => setOrg({ ...org, settings: { ...s, ...patch } });
  const setB = (patch) => setOrg({ ...org, branding: { ...b, ...patch } });
  const submit = async () => { try { setOrg((await api.patch("/org", { name: org.name, branding: org.branding, settings: org.settings })).data); toast.success("Settings saved"); } catch (e) { notifyError(e); } };
  const fmt = (f) => setS({ export_formats: s.export_formats?.includes(f) ? s.export_formats.filter((x) => x !== f) : [...(s.export_formats || []), f] });
  return (
    <div className="space-y-6" data-testid="org-settings">
      <Card className="grid gap-5 p-6 md:grid-cols-2"><h3 className="font-semibold md:col-span-2">Branding (used on PDF and client pages)</h3>
        <Field label="Organisation name"><Input data-testid="org-name-input" value={org.name} onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field>
        <Field label="Tagline"><Input value={b.tagline || ""} onChange={(e) => setB({ tagline: e.target.value })} /></Field>
        <Field label="Address"><Input value={b.address || ""} onChange={(e) => setB({ address: e.target.value })} /></Field>
        <Field label="Phone"><Input value={b.phone || ""} onChange={(e) => setB({ phone: e.target.value })} /></Field>
        <Field label="Email"><Input value={b.email || ""} onChange={(e) => setB({ email: e.target.value })} /></Field>
        <Field label="Brand colour (hex)"><Input value={b.primary_color || ""} onChange={(e) => setB({ primary_color: e.target.value })} /></Field></Card>
      <Card className="grid gap-5 p-6 md:grid-cols-3"><h3 className="font-semibold md:col-span-3">Tax, contingency & validity</h3>
        <Toggle checked={s.tax?.enabled} onChange={(v) => setS({ tax: { ...s.tax, enabled: v } })} label="Apply tax" data-testid="tax-toggle" />
        <Field label="Tax label"><Input value={s.tax?.label || ""} onChange={(e) => setS({ tax: { ...s.tax, label: e.target.value } })} /></Field>
        <Field label="Tax rate %" help={s.tax?.note}><Input data-testid="tax-rate-input" className="num" value={s.tax?.rate || ""} onChange={(e) => setS({ tax: { ...s.tax, rate: e.target.value } })} /></Field>
        <Toggle checked={s.contingency?.enabled} onChange={(v) => setS({ contingency: { ...s.contingency, enabled: v } })} label="Apply contingency" data-testid="contingency-toggle" />
        <Field label="Contingency %"><Input data-testid="contingency-rate-input" className="num" value={s.contingency?.rate || ""} onChange={(e) => setS({ contingency: { ...s.contingency, rate: e.target.value } })} /></Field>
        <Field label="Estimate validity (days)"><Input className="num" value={s.estimate_validity_days || ""} onChange={(e) => setS({ estimate_validity_days: e.target.value })} /></Field>
        <Toggle checked={s.require_approval_before_issue} onChange={(v) => setS({ require_approval_before_issue: v })} label="Require approval before issue" />
        <div className="md:col-span-2"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client download formats</div>
          <div className="flex gap-4">{["pdf", "xlsx", "csv"].map((f) => <Toggle key={f} data-testid={`format-toggle-${f}`} checked={s.export_formats?.includes(f)} onChange={() => fmt(f)} label={f.toUpperCase()} />)}</div></div>
        <Field label="Commercial terms" className="md:col-span-3"><Textarea value={s.terms || ""} onChange={(e) => setS({ terms: e.target.value })} /></Field>
        <Field label="Disclaimer" className="md:col-span-3"><Textarea value={s.disclaimer || ""} onChange={(e) => setS({ disclaimer: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground md:col-span-3">Tax and contingency are snapshotted when a template is published — republish to apply changes to new estimates.</p></Card>
      <div className="flex justify-end"><Button data-testid="save-settings-btn" onClick={submit}>Save settings</Button></div>
    </div>
  );
}

function Users() {
  const { me } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", name: "", role: "client", password: "" });
  const load = () => Promise.all([api.get("/org/users"), api.get("/org/roles")]).then(([u, r]) => { setRows(u.data); setRoles(r.data); }).catch(notifyError);
  useEffect(() => { load(); }, []);
  const create = async () => { try { await api.post("/org/users", f); toast.success("User created — share the temporary password securely"); setOpen(false); load(); } catch (e) { notifyError(e); } };
  const patch = async (id, body) => { try { await api.patch(`/org/users/${id}`, body); load(); } catch (e) { notifyError(e); } };
  return (
    <div>
      <div className="mb-4 flex justify-end"><Button data-testid="add-user-btn" onClick={() => setOpen(true)}><UserPlus size={15} /> Add user</Button></div>
      <Table head={["Name", "Email", "Role", "Active", ""]}>
        {rows.map((u) => <tr key={u.id} data-testid={`user-row-${u.email}`}><td>{u.name}{u.is_super_admin && <Badge tone="primary" className="ml-2">super admin</Badge>}</td><td className="text-sm">{u.email}</td>
          <td><Select className="h-8 w-56" disabled={u.id === me.user.id} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} options={roles.map((r) => [r.key, r.label])} /></td>
          <td><Toggle checked={u.membership_active} onChange={(v) => u.id !== me.user.id && patch(u.id, { active: v })} /></td><td /></tr>)}
      </Table>
      <Modal open={open} onClose={() => setOpen(false)} title="Add user" testid="add-user-modal">
        <div className="space-y-4">{[["name", "Name"], ["email", "Email"], ["password", "Temporary password (min 10 chars)"]].map(([k, l]) => <Field key={k} label={l}><Input data-testid={`new-user-${k}`} type={k === "password" ? "password" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
          <Field label="Role"><Select data-testid="new-user-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={roles.map((r) => [r.key, r.label])} /></Field>
          <div className="flex justify-end"><Button data-testid="create-user-submit" onClick={create}>Create</Button></div></div>
      </Modal>
    </div>
  );
}

export default function Settings() {
  const [tab, setTab] = useState("org");
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Users & settings" subtitle="Organisation branding, tax and contingency policy, client download formats, users and roles." />
      <Tabs tabs={[["org", "Organisation"], ["users", "Users & roles"]]} value={tab} onChange={setTab} />
      {tab === "org" ? <OrgSettings /> : <Users />}
    </div>
  );
}
