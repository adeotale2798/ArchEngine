import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Table, Tabs, Textarea, Toggle } from "@/components/ui";

const ACCESS_GROUPS = {
  Workspace: ["overview.view", "templates.view", "simulator.view", "gov_estimator.view"],
  Catalogue: ["catalogue.view", "catalogue.manage", "sections.manage", "line_items.manage", "packages.manage"],
  Rules: ["rules.publish", "foundation_rules.manage", "slab_rules.manage", "bathroom_rules.manage"],
  Pricing: ["pricing.view", "units.manage", "rate_cards.manage"],
  Estimates: ["estimate.view", "estimate.create", "estimate.approve", "estimate.issue", "estimate.download"],
  Governance: ["audit.view", "org.manage", "users.manage"],
};

const ROLE_DEFAULT_CAPS = {
  org_admin: Object.values(ACCESS_GROUPS).flat(),
  architect: ["overview.view", "templates.view", "simulator.view", "gov_estimator.view", "catalogue.view", "catalogue.manage", "sections.manage", "line_items.manage", "packages.manage", "rules.publish", "foundation_rules.manage", "slab_rules.manage", "bathroom_rules.manage", "pricing.view", "units.manage", "rate_cards.manage", "estimate.view", "estimate.create", "estimate.approve", "estimate.issue", "estimate.download", "audit.view"],
  reviewer: ["overview.view", "templates.view", "simulator.view", "catalogue.view", "pricing.view", "estimate.view", "estimate.approve", "estimate.download", "audit.view"],
  client: ["overview.view", "templates.view", "simulator.view"],
};

const CAPABILITY_LABELS = {
  "overview.view": "Overview",
  "templates.view": "Templates",
  "simulator.view": "Preview Simulator",
  "gov_estimator.view": "Gov Estimator",
  "catalogue.view": "Building Inputs",
  "catalogue.manage": "Catalogue",
  "sections.manage": "Sections",
  "line_items.manage": "Line Items",
  "packages.manage": "Packages",
  "rules.publish": "Calculation Rules",
  "foundation_rules.manage": "Foundation Rules",
  "slab_rules.manage": "Slab Rules",
  "bathroom_rules.manage": "Bathroom Rules",
  "pricing.view": "Pricing",
  "units.manage": "Units",
  "rate_cards.manage": "Rate Cards",
  "estimate.view": "Client Estimates",
  "estimate.create": "Create Estimates",
  "estimate.approve": "Approve Estimates",
  "estimate.issue": "Issue Estimates",
  "estimate.download": "Download Estimate",
  "audit.view": "Versions & Audit",
  "org.manage": "Organisation",
  "users.manage": "Users & Settings",
};

const capLabel = (cap) => CAPABILITY_LABELS[cap] || cap.split(".").map((part) => part.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())).join(" / ");
const normalizeCaps = (caps) => [...new Set((caps || []).filter(Boolean).map((cap) => String(cap).trim()))];

function AccessMatrix({ capabilities, setCapabilities, disabled = false }) {
  return (
    <div className="space-y-4">
      {Object.entries(ACCESS_GROUPS).map(([group, caps]) => (
        <div key={group} className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.2em] text-muted-foreground">{group}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {caps.map((cap) => (
              <Toggle key={cap} checked={capabilities.includes(cap)} onChange={() => !disabled && setCapabilities((current) => normalizeCaps(current.includes(cap) ? current.filter((item) => item !== cap) : [...current, cap]))} label={capLabel(cap)} disabled={disabled} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

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
      <Card className="grid gap-5 p-6 md:grid-cols-3"><h3 className="font-semibold md:col-span-3">GST, contingency & validity</h3>
        <Toggle checked={s.tax?.enabled} onChange={(v) => setS({ tax: { ...s.tax, enabled: v } })} label="Include GST in estimate totals" data-testid="tax-toggle" />
        <Field label="GST label"><Input value={s.tax?.label || "GST"} onChange={(e) => setS({ tax: { ...s.tax, label: e.target.value } })} /></Field>
        <Field label="GST rate %" help={s.tax?.note || "Leave GST off to show construction budget before GST."}><Input data-testid="tax-rate-input" className="num" value={s.tax?.rate || ""} onChange={(e) => setS({ tax: { ...s.tax, rate: e.target.value } })} /></Field>
        <Toggle checked={s.contingency?.enabled} onChange={(v) => setS({ contingency: { ...s.contingency, enabled: v } })} label="Apply contingency" data-testid="contingency-toggle" />
        <Field label="Contingency %"><Input data-testid="contingency-rate-input" className="num" value={s.contingency?.rate || ""} onChange={(e) => setS({ contingency: { ...s.contingency, rate: e.target.value } })} /></Field>
        <Field label="Estimate validity (days)"><Input className="num" value={s.estimate_validity_days || ""} onChange={(e) => setS({ estimate_validity_days: e.target.value })} /></Field>
        <Toggle checked={s.require_approval_before_issue} onChange={(v) => setS({ require_approval_before_issue: v })} label="Require approval before issue" />
        <div className="md:col-span-2"><div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client download formats</div>
          <div className="flex gap-4">{["pdf", "xlsx", "csv"].map((f) => <Toggle key={f} data-testid={`format-toggle-${f}`} checked={s.export_formats?.includes(f)} onChange={() => fmt(f)} label={f.toUpperCase()} />)}</div></div>
        <Field label="Commercial terms" className="md:col-span-3"><Textarea value={s.terms || ""} onChange={(e) => setS({ terms: e.target.value })} /></Field>
        <Field label="Disclaimer" className="md:col-span-3"><Textarea value={s.disclaimer || ""} onChange={(e) => setS({ disclaimer: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground md:col-span-3">GST and contingency are snapshotted when a template is published. Turn GST off to issue an ex-GST budget; republish to apply policy changes to new estimates.</p></Card>
      <div className="flex justify-end"><Button data-testid="save-settings-btn" onClick={submit}>Save settings</Button></div>
    </div>
  );
}

function Users() {
  const { me } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [open, setOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editCaps, setEditCaps] = useState([]);
  const [f, setF] = useState({ email: "", name: "", role: "client", password: "", capabilities: ROLE_DEFAULT_CAPS.client });

  const load = async () => {
    try {
      const [users, roleList] = await Promise.all([api.get("/org/users"), api.get("/org/roles")]);
      setRows(users.data);
      setRoles(roleList.data);
      if (!f.role || !roleList.data.some((role) => role.key === f.role)) {
        setF((current) => ({ ...current, role: roleList.data[0]?.key || "client" }));
      }
    } catch (e) { notifyError(e); }
  };

  useEffect(() => { if (me?.is_super_admin) load(); }, [me]);

  const patch = async (id, body) => { try { await api.patch(`/org/users/${id}`, body); await load(); } catch (e) { notifyError(e); } };
  const create = async () => {
    try {
      const payload = { ...f, capabilities: normalizeCaps(f.capabilities || ROLE_DEFAULT_CAPS[f.role] || []) };
      await api.post("/org/users", payload);
      toast.success("User created — share the temporary password securely");
      setOpen(false);
      setF({ email: "", name: "", role: "client", password: "", capabilities: ROLE_DEFAULT_CAPS.client });
      await load();
    } catch (e) { notifyError(e); }
  };

  const roleChange = (role) => {
    const caps = ROLE_DEFAULT_CAPS[role] || [];
    setF((current) => ({ ...current, role, capabilities: caps }));
  };

  const openAccessEditor = (user) => {
    setEditUser(user);
    setEditCaps(normalizeCaps(user.capabilities || ROLE_DEFAULT_CAPS[user.role] || []));
    setAccessOpen(true);
  };

  const saveAccess = async () => {
    if (!editUser) return;
    try {
      await api.patch(`/org/users/${editUser.id}`, { role: editUser.role, capabilities: normalizeCaps(editCaps) });
      setAccessOpen(false);
      await load();
      toast.success("User access updated");
    } catch (e) { notifyError(e); }
  };

  if (!me?.is_super_admin) {
    return <Notice tone="info">Platform super admin access is required to create roles, assign access, or manage user permissions.</Notice>;
  }

  return (
    <div className="space-y-6">
      <div className="mb-4 flex justify-end"><Button data-testid="add-user-btn" onClick={() => setOpen(true)}><UserPlus size={15} /> Add user</Button></div>
      <Table head={["Name", "Email", "Role", "Active", "Access"]}>
        {rows.map((u) => (
          <tr key={u.id} data-testid={`user-row-${u.email}`}>
            <td>{u.name}{u.is_super_admin && <Badge tone="primary" className="ml-2">super admin</Badge>}</td>
            <td className="text-sm">{u.email}</td>
            <td>
              <Select className="h-8 w-56" disabled={u.id === me.user.id} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value, capabilities: ROLE_DEFAULT_CAPS[e.target.value] || normalizeCaps(u.capabilities || []) })} options={roles.map((r) => [r.key, r.label])} />
            </td>
            <td><Toggle checked={u.membership_active} onChange={(v) => u.id !== me.user.id && patch(u.id, { active: v })} /></td>
            <td><Button variant="outline" size="sm" onClick={() => openAccessEditor(u)}>Access</Button></td>
          </tr>
        ))}
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Add user" testid="add-user-modal">
        <div className="space-y-4">
          {[["name", "Name"], ["email", "Email"], ["password", "Temporary password (min 10 chars)"]].map(([k, l]) => (
            <Field key={k} label={l}><Input data-testid={`new-user-${k}`} type={k === "password" ? "password" : "text"} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
          ))}
          <Field label="Role"><Select data-testid="new-user-role" value={f.role} onChange={(e) => roleChange(e.target.value)} options={roles.map((r) => [r.key, r.label])} /></Field>
          <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-border bg-card p-3">
            <AccessMatrix capabilities={normalizeCaps(f.capabilities || ROLE_DEFAULT_CAPS[f.role] || [])} setCapabilities={(update) => setF((current) => ({ ...current, capabilities: typeof update === "function" ? update(current.capabilities || []) : update }))} />
          </div>
          <div className="flex justify-end"><Button data-testid="create-user-submit" onClick={create}>Create</Button></div>
        </div>
      </Modal>

      {editUser && <Modal open={accessOpen} onClose={() => setAccessOpen(false)} title={`Edit access · ${editUser.name}`} testid="edit-access-modal">
        <div className="space-y-4">
          <Field label="Role"><Select value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} options={roles.map((r) => [r.key, r.label])} /></Field>
          <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-border bg-card p-3">
            <AccessMatrix capabilities={normalizeCaps(editCaps)} setCapabilities={setEditCaps} />
          </div>
          <div className="flex justify-end"><Button onClick={saveAccess}>Save access</Button></div>
        </div>
      </Modal>}
    </div>
  );
}

export default function Settings() {
  const { me } = useAuth();
  const [tab, setTab] = useState("org");
  const tabs = useMemo(() => (me?.is_super_admin ? [["org", "Organisation"], ["users", "Users & roles"]] : [["org", "Organisation"]]), [me]);
  if (!me?.is_super_admin) {
    return <Notice tone="warning">Platform super admin access is required to manage user roles, permissions and settings.</Notice>;
  }
  return (
    <div>
      <PageHeader eyebrow="Governance" title="Users & settings" subtitle="Organisation branding, GST and contingency policy, client download formats, users and roles." />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === "org" ? <OrgSettings /> : <Users />}
    </div>
  );
}
