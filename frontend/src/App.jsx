import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
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
            <Route index element={<Overview />} />
            <Route path="templates" element={<Templates />} />
            <Route path="inputs" element={<Inputs />} />
            <Route path="sections" element={<Sections />} />
            <Route path="line-items" element={<LineItems />} />
            <Route path="packages" element={<Packages />} />
            <Route path="rules" element={<Rules />} />
            <Route path="foundation" element={<FoundationRules />} />
            <Route path="slabs" element={<SlabRules />} />
            <Route path="bathrooms" element={<BathroomRules />} />
            <Route path="units" element={<Units />} />
            <Route path="rate-cards" element={<RateCards />} />
            <Route path="simulator" element={<Simulator />} />
            <Route path="estimates" element={<Estimates />} />
            <Route path="estimates/:id" element={<EstimateDetail />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="errors" element={<ErrorLogs />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
