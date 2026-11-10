import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";

const ROUTE_CAPS = {
  "/admin": "overview.view",
  "/admin/templates": "templates.view",
  "/admin/inputs": "catalogue.view",
  "/admin/sections": "sections.manage",
  "/admin/line-items": "line_items.manage",
  "/admin/packages": "packages.manage",
  "/admin/rules": "rules.publish",
  "/admin/foundation": "foundation_rules.manage",
  "/admin/slabs": "slab_rules.manage",
  "/admin/bathrooms": "bathroom_rules.manage",
  "/admin/units": "units.manage",
  "/admin/rate-cards": "rate_cards.manage",
  "/admin/simulator": "simulator.view",
  "/admin/gov-estimator": "gov_estimator.view",
  "/admin/estimates": "estimate.view",
  "/admin/audit": "audit.view",
  "/admin/errors": "audit.view",
  "/admin/settings": "users.manage",
};

function RequireAccess({ cap, children }) {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;
  if (me.is_super_admin || me.capabilities?.includes(cap)) return children;
  return <Navigate to="/admin" replace />;
}
import AdminShell from "./layouts/AdminShell";
import Login from "./pages/Login";
import ClientEstimate from "./pages/client/ClientEstimate";
import ClientHome from "./pages/client/ClientHome";
import Overview from "./pages/admin/Overview";
import Templates from "./pages/admin/Templates";
import Inputs from "./pages/admin/Inputs";
import Sections from "./pages/admin/Sections";
import LineItems from "./pages/admin/LineItems";
import Packages from "./pages/admin/Packages";
import Rules from "./pages/admin/Rules";
import FoundationRules from "./pages/admin/FoundationRules";
import { SlabRules, BathroomRules } from "./pages/admin/FloorBathRules";
import Units from "./pages/admin/Units";
import RateCards from "./pages/admin/RateCards";
import Estimates from "./pages/admin/Estimates";
import EstimateDetail from "./pages/admin/EstimateDetail";
import Simulator from "./pages/admin/Simulator";
import GovEstimator from "./pages/admin/GovEstimator";
import AuditPage from "./pages/admin/Audit";
import ErrorLogs from "./pages/admin/ErrorLogs";
import Settings from "./pages/admin/Settings";

function Home() {
  const { me, loading } = useAuth();
  if (loading) return null;
  if (!me) return <Navigate to="/login" replace />;
  return <Navigate to={me.role === "client" ? "/my" : "/admin"} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<ClientEstimate kind="s" />} />
          <Route path="/my" element={<ClientHome />} />
          <Route path="/my/:id" element={<ClientEstimate kind="e" />} />
          <Route path="/admin" element={<AdminShell />}>
            <Route index element={<RequireAccess cap={ROUTE_CAPS["/admin"]}><Overview /></RequireAccess>} />
            <Route path="templates" element={<RequireAccess cap={ROUTE_CAPS["/admin/templates"]}><Templates /></RequireAccess>} />
            <Route path="inputs" element={<RequireAccess cap={ROUTE_CAPS["/admin/inputs"]}><Inputs /></RequireAccess>} />
            <Route path="sections" element={<RequireAccess cap={ROUTE_CAPS["/admin/sections"]}><Sections /></RequireAccess>} />
            <Route path="line-items" element={<RequireAccess cap={ROUTE_CAPS["/admin/line-items"]}><LineItems /></RequireAccess>} />
            <Route path="packages" element={<RequireAccess cap={ROUTE_CAPS["/admin/packages"]}><Packages /></RequireAccess>} />
            <Route path="rules" element={<RequireAccess cap={ROUTE_CAPS["/admin/rules"]}><Rules /></RequireAccess>} />
            <Route path="foundation" element={<RequireAccess cap={ROUTE_CAPS["/admin/foundation"]}><FoundationRules /></RequireAccess>} />
            <Route path="slabs" element={<RequireAccess cap={ROUTE_CAPS["/admin/slabs"]}><SlabRules /></RequireAccess>} />
            <Route path="bathrooms" element={<RequireAccess cap={ROUTE_CAPS["/admin/bathrooms"]}><BathroomRules /></RequireAccess>} />
            <Route path="units" element={<RequireAccess cap={ROUTE_CAPS["/admin/units"]}><Units /></RequireAccess>} />
            <Route path="rate-cards" element={<RequireAccess cap={ROUTE_CAPS["/admin/rate-cards"]}><RateCards /></RequireAccess>} />
            <Route path="simulator" element={<RequireAccess cap={ROUTE_CAPS["/admin/simulator"]}><Simulator /></RequireAccess>} />
            <Route path="gov-estimator" element={<RequireAccess cap={ROUTE_CAPS["/admin/gov-estimator"]}><GovEstimator /></RequireAccess>} />
            <Route path="estimates" element={<RequireAccess cap={ROUTE_CAPS["/admin/estimates"]}><Estimates /></RequireAccess>} />
            <Route path="estimates/:id" element={<RequireAccess cap={ROUTE_CAPS["/admin/estimates"]}><EstimateDetail /></RequireAccess>} />
            <Route path="audit" element={<RequireAccess cap={ROUTE_CAPS["/admin/audit"]}><AuditPage /></RequireAccess>} />
            <Route path="errors" element={<RequireAccess cap={ROUTE_CAPS["/admin/errors"]}><ErrorLogs /></RequireAccess>} />
            <Route path="settings" element={<RequireAccess cap={ROUTE_CAPS["/admin/settings"]}><Settings /></RequireAccess>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
