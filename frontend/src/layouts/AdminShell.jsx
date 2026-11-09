import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FileStack, SlidersHorizontal, FolderTree, ListChecks, Package, Sigma, Layers, Building2, Bath, Ruler,
  BadgeIndianRupee, FileText, History, Settings, Bug, LogOut, FlaskConical, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TemplateProvider, useTemplate } from "@/lib/hooks";
import { Badge, Select, cx } from "@/components/ui";

const NAV = [
  ["Workspace", [["", "Overview", LayoutDashboard], ["templates", "Templates", FileStack], ["simulator", "Preview Simulator", FlaskConical]]],
  ["Catalogue", [["inputs", "Building Inputs", SlidersHorizontal], ["sections", "Sections & Subsections", FolderTree], ["line-items", "Line Items", ListChecks], ["packages", "Packages", Package]]],
  ["Rules", [["rules", "Calculation Rules", Sigma], ["foundation", "Foundation Rules", Building2], ["slabs", "Slab Rules", Layers], ["bathrooms", "Bathroom Rules", Bath]]],
  ["Pricing", [["units", "Units", Ruler], ["rate-cards", "Rate Cards", BadgeIndianRupee]]],
  ["Estimates", [["estimates", "Client Estimates", FileText]]],
  ["Governance", [["audit", "Versions & Audit", History], ["errors", "Error Logs", Bug], ["settings", "Users & Settings", Settings]]],
];

function TemplateBar() {
  const { templates, templateId, setTemplateId, template } = useTemplate();
  if (!templates.length) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground md:inline">Template</span>
      <Select data-testid="template-switcher" className="h-9 w-72" value={templateId || ""} onChange={(e) => setTemplateId(e.target.value)} options={templates.map((t) => [t.id, t.name])} />
      {template && <Badge tone={template.current_version ? "success" : "warning"} data-testid="template-version-badge">{template.current_version ? `Published v${template.current_version}` : "Draft · unpublished"}</Badge>}
    </div>
  );
}

function Sidebar({ onNav }) {
  const { me, logout } = useAuth();
  return (
    <aside className="blueprint flex h-full w-64 flex-col text-secondary-foreground">
      <div className="px-5 py-6">
        <div className="font-display text-2xl font-extrabold tracking-tight">Arch<span className="text-primary">Engine</span></div>
        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[.25em] text-white/50">Construction cost engine</div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map(([group, items]) => (
          <div key={group}>
            <div className="px-3 pb-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-white/40">{group}</div>
            {items.map(([to, label, Icon]) => (
              <NavLink key={to} to={`/admin${to ? "/" + to : ""}`} end={!to} onClick={onNav} data-testid={`nav-${to || "overview"}`}
                className={({ isActive }) => cx("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", isActive ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                <Icon size={16} strokeWidth={1.8} />{label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 text-sm">
        <div className="truncate font-medium" data-testid="current-user-email">{me?.user?.email}</div>
        <div className="flex items-center justify-between text-xs text-white/60">
          <span data-testid="current-user-role">{me?.is_super_admin ? "Super admin · " : ""}{me?.role_label}</span>
          <button onClick={logout} data-testid="logout-btn" className="flex items-center gap-1 rounded px-2 py-1 hover:bg-white/10"><LogOut size={13} /> Sign out</button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminShell() {
  const { me, loading } = useAuth();
  const [open, setOpen] = useState(false);
  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (me.role === "client") return <Navigate to="/my" replace />;
  if (!me.organisation_id) return <div className="p-10">Your account has no organisation membership yet.</div>;
  return (
    <TemplateProvider>
      <div className="flex min-h-screen">
        <div className="sticky top-0 hidden h-screen lg:block"><Sidebar /></div>
        {open && <div className="fixed inset-0 z-40 flex lg:hidden"><Sidebar onNav={() => setOpen(false)} /><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-xl md:px-8">
            <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" data-testid="mobile-menu-btn">{open ? <X /> : <Menu />}</button>
            <TemplateBar />
            <div className="ml-auto text-sm text-muted-foreground" data-testid="org-name">{me.memberships.find((m) => m.organisation_id === me.organisation_id)?.name}</div>
          </header>
          <main className="grain flex-1 px-4 py-8 md:px-10"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
        </div>
      </div>
    </TemplateProvider>
  );
}
