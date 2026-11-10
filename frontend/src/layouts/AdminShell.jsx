import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, FileStack, SlidersHorizontal, FolderTree, ListChecks, Package, Sigma, Layers, Building2, Bath, Ruler,
  BadgeIndianRupee, FileText, History, Settings, Bug, LogOut, FlaskConical, Landmark, Menu, X, PanelLeftClose, PanelLeftOpen, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { TemplateProvider, useTemplate } from "@/lib/hooks";
import { Badge, Select, cx } from "@/components/ui";

const ROUTE_CAPS = {
  "": "overview.view",
  templates: "templates.view",
  simulator: "simulator.view",
  "gov-estimator": "gov_estimator.view",
  inputs: "catalogue.view",
  sections: "sections.manage",
  "line-items": "line_items.manage",
  packages: "packages.manage",
  rules: "rules.publish",
  foundation: "foundation_rules.manage",
  slabs: "slab_rules.manage",
  bathrooms: "bathroom_rules.manage",
  units: "units.manage",
  "rate-cards": "rate_cards.manage",
  estimates: "estimate.view",
  audit: "audit.view",
  errors: "audit.view",
  settings: "users.manage",
};

const NAV = [
  ["Workspace", [["", "Overview", LayoutDashboard], ["templates", "Templates", FileStack], ["simulator", "Preview Simulator", FlaskConical], ["gov-estimator", "Gov Project Estimator", Landmark]]],
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
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      <span className="hidden text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground md:inline">Template</span>
      <Select data-testid="template-switcher" className="h-9 w-full min-[420px]:w-52 md:w-72" value={templateId || ""} onChange={(e) => setTemplateId(e.target.value)} options={templates.map((t) => [t.id, t.name])} />
      {template && <Badge tone={template.current_version ? "success" : "warning"} data-testid="template-version-badge">{template.current_version ? `Published v${template.current_version}` : "Draft"}</Badge>}
    </div>
  );
}

function Sidebar({ onNav, collapsed = false, onToggle }) {
  const { me, logout } = useAuth();
  const hasCap = (cap) => !!me?.is_super_admin || !!me?.capabilities?.includes(cap);
  const visibleNav = NAV.map(([group, items]) => [group, items.filter(([to]) => {
    if (to === "settings") return !!me?.is_super_admin;
    const requiredCap = ROUTE_CAPS[to];
    if (!requiredCap) return true;
    return hasCap(requiredCap);
  })]).filter(([, items]) => items.length > 0);
  return (
    <aside className={cx("blueprint flex h-full flex-col text-secondary-foreground transition-[width] duration-200 shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)]", collapsed ? "w-20" : "w-64")}>
      <div className={cx("flex items-start border-b border-white/10", collapsed ? "justify-center px-2 py-5" : "justify-between px-5 py-6")}>
        {collapsed ? <div className="font-display text-2xl font-extrabold tracking-tight" title="ArchEngine">A<span className="text-primary">E</span></div> : <div>
          <div className="font-display text-2xl font-extrabold tracking-tight">Arch<span className="text-primary">Engine</span></div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[.25em] text-white/50">Construction cost engine</div>
        </div>}
        {onToggle && <button onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>}
      </div>
      <nav className={cx("flex-1 space-y-5 overflow-y-auto pb-4 pt-4", collapsed ? "px-2" : "px-3")}>
        {visibleNav.map(([group, items]) => (
          <div key={group}>
            {!collapsed && <div className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[.2em] text-white/40">{group}</div>}
            {items.map(([to, label, Icon]) => (
              <NavLink key={to} to={`/admin${to ? "/" + to : ""}`} end={!to} onClick={onNav} data-testid={`nav-${to || "overview"}`}
                title={collapsed ? label : undefined}
                className={({ isActive }) => cx("flex items-center rounded-xl py-2 text-sm transition-all duration-200", collapsed ? "justify-center px-0" : "gap-3 px-3", isActive ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                <Icon size={16} strokeWidth={1.8} />{!collapsed && label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className={cx("border-t border-white/10 text-sm", collapsed ? "p-2" : "p-4")}>
        {!collapsed && <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"><Sparkles size={12} className="text-primary" /><span className="truncate font-medium" data-testid="current-user-email">{me?.user?.email}</span></div>}
        <div className={cx("flex items-center text-xs text-white/60", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <span data-testid="current-user-role">{me?.is_super_admin ? "Super admin · " : ""}{me?.role_label}</span>}
          <button onClick={logout} title="Sign out" data-testid="logout-btn" className={cx("flex items-center rounded px-2 py-1.5 hover:bg-white/10", collapsed ? "justify-center" : "gap-1")}><LogOut size={13} />{!collapsed && "Sign out"}</button>
        </div>
      </div>
    </aside>
  );
}

export default function AdminShell() {
  const { me, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(localStorage.getItem("ae_sidebar_collapsed") === "true");
  const toggleSidebar = () => setCollapsed((value) => {
    localStorage.setItem("ae_sidebar_collapsed", String(!value));
    return !value;
  });
  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!me) return <Navigate to="/login" replace />;
  if (me.role === "client") return <Navigate to="/my" replace />;
  if (!me.organisation_id) return <div className="p-10">Your account has no organisation membership yet.</div>;
  return (
    <TemplateProvider>
      <div className="flex min-h-screen bg-transparent">
        <div className={cx("sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block", collapsed ? "w-20" : "w-64")}><Sidebar collapsed={collapsed} onToggle={toggleSidebar} /></div>
        {open && <div className="fixed inset-0 z-40 flex lg:hidden"><Sidebar onNav={() => setOpen(false)} /><div className="flex-1 bg-black/40" onClick={() => setOpen(false)} /></div>}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-8">
            <button className="rounded-lg border border-border bg-card p-2 text-foreground shadow-sm lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" data-testid="mobile-menu-btn">{open ? <X size={18} /> : <Menu size={18} />}</button>
            <div className="flex-1 min-w-0"><TemplateBar /></div>
            <div className="hidden rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block" data-testid="org-name">{me.memberships.find((m) => m.organisation_id === me.organisation_id)?.name}</div>
          </header>
          <main className="grain flex-1 px-3 py-5 sm:px-5 md:px-8 lg:px-10"><div className="mx-auto max-w-7xl"><Outlet /></div></main>
        </div>
      </div>
    </TemplateProvider>
  );
}
