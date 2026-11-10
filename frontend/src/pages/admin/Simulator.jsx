import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, FlaskConical, GripVertical, Link2, Pencil, Plus, Save, Settings2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, notifyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTemplate } from "@/lib/hooks";
import EstimateWizard from "@/components/EstimateWizard";
import PackageComparison from "@/components/PackageComparison";
import { Badge, Button, Card, Field, Input, Modal, Notice, PageHeader, Select, Toggle, cx } from "@/components/ui";
import { inr } from "@/lib/format";

const AREA_INPUTS = [
  ["plinth_area_sqft", "Plinth level area", "Measured plinth slab area, in square feet."],
  ["ground_floor_area_sqft", "Ground floor slab area", "Measured ground-floor roof slab area, in square feet."],
  ["typical_floor_area_sqft", "Area per upper-floor slab", "Area used for each upper-floor roof slab, in square feet."],
];
const AREA_INPUT_KEYS = new Set(AREA_INPUTS.map(([key]) => key));

const EMPTY_STATE = { inputs: {}, package_id: null, overrides: {}, manual_quantities: {} };

function amountBeforeGst(totals) {
  return Number(totals?.subtotal || 0) + Number(totals?.contingency || 0);
}

function isCivilPackage(pkg) {
  return String(pkg?.code || "").toUpperCase() === "ONLY_CIVIL" || (!!pkg?.name && /civil/i.test(pkg.name));
}

/** Live admin estimator: compare every package, edit the draft catalogue, and preview the client flow. */
export default function Simulator() {
  const { me } = useAuth();
  const { templateId, template } = useTemplate();
  const canManageOrgSettings = !!me?.is_super_admin;
  const [catalog, setCatalog] = useState(null);
  const [state, setState] = useState(EMPTY_STATE);
  const [results, setResults] = useState({});
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [view, setView] = useState("compare");
  const [gstSaving, setGstSaving] = useState(false);
  const [areaConfigSaving, setAreaConfigSaving] = useState(false);
  const [gstRateDraft, setGstRateDraft] = useState(null);
  const [addType, setAddType] = useState(null);
  const [addDraft, setAddDraft] = useState({});
  const [lineDrafts, setLineDrafts] = useState({});
  const [dragged, setDragged] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDraft, setShareDraft] = useState({ client_name: "", client_email: "", project_name: "", expires_in_days: "14" });
  const [sharePackageIds, setSharePackageIds] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [comparisonOverride, setComparisonOverride] = useState({});
  const [comparisonSearch, setComparisonSearch] = useState("");
  const requestId = useRef(0);

  const loadCatalog = useCallback(async (reset = false) => {
    if (!templateId) return;
    try {
      const orgRequest = canManageOrgSettings ? api.get("/org") : Promise.resolve({ data: {
        name: "",
        branding: {},
        settings: { tax: { enabled: false, label: "GST", rate: "18" } },
      } });
      const [inputs, packages, sections, subsections, lines, options, units, org, foundationRules, slabRules] = await Promise.all([
        api.get("/r/inputs", { params: { template_id: templateId } }), api.get("/r/packages", { params: { template_id: templateId } }),
        api.get("/r/sections", { params: { template_id: templateId } }), api.get("/r/subsections", { params: { template_id: templateId } }),
        api.get("/r/line_items", { params: { template_id: templateId, limit: 2000 } }), api.get("/r/package_options", { params: { template_id: templateId, limit: 2000 } }),
        api.get("/r/units"), orgRequest,
        api.get("/r/foundation_rules", { params: { template_id: templateId } }),
        api.get("/r/slab_rules", { params: { template_id: templateId } }),
      ]);
      const next = { inputs: inputs.data, packages: packages.data, sections: sections.data, subsections: subsections.data,
        lines: lines.data, options: options.data, units: units.data, org: org.data,
        foundationRules: foundationRules.data, slabRules: slabRules.data };
      setCatalog(next);
      if (reset) {
        setState({ ...EMPTY_STATE, inputs: Object.fromEntries(inputs.data.map((d) => [d.key, d.default_value ?? ""])),
          package_id: (packages.data.find((p) => p.is_recommended) || packages.data[0])?.id });
      }
    } catch (e) { notifyError(e); }
  }, [canManageOrgSettings, templateId]);

  useEffect(() => { setCatalog(null); loadCatalog(true); }, [loadCatalog]);

  useEffect(() => {
    if (!catalog?.packages?.length || !templateId) return undefined;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const responses = await Promise.all(catalog.packages.map((pkg) => api.post(`/templates/${templateId}/simulate`, {
          inputs: state.inputs, package_id: pkg.id,
          overrides: { ...(pkg.id === state.package_id ? state.overrides : {}), ...Object.fromEntries(
            Object.entries(comparisonOverride[pkg.id] || {}).map(([lineId, optionPackageId]) => [lineId, { option_package_id: optionPackageId }]),
          ) },
          manual_quantities: state.manual_quantities,
        })));
        if (requestId.current !== id) return;
        setResults(Object.fromEntries(catalog.packages.map((pkg, index) => [pkg.id, responses[index].data])));
      } catch (e) { if (requestId.current === id) notifyError(e); }
      finally { if (requestId.current === id) setBusy(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [catalog, state, templateId, comparisonOverride]);

  const selectedResult = results[state.package_id] || null;
  const comparablePackages = useMemo(() => {
    if (!catalog?.packages?.length) return [];
    const preferredCodes = ["TYPE_A", "TYPE_B", "TYPE_C", "ONLY_CIVIL"];
    const comparableCode = (pkg) => String(pkg?.code || "").trim().toUpperCase().replace(/[-\s]+/g, "_");
    return catalog.packages
      .filter((pkg) => {
        const code = comparableCode(pkg);
        return preferredCodes.includes(code) || isCivilPackage(pkg) || (!code && !isCivilPackage(pkg));
      })
      .sort((a, b) => {
        const aIndex = preferredCodes.indexOf(comparableCode(a));
        const bIndex = preferredCodes.indexOf(comparableCode(b));
        if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? preferredCodes.length : aIndex) - (bIndex === -1 ? preferredCodes.length : bIndex);
        const civilA = isCivilPackage(a);
        const civilB = isCivilPackage(b);
        if (civilA !== civilB) return civilA ? 1 : -1;
        return (a.code || "").localeCompare(b.code || "");
      });
  }, [catalog]);
  const typePackages = useMemo(() => comparablePackages.filter((pkg) => !isCivilPackage(pkg)), [comparablePackages]);
  const civilPackages = useMemo(() => comparablePackages.filter(isCivilPackage), [comparablePackages]);
  const displayPackages = useMemo(() => comparablePackages, [comparablePackages]);
  const hiddenPackageSpecNames = useMemo(() => new Set([
    "plinth level",
    "ground floor roof",
    "upper floor roofs (per floor)",
    "terrace level slab",
    "site development",
    "water tank (ug + oht)",
    "compound wall",
    "parapet wall",
    "terrace waterproofing",
  ]), []);
  const civilPackageIds = useMemo(() => new Set((civilPackages || []).map((pkg) => pkg.id)), [civilPackages]);
  const isFinanceOnlyLine = useCallback((line) => {
    const code = String(line?.code || "").trim().toUpperCase();
    if (code.startsWith("FIN-")) return true;
    const name = (line?.name || "").trim().toLowerCase();
    return hiddenPackageSpecNames.has(name) && !code;
  }, [hiddenPackageSpecNames]);
  const hasCivilPackageValue = useCallback((line) => {
    const lineId = line?.id || line?.line_item_id;
    if (!lineId) return false;
    return (catalog?.options || []).some((option) => civilPackageIds.has(option.package_id) && option.line_item_id === lineId);
  }, [catalog, civilPackageIds]);
  const comparisonLines = useMemo(() => {
    if (!catalog) return [];
    const query = comparisonSearch.trim().toLowerCase();
    const allVisibleLines = catalog.lines.filter((line) => !isFinanceOnlyLine(line) || hasCivilPackageValue(line));
    return allVisibleLines.filter((line) => {
      const lineName = `${line.code || ""} ${line.name || ""}`.trim();
      return !query || lineName.toLowerCase().includes(query);
    });
  }, [catalog, comparisonSearch, hasCivilPackageValue, isFinanceOnlyLine]);

  const optionsByLine = useMemo(() => {
    if (!catalog) return {};
    const packageNames = Object.fromEntries(catalog.packages.map((p) => [p.id, p.name]));
    return catalog.options.reduce((out, option) => {
      if (packageNames[option.package_id]) (out[option.line_item_id] ||= []).push({ package_id: option.package_id,
        package_name: packageNames[option.package_id], label: option.specification_label, details: option.specification_details });
      return out;
    }, {});
  }, [catalog]);

  const patchState = (patch) => setState((current) => ({ ...current, ...patch }));
  const patchInput = (key, value) => patchState({ inputs: { ...state.inputs, [key]: value } });

  const toggleGst = async (enabled) => {
    if (!catalog || gstSaving) return;
    if (!canManageOrgSettings) {
      toast.info("GST settings are controlled by the Platform Super Admin.");
      return;
    }
    const settings = { ...(catalog.org.settings || {}), tax: { ...(catalog.org.settings?.tax || {}), enabled,
      rate: gstRateDraft ?? catalog.org.settings?.tax?.rate ?? "18" } };
    setGstSaving(true);
    try {
      const { data } = await api.patch("/org", { name: catalog.org.name, branding: catalog.org.branding, settings });
      setCatalog((current) => ({ ...current, org: data }));
      setGstRateDraft(null);
      toast.success(enabled ? "GST will be included in estimate totals" : "GST excluded from estimate totals");
    } catch (e) { notifyError(e); }
    finally { setGstSaving(false); }
  };

  const saveGstRate = async () => {
    if (!catalog || gstSaving || gstRateDraft == null || gstRateDraft === "") return;
    if (!canManageOrgSettings) {
      toast.info("GST settings are managed by the Platform Super Admin.");
      return;
    }
    const settings = { ...(catalog.org.settings || {}), tax: { ...(catalog.org.settings?.tax || {}), rate: gstRateDraft } };
    setGstSaving(true);
    try {
      const { data } = await api.patch("/org", { name: catalog.org.name, branding: catalog.org.branding, settings });
      setCatalog((current) => ({ ...current, org: data })); setGstRateDraft(null);
      toast.success("GST rate saved; package budgets recalculated");
    } catch (e) { notifyError(e); }
    finally { setGstSaving(false); }
  };

  const saveAreaConfiguration = async () => {
    if (!catalog || areaConfigSaving) return;
    const findLine = (code, pattern) => catalog.lines.find((line) => line.code === code)
      || catalog.lines.find((line) => pattern.test(line.name || ""));
    const plinthLine = findLine("FIN-01", /plinth/i);
    const groundLine = findLine("FIN-02", /ground floor roof/i);
    const upperLine = findLine("FIN-03", /upper floor roofs/i);
    const foundationRule = catalog.foundationRules.find((rule) => rule.line_item_id === plinthLine?.id);
    const slabRule = catalog.slabRules.find((rule) => rule.line_item_id === upperLine?.id);
    if (!plinthLine || !groundLine || !upperLine || !foundationRule || !slabRule) {
      toast.error("Configure the Plinth Level, Ground Floor Roof, foundation band, and upper-floor slab rule first.");
      return;
    }
    setAreaConfigSaving(true);
    try {
      await Promise.all([
        api.patch(`/r/foundation_rules/${foundationRule.id}`, { quantity_input_key: "plinth_area_sqft" }),
        api.patch(`/r/line_items/${groundLine.id}`, { quantity_input_key: "ground_floor_area_sqft" }),
        api.patch(`/r/slab_rules/${slabRule.id}`, { quantity_input_key: "typical_floor_area_sqft" }),
        ...AREA_INPUTS.map(([key]) => {
          const definition = catalog.inputs.find((item) => item.key === key);
          return definition ? api.patch(`/r/inputs/${definition.id}`, { client_visible: false, client_editable: false }) : Promise.resolve();
        }),
      ]);
      await loadCatalog(false);
      toast.success("Area settings connected to the plinth and slab calculations");
    } catch (e) { notifyError(e); }
    finally { setAreaConfigSaving(false); }
  };

  const createEntry = async () => {
    try {
      if (addType === "section") {
        await api.post("/r/sections", { template_id: templateId, name: addDraft.name, code: addDraft.code || undefined, client_visible: true });
      } else if (addType === "subsection") {
        await api.post("/r/subsections", { template_id: templateId, section_id: addDraft.section_id, name: addDraft.name, client_visible: true });
      } else if (addType === "line") {
        const unit = catalog.units.find((u) => (u.code || "").toLowerCase() === (addDraft.unit || "sft").toLowerCase());
        const { data: line } = await api.post("/r/line_items", { template_id: templateId, section_id: addDraft.section_id,
          subsection_id: addDraft.subsection_id || undefined, code: addDraft.code, name: addDraft.name, unit_id: unit?.id,
          quantity_mode: addDraft.quantity_mode || "FIXED_QUANTITY", fixed_quantity: addDraft.quantity_mode === "INPUT_MULTIPLIER" ? undefined : (addDraft.quantity || "1"),
          input_key: addDraft.quantity_mode === "INPUT_MULTIPLIER" ? addDraft.input_key : undefined,
          factor: addDraft.quantity_mode === "INPUT_MULTIPLIER" ? (addDraft.factor || "1") : undefined,
          inclusion_default: "INCLUDED", client_visible: true,
          client_can_change_option: true, client_price_visibility: "SHOW_RATE" });
        await Promise.all((addDraft.targetPackageIds || []).map((packageId) => api.post("/r/package_options", { template_id: templateId, package_id: packageId,
          line_item_id: line.id, specification_label: addDraft.specification || "To be configured", rate: addDraft.rate })));
      }
      setAddType(null); setAddDraft({});
      await loadCatalog(false);
      toast.success("Draft catalogue updated; package budgets are recalculating");
    } catch (e) { notifyError(e); }
  };

  const saveLine = async (line) => {
    const currentPackage = catalog.packages.find((p) => p.id === state.package_id);
    if (currentPackage && isCivilPackage(currentPackage)) {
      toast.error("Civil work is locked and cannot be edited by the client.");
      return;
    }
    const draft = lineDrafts[line.line_item_id];
    const option = catalog.options.find((o) => o.line_item_id === line.line_item_id && o.package_id === state.package_id);
    const payload = { specification_label: draft?.specification ?? line.specification,
      rate: draft?.rate === "" ? null : (draft?.rate ?? line.rate), specification_details: draft?.details ?? line.specification_details,
      ...(draft?.rate !== undefined ? { rate_card_item_id: null } : {}) };
    try {
      if (option) await api.patch(`/r/package_options/${option.id}`, payload);
      else await api.post("/r/package_options", { ...payload, template_id: templateId, package_id: state.package_id, line_item_id: line.line_item_id });
      setLineDrafts((current) => { const next = { ...current }; delete next[line.line_item_id]; return next; });
      await loadCatalog(false);
      toast.success(`Saved ${line.code} for ${currentPackage?.name}`);
    } catch (e) { notifyError(e); }
  };

  const reorderLines = async (fromId, toId) => {
    if (!fromId || fromId === toId || !catalog) return;
    const ids = catalog.lines.map((l) => l.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    try { await api.post("/r/line_items/reorder", { ids }); await loadCatalog(false); }
    catch (e) { notifyError(e); }
  };

  const createShare = async () => {
    if (!sharePackageIds.length) {
      toast.error("Select at least one package to include in the client link.");
      return;
    }
    try {
      const { data: validation } = await api.post(`/templates/${templateId}/validate`);
      if (!validation.can_publish) {
        const examples = (validation.issues || []).filter((issue) => issue.severity === "critical").slice(0, 3)
          .map((issue) => `${issue.line_code || issue.code}: ${issue.message}`).join(" Â· ");
        toast.error(`Resolve ${validation.critical_count} critical catalogue issue(s) before sharing.${examples ? ` ${examples}` : ""}`);
        return;
      }
      try {
        await api.post(`/templates/${templateId}/publish`, { notes: "Published from the Preview Simulator for client review." });
      } catch (e) {
        const detail = e.response?.data?.detail;
        const message = typeof detail === "string" ? detail : detail?.message || "";
        if (e.response?.status !== 409 || !message.includes("Nothing changed")) throw e;
      }
      const initialPackageId = sharePackageIds.includes(state.package_id) ? state.package_id : sharePackageIds[0];
      const requestedOverrides = { ...state.overrides, ...Object.fromEntries(Object.entries(comparisonOverride[initialPackageId] || {})
        .map(([lineId, optionPackageId]) => [lineId, { option_package_id: optionPackageId }])) };
      const allowedOverrides = Object.fromEntries(Object.entries(requestedOverrides).filter(([, override]) =>
        !override?.option_package_id || sharePackageIds.includes(override.option_package_id)));
      const { data: estimate } = await api.post("/estimates", { template_id: templateId, title: template?.name,
        client_name: shareDraft.client_name, client_email: shareDraft.client_email, project_name: shareDraft.project_name,
        inputs: state.inputs, package_id: initialPackageId,
        overrides: allowedOverrides });
      const { data: link } = await api.post(`/estimates/${estimate.id}/share-links`, {
        expires_in_days: Number(shareDraft.expires_in_days) || 14, can_configure: false, can_download: true,
        allowed_package_ids: sharePackageIds,
      });
      setShareUrl(`${location.origin}/share/${link.token}`);
      toast.success("Secure client preview created. The link can be revoked from the estimate record.");
    } catch (e) { notifyError(e); }
  };

  const applyComparableOverride = (targetPackageId, lineId, sourcePackageId) => {
    if (!lineId || !sourcePackageId || targetPackageId === sourcePackageId) return;
    setComparisonOverride((current) => ({
      ...current,
      [targetPackageId]: { ...(current[targetPackageId] || {}), [lineId]: sourcePackageId },
    }));
  };

  const openAddSpecification = (targetPackageIds) => {
    setAddType("line");
    setAddDraft({ code: "", name: "", section_id: catalog.sections[0]?.id, subsection_id: "", quantity: "1",
      quantity_mode: "FIXED_QUANTITY", input_key: catalog.inputs[0]?.key, factor: "1", unit: "sft", specification: "",
      rate: "0", targetPackageIds });
  };

  if (!catalog) return <div className="text-sm text-muted-foreground">Loading estimator configurationâ€¦</div>;
  const gst = catalog.org.settings?.tax || {};
  const enabledGst = !!gst.enabled;
  const allLines = selectedResult?.lines || [];
  const quotationFinancials = [
    { label: "Plinth Level", description: "Includes excavation, anti-termite, backfilling, RCC foundation, columns, plinth beam/slab and related structural works.", values: { TYPE_A: 750, TYPE_B: 800, TYPE_C: 850 } },
    { label: "Ground Floor Roof", description: "Covers RCC roof slab, beams, masonry, plaster, lintels, slab finish works and all items above plinth to ground-floor roof level.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
    { label: "Upper Floor Roofs (per floor)", description: "Includes floor-wise RCC roof slab, beams, masonry, plaster, waterproofing and standard upper-floor finish items for each typical floor.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
    { label: "Terrace Level Slab", description: "Includes terrace slab work, parapet support, waterproofing preparation and related terrace-level structural items.", values: { TYPE_A: 1900, TYPE_B: 2100, TYPE_C: 2300 } },
    { label: "Site development", description: "Includes site filling, anti-termite treatment, marginal spaces, parking/landscape areas, slab and related earthwork finishing items.", values: { TYPE_A: 475, TYPE_B: 500, TYPE_C: 550 } },
    { label: "Water tank (UG + OHT)", description: "Covers RCC underground and overhead water tank construction plus waterproofing and associated tank works.", values: { TYPE_A: 21, TYPE_B: 23, TYPE_C: 25 } },
    { label: "Compound wall", description: "Includes designer compound wall, gate provisions and related external boundary work as per elevation.", values: { TYPE_A: 350, TYPE_B: 350, TYPE_C: 350 } },
    { label: "Parapet Wall", description: "Includes parapet wall and MS pipe work as per approved design and elevation details.", values: { TYPE_A: 250, TYPE_B: 250, TYPE_C: 250 } },
    { label: "Terrace Waterproofing", description: "Includes brickbat coba, waterproofing treatment and terrace waterproofing layer for the roof top.", values: { TYPE_A: 120, TYPE_B: 120, TYPE_C: 120 } },
  ];

  return (
    <div className="space-y-6" data-testid="preview-simulator">
      <PageHeader eyebrow="Estimator workspace" title="Construction budget simulator"
        subtitle="Compare every package live, adjust the building brief, and fine-tune rates and specifications without leaving the simulator."
        actions={<>
          <Button variant={editMode ? "secondary" : "outline"} data-testid="simulator-edit-toggle" onClick={() => setEditMode(!editMode)}>
            {editMode ? <Check size={15} /> : <Pencil size={15} />}{editMode ? "Editing draft" : "Edit specifications"}
          </Button>
          <Button data-testid="simulator-share-btn" onClick={() => { setShareUrl(""); setSharePackageIds(catalog?.packages.map((pkg) => pkg.id) || []); setShareOpen(true); }}><Link2 size={15} /> Share with client</Button>
        </>} />

      <Notice tone="info" icon={FlaskConical}>
        Live draft preview for <b>{template?.name}</b>. Rate and specification edits save to the draft catalogue; publish only when ready to create a client estimate.
      </Notice>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3"><Settings2 size={18} className="text-primary" /><div><div className="text-sm font-semibold">Budget tax treatment</div>
          <div className="text-xs text-muted-foreground">Main totals {enabledGst ? "include GST" : "exclude GST"}; ex-GST amounts stay visible for comparison.</div></div></div>
        <div className="flex flex-wrap items-center gap-3"><Field label="GST rate %"><Input type="number" min="0" max="100" step="any" className="num h-9 w-24" value={gstRateDraft ?? gst.rate ?? "18"}
          onChange={(e) => setGstRateDraft(e.target.value)} onBlur={saveGstRate} data-testid="simulator-gst-rate" disabled={!canManageOrgSettings} /></Field>
          <Toggle checked={enabledGst} onChange={toggleGst} disabled={gstSaving || !canManageOrgSettings} label={`${gst.label || "GST"} ${enabledGst ? "included" : "excluded"}`} data-testid="simulator-gst-toggle" /></div>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Comparable type selector</div>
            <h2 className="mt-1 text-xl font-bold">Package specifications</h2>
            <p className="mt-1 text-xs text-muted-foreground">Compare Basic, Moderate, and Premium side by side. Civil Work rates appear in their own list. Drag to compare options; double-click to edit.</p>
          </div>
          <Badge tone="info">Civil Work is separate Â· client rates are view-only</Badge>
        </div>
        <div className="mb-4 overflow-x-auto rounded-md border border-border bg-muted/20">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="border-b border-r border-border px-3 py-3 text-left">Sr. No</th>
                <th className="border-b border-r border-border px-3 py-3 text-left">Floor Level</th>
                <th className="border-b border-r border-border px-3 py-3 text-left">Description</th>
                <th className="border-b border-r border-border px-3 py-3 text-right">Type A</th>
                <th className="border-b border-r border-border px-3 py-3 text-right">Type B</th>
                <th className="border-b border-border px-3 py-3 text-right">Type C</th>
              </tr>
            </thead>
            <tbody>
              {quotationFinancials.map((row, index) => (
                <tr key={row.label} className="align-top text-[13px]">
                  <td className="border-b border-r border-border px-3 py-3 font-semibold text-muted-foreground">{index + 1}</td>
                  <td className="border-b border-r border-border px-3 py-3 font-medium">{row.label}</td>
                  <td className="border-b border-r border-border px-3 py-3 text-muted-foreground">{row.description}</td>
                  <td className="border-b border-r border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_A}</td>
                  <td className="border-b border-r border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_B}</td>
                  <td className="border-b border-border px-3 py-3 text-right font-semibold num">{row.values.TYPE_C}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mb-4 max-w-md">
          <Input aria-label="Search comparable specification items" placeholder="Search items, e.g. brickwork" value={comparisonSearch}
            onChange={(e) => setComparisonSearch(e.target.value)} />
        </div>
        <Notice tone="info" className="mb-4">
          <strong>How the math works:</strong> the simulator multiplies the selected brief (for example, bathrooms × quantity per bathroom) and shows the exact formula beside each item so you can see why a value changes from 2 to 5.
        </Notice>
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <PackageComparison packages={[...typePackages, ...civilPackages]} allPackages={comparablePackages} lines={comparisonLines} options={catalog.options} overrides={comparisonOverride} results={results} editable allowEditAll
              onOverrideChange={(targetPackageId, lineId, sourcePackageId) => setComparisonOverride((current) => {
                const next = { ...current, [targetPackageId]: { ...(current[targetPackageId] || {}) } };
                if (sourcePackageId) next[targetPackageId][lineId] = sourcePackageId;
                else delete next[targetPackageId][lineId];
                return next;
              })}
              onSaveOption={async (pkg, line, draft) => {
                const lineId = line.id || line.line_item_id;
                const option = catalog.options.find((item) => item.line_item_id === lineId && item.package_id === pkg.id);
                const payload = { ...draft, rate: draft.rate === "" ? 0 : Number(draft.rate || 0) };
                try {
                  if (option) await api.patch(`/r/package_options/${option.id}`, payload);
                  else await api.post("/r/package_options", { ...payload, template_id: templateId, package_id: pkg.id, line_item_id: lineId });
                  await loadCatalog(false);
                  toast.success(`${pkg.name} specification and rate saved`);
                } catch (e) { notifyError(e); }
              }} />
          </div>
        </div>
        {editMode && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div><div className="text-sm font-semibold">Add more</div><p className="text-xs text-muted-foreground">Double-click any row to update it. Add new civil or package items quickly from the bottom of the table.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" disabled={!catalog.sections.length}
              onClick={() => {
                const targetPackageIds = comparablePackages.filter((pkg) => !isCivilPackage(pkg)).map((pkg) => pkg.id);
                const fallbackPackageIds = comparablePackages.filter(isCivilPackage).map((pkg) => pkg.id);
                openAddSpecification(targetPackageIds.length ? targetPackageIds : fallbackPackageIds);
              }}><Plus size={13} /> Add more</Button>
            <Button size="sm" variant="outline" disabled={!catalog.sections.length || !comparablePackages.some((pkg) => !isCivilPackage(pkg))}
              onClick={() => openAddSpecification(comparablePackages.filter((pkg) => !isCivilPackage(pkg)).map((pkg) => pkg.id))}><Plus size={13} /> Add to A, B & C</Button>
            {comparablePackages.filter(isCivilPackage).map((pkg) => <Button key={pkg.id} size="sm" variant="outline" disabled={!catalog.sections.length}
              onClick={() => openAddSpecification([pkg.id])}><Plus size={13} /> Add Civil Work item</Button>)}
          </div>
        </div>}
      </Card>

      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Simulator view">
        {[["compare", "Budget & packages"], ["client", "Client preview"]].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={view === key} onClick={() => setView(key)} data-testid={`simulator-tab-${key}`}
            className={cx("border-b-2 px-4 py-3 text-sm font-semibold", view === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
        {busy && <span className="ml-auto self-center text-xs text-muted-foreground">Updating live ratesâ€¦</span>}
      </div>

      {view === "client" ? (
        <Card className="overflow-hidden"><Notice tone="info" icon={Sparkles} className="m-5">This is the same step-by-step estimator the client receives. Use the other tab to compare packages and edit the draft catalogue.</Notice>
          <EstimateWizard meta={{ org: catalog.org, template, number: "PREVIEW", title: template?.name }} inputDefs={catalog.inputs} packages={catalog.packages}
            packageTotals={Object.fromEntries(Object.entries(results).map(([id, r]) => [id, r?.totals || {}]))} optionsByLine={optionsByLine}
            state={state} result={selectedResult} editable onUpdate={patchState} busy={busy} exportFormats={[]} /></Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <Card className="p-5" data-testid="simulator-building-brief">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wider text-primary">Step 1 Â· Project brief</div>
                  <h2 className="mt-1 text-xl font-bold">Building size and levels</h2><p className="mt-1 text-sm text-muted-foreground">Set floors and bathrooms here. Configure slab areas in the panel on the right.</p></div></div>
                {catalog.inputs.filter((def) => !AREA_INPUT_KEYS.has(def.key)).length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{catalog.inputs.filter((def) => !AREA_INPUT_KEYS.has(def.key)).map((def) => (
                  <Field key={def.id} label={`${def.label}${def.unit_id ? ` Â· ${catalog.units.find((u) => u.id === def.unit_id)?.code || ""}` : ""}`} help={def.help_text}>
                    {def.input_type === "select" ? <Select value={state.inputs[def.key] ?? ""} onChange={(e) => patchInput(def.key, e.target.value)} options={(def.options || []).map((x) => [x, x])} placeholder="Choose" />
                      : <Input type={def.input_type === "integer" ? "number" : "number"} min={def.min_value ?? undefined} max={def.max_value ?? undefined} step={def.input_type === "integer" ? "1" : "any"}
                        className="num" data-testid={`sim-input-${def.key}`} value={state.inputs[def.key] ?? ""} onChange={(e) => patchInput(def.key, e.target.value)} placeholder="Enter value" />}
                  </Field>))}</div> : <div className="py-5 text-sm text-muted-foreground">No building brief inputs configured.</div>}
              </Card>

              <div><div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wider text-primary">Step 2 Â· Compare</div>
                <h2 className="mt-1 text-xl font-bold">Package budgets side by side</h2></div><Badge tone="info">{catalog.packages.length} package{catalog.packages.length === 1 ? "" : "s"} Â· live rates</Badge></div>
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  {catalog.packages.map((pkg) => {
                    const r = results[pkg.id], t = r?.totals, active = state.package_id === pkg.id;
                    const preTax = amountBeforeGst(t);
                    const highlights = (catalog.options || [])
                      .filter((option) => option.package_id === pkg.id)
                      .slice(0, 3)
                      .map((option) => option.specification_label || option.specification_details || "Included specification");

                    return (
                      <button key={pkg.id} onClick={() => patchState({ package_id: pkg.id })} data-testid={`sim-package-${pkg.code}`}
                        className={cx("overflow-hidden rounded-2xl border bg-card text-left shadow-[0_18px_35px_-30px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-lg", active ? "border-primary ring-2 ring-primary/20" : "border-border")}>
                        <div className="h-32 overflow-hidden border-b border-border bg-muted/40">
                          {pkg.image_url ? <img src={pkg.image_url} alt={pkg.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-100 via-stone-100 to-slate-100 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Package</div>}
                        </div>
                        <div className="space-y-4 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{pkg.code || "Package"}</div>
                              <div className="mt-1 font-display text-2xl font-bold leading-tight">{pkg.name}</div>
                            </div>
                            {active && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Selected</span>}
                          </div>

                          <p className="min-h-[48px] text-sm text-muted-foreground">{pkg.description || "Package specification summary."}</p>

                          <div className="space-y-2 border-t border-border pt-3">
                            {highlights.length ? highlights.map((label, index) => (
                              <div key={`${pkg.id}-${index}`} className="flex items-start gap-2 text-xs text-slate-700">
                                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                                <span>{label}</span>
                              </div>
                            )) : <div className="text-xs text-muted-foreground">No specification items configured yet.</div>}
                          </div>

                          <div className="border-t border-border pt-3">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Indicative total</div>
                            <div className={cx("num mt-2 text-3xl font-bold text-slate-900", busy && "opacity-50")}>{inr(enabledGst ? t?.grand_total : preTax)}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{enabledGst ? "Budget incl. GST" : "Budget ex. GST"}</div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">Ex-GST</div>
                              <div className="num mt-1 font-semibold">{inr(preTax)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">GST {enabledGst ? `(${t?.tax_rate || 0}%)` : "(off)"}</div>
                              <div className="num mt-1 font-semibold">{inr(t?.tax)}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                            <span className="text-muted-foreground">{r?.critical_count ? `${r.critical_count} item(s) need review` : "Rates and rules calculated"}</span>
                            {pkg.is_recommended && <Badge tone="primary">Recommended</Badge>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Card className="overflow-hidden" data-testid="simulator-specifications">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><div className="text-xs font-semibold uppercase tracking-wider text-primary">Step 3 Â· Configure</div>
                  <h2 className="mt-1 text-xl font-bold">{catalog.packages.find((p) => p.id === state.package_id)?.name || "Selected package"} specifications</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Drag rows to reorder. {editMode ? "Edit mode is on: rates and specification names can be changed inline." : "Turn on Edit specifications to change rates, add entries, or reorder."}</p></div>
                  {editMode && <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setAddType("section"); setAddDraft({ name: "", code: "" }); }}><Plus size={13} /> Section</Button>
                    <Button size="sm" variant="outline" disabled={!catalog.sections.length} onClick={() => { setAddType("subsection"); setAddDraft({ name: "", section_id: catalog.sections[0]?.id }); }}><Plus size={13} /> Subsection</Button>
                  </div>}
                </div>
                {!selectedResult && <div className="p-6 text-sm text-muted-foreground">Calculating package ratesâ€¦</div>}
                {selectedResult && <div className="divide-y divide-border">{selectedResult.sections.map((section) => <section key={section.id}>
                  <div className="flex items-center justify-between bg-muted/50 px-5 py-3"><h3 className="font-semibold">{section.name}</h3><span className="num text-sm font-semibold">{inr(section.subtotal)}</span></div>
                  {allLines.filter((line) => line.section_id === section.id).map((line) => {
                    const draft = lineDrafts[line.line_item_id] || {};
                    const option = catalog.options.find((o) => o.line_item_id === line.line_item_id && o.package_id === state.package_id);
                    return <div key={line.line_item_id} draggable onDragStart={() => setDragged(line.line_item_id)} onDragEnd={() => setDragged(null)}
                      onDragOver={(e) => e.preventDefault()} onDrop={() => { reorderLines(dragged, line.line_item_id); setDragged(null); }}
                      className={cx("grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]", dragged === line.line_item_id && "opacity-40")} data-testid={`sim-line-${line.code}`}>
                      <div className="flex min-w-0 gap-3"><button draggable aria-label={`Drag ${line.name} to reorder`} className="mt-1 h-fit cursor-grab text-muted-foreground"><GripVertical size={17} /></button>
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="num text-[11px] text-muted-foreground">{line.code}</span><b className="text-sm">{line.name}</b>
                          <Badge tone={line.status === "UNPRICED" ? "warning" : "muted"}>{line.status === "UNPRICED" ? "Rate needed" : line.inclusion}</Badge></div>
                          {editMode ? <div className="mt-2 grid gap-2 sm:grid-cols-2"><Input aria-label={`Specification for ${line.name}`} data-testid={`sim-spec-${line.code}`} value={draft.specification ?? option?.specification_label ?? line.specification ?? ""}
                            onChange={(e) => setLineDrafts((current) => ({ ...current, [line.line_item_id]: { ...current[line.line_item_id], specification: e.target.value } }))} placeholder="Specification" />
                            <Input aria-label={`Rate for ${line.name}`} data-testid={`sim-rate-${line.code}`} type="number" min="0" step="any" className="num" value={draft.rate ?? option?.rate ?? line.rate ?? ""}
                              onChange={(e) => setLineDrafts((current) => ({ ...current, [line.line_item_id]: { ...current[line.line_item_id], rate: e.target.value } }))} placeholder={option?.rate_card_item_id ? "Enter to set package rate" : "Rate per unit"} />
                            <Input className="sm:col-span-2" aria-label={`Specification details for ${line.name}`} value={draft.details ?? option?.specification_details ?? line.specification_details ?? ""}
                              onChange={(e) => setLineDrafts((current) => ({ ...current, [line.line_item_id]: { ...current[line.line_item_id], details: e.target.value } }))} placeholder="Specification details / brand / finish" />
                            <Button size="sm" className="sm:col-span-2 sm:justify-self-end" disabled={!lineDrafts[line.line_item_id]} onClick={() => saveLine(line)}><Save size={13} /> Save for this package</Button></div>
                            : <><div className="mt-1 text-sm text-muted-foreground">{line.specification || "No specification set"}</div>{line.specification_details && <div className="mt-1 text-xs text-muted-foreground">{line.specification_details}</div>}</>}
                        </div></div>
                      <div className="text-right text-xs"><div className="num text-muted-foreground">{line.quantity} {line.unit}{line.rate ? ` Ã— ${inr(line.rate)}` : ""}</div>
                        <div className="num mt-1 font-semibold">{line.amount == null ? "Hidden" : inr(line.amount)}</div></div>
                    </div>;
                  })}
                </section>)}</div>}
              </Card>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit" data-testid="simulator-budget-summary">
              <Card className="space-y-4 p-5" data-testid="simulator-area-configuration">
                <div><div className="text-xs font-semibold uppercase tracking-wider text-primary">Area configuration</div>
                  <h2 className="mt-1 text-lg font-bold">Slab areas (sft)</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Enter actual areas. Blank fields use the template quantities.</p></div>
                <div className="space-y-3">{AREA_INPUTS.map(([key, label, help]) => {
                  const definition = catalog.inputs.find((item) => item.key === key);
                  return <Field key={key} label={label} help={help}>
                    <Input type="number" min="0" max={definition?.max_value ?? "1000000"} step="any" className="num"
                      data-testid={`sim-area-${key}`} value={state.inputs[key] ?? ""} placeholder="Use template area"
                      onChange={(event) => patchInput(key, event.target.value)} />
                  </Field>;
                })}</div>
                <div className="rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                  Plinth area Ã— foundation rate Â· ground-floor slab area Ã— rate Â· upper floors: (floors âˆ’ 1) Ã— area per slab Ã— rate.
                </div>
                <Button className="w-full" variant="outline" disabled={areaConfigSaving} onClick={saveAreaConfiguration} data-testid="save-area-configuration">
                  {areaConfigSaving ? "Saving area setupâ€¦" : "Apply areas to calculations"}
                </Button>
              </Card>
              <Card className="space-y-4 p-5"><div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live budget Â· {selectedResult?.package?.name || "â€”"}</div>
                <div className={cx("num mt-2 text-4xl font-bold", busy && "opacity-50")}>{inr(enabledGst ? selectedResult?.totals?.grand_total : amountBeforeGst(selectedResult?.totals))}</div>
                <Badge tone={enabledGst ? "success" : "info"}>{enabledGst ? "GST included" : "GST excluded"}</Badge></div>
                <div className="space-y-2 border-t border-border pt-3 text-sm"><div className="flex justify-between"><span>Construction subtotal</span><span className="num">{inr(selectedResult?.totals?.subtotal)}</span></div>
                  {selectedResult?.totals?.contingency_enabled && <div className="flex justify-between"><span>Contingency ({selectedResult.totals.contingency_rate}%)</span><span className="num">{inr(selectedResult.totals.contingency)}</span></div>}
                  <div className="flex justify-between"><span>{gst.label || "GST"} ({enabledGst ? `${selectedResult?.totals?.tax_rate || 0}%` : "off"})</span><span className="num">{inr(selectedResult?.totals?.tax)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Budget total</span><span className="num">{inr(enabledGst ? selectedResult?.totals?.grand_total : amountBeforeGst(selectedResult?.totals))}</span></div></div>
                <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">Rates change with your selected package, building inputs, and inline draft edits. Every value is recalculated by the server engine.</div>
                {selectedResult?.issues?.length > 0 && <div className="space-y-1 text-xs text-warning">{selectedResult.issues.slice(0, 3).map((issue, i) => <div key={i}>{issue.message}</div>)}</div>}
              </Card>
              <Button className="w-full" size="lg" onClick={() => setView("client")}><ExternalLink size={16} /> Open client estimator preview</Button>
              {editMode && <Notice tone="warning" icon={Pencil}>Changes save to the working draft immediately. The client link snapshots a validated, published version.</Notice>}
            </aside>
          </div>
        </div>
      )}

      <Modal open={!!addType} onClose={() => setAddType(null)} title={addType === "section" ? "Add section" : addType === "subsection" ? "Add subsection" : "Add specification"} wide testid="simulator-add-modal">
        <div className="grid gap-4 md:grid-cols-2">
          {addType === "section" && <><Field label="Section name"><Input autoFocus value={addDraft.name || ""} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} /></Field><Field label="Code (optional)"><Input value={addDraft.code || ""} onChange={(e) => setAddDraft({ ...addDraft, code: e.target.value })} /></Field></>}
          {addType === "subsection" && <><Field label="Parent section"><Select value={addDraft.section_id || ""} onChange={(e) => setAddDraft({ ...addDraft, section_id: e.target.value })} options={catalog.sections.map((s) => [s.id, s.name])} /></Field><Field label="Subsection name"><Input autoFocus value={addDraft.name || ""} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} /></Field></>}
          {addType === "line" && <><Field label="Code"><Input autoFocus value={addDraft.code || ""} onChange={(e) => setAddDraft({ ...addDraft, code: e.target.value })} placeholder="e.g. FIN-NEW" /></Field>
            <Field label="Specification / item name"><Input value={addDraft.name || ""} onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })} /></Field>
            <Field label="Section"><Select value={addDraft.section_id || ""} onChange={(e) => setAddDraft({ ...addDraft, section_id: e.target.value, subsection_id: "" })} options={catalog.sections.map((s) => [s.id, s.name])} /></Field>
            <Field label="Subsection"><Select value={addDraft.subsection_id || ""} onChange={(e) => setAddDraft({ ...addDraft, subsection_id: e.target.value })} options={[["", "No subsection"], ...catalog.subsections.filter((s) => s.section_id === addDraft.section_id).map((s) => [s.id, s.name])]} /></Field>
            <Field label="Unit"><Select value={addDraft.unit || "sft"} onChange={(e) => setAddDraft({ ...addDraft, unit: e.target.value })} options={catalog.units.map((u) => [u.code, `${u.code} Â· ${u.name}`])} /></Field>
            <Field label="Quantity basis"><Select value={addDraft.quantity_mode || "FIXED_QUANTITY"} onChange={(e) => setAddDraft({ ...addDraft, quantity_mode: e.target.value })} options={[["FIXED_QUANTITY", "Fixed quantity"], ["INPUT_MULTIPLIER", "Building input Ã— factor"]]} /></Field>
            {addDraft.quantity_mode === "INPUT_MULTIPLIER" ? <><Field label="Building input"><Select value={addDraft.input_key || ""} onChange={(e) => setAddDraft({ ...addDraft, input_key: e.target.value })} options={catalog.inputs.map((i) => [i.key, i.label])} /></Field>
              <Field label="Quantity factor"><Input type="number" min="0" step="any" value={addDraft.factor || "1"} onChange={(e) => setAddDraft({ ...addDraft, factor: e.target.value })} /></Field></>
              : <Field label="Default quantity"><Input type="number" min="0" step="any" value={addDraft.quantity || "1"} onChange={(e) => setAddDraft({ ...addDraft, quantity: e.target.value })} /></Field>}
            <Field label="Initial specification" className="md:col-span-2"><Input value={addDraft.specification || ""} onChange={(e) => setAddDraft({ ...addDraft, specification: e.target.value })} placeholder="Optional; can be customized per package after adding" /></Field>
            <Field label="Starting rate" help="Applied to the selected package set. You can edit each package rate separately afterward."><Input type="number" min="0" step="any" value={addDraft.rate || ""} onChange={(e) => setAddDraft({ ...addDraft, rate: e.target.value })} placeholder="Enter rate per unit" /></Field>
            <Notice tone="info" className="md:col-span-2">This item will be created for {(addDraft.targetPackageIds || []).map((id) => catalog.packages.find((pkg) => pkg.id === id)?.name).filter(Boolean).join(", ") || "no packages"}. Other package columns will remain blank.</Notice></>}
        </div>
          <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setAddType(null)}><X size={14} /> Cancel</Button><Button onClick={createEntry} disabled={!addDraft.name || (addType === "line" && (!addDraft.code || addDraft.rate === "" || !addDraft.targetPackageIds?.length))}><Plus size={14} /> Add to draft</Button></div>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Create a secure client preview" wide testid="simulator-share-modal">
        {!shareUrl ? <div className="space-y-4"><Notice tone="info" icon={Link2}>Sharing validates and publishes this draft, creates a draft estimate, then issues an expiring, revocable client link. The client can change permitted inputs, packages, and specifications.</Notice>
          <div className="grid gap-4 md:grid-cols-2"><Field label="Client name"><Input value={shareDraft.client_name} onChange={(e) => setShareDraft({ ...shareDraft, client_name: e.target.value })} /></Field>
            <Field label="Client email"><Input type="email" value={shareDraft.client_email} onChange={(e) => setShareDraft({ ...shareDraft, client_email: e.target.value })} /></Field>
            <Field label="Project name"><Input value={shareDraft.project_name} onChange={(e) => setShareDraft({ ...shareDraft, project_name: e.target.value })} /></Field>
            <Field label="Link expiry (days)"><Input type="number" min="1" max="90" value={shareDraft.expires_in_days} onChange={(e) => setShareDraft({ ...shareDraft, expires_in_days: e.target.value })} /></Field></div>
          <fieldset className="rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Packages visible in this link</legend>
            <p className="mb-3 text-xs text-muted-foreground">Clients can choose only the packages you include here.</p>
            <div className="grid gap-2 sm:grid-cols-2">{catalog.packages.map((pkg) => <label key={pkg.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <input type="checkbox" checked={sharePackageIds.includes(pkg.id)} onChange={(event) => setSharePackageIds((current) => event.target.checked
                ? [...current, pkg.id] : current.filter((id) => id !== pkg.id))} />{pkg.name}</label>)}</div>
          </fieldset>
          <div className="flex justify-end"><Button onClick={createShare}><Link2 size={15} /> Validate, publish & create link</Button></div>
        </div> : <div className="space-y-4"><Notice tone="success" icon={Check}>Client preview created. This one-time token is shown only now; link expiry and revocation are enforced by the server.</Notice>
          <div className="break-all rounded-md border border-border bg-muted/40 p-4 font-mono text-sm" data-testid="simulator-share-url">{shareUrl}</div>
          <div className="flex flex-wrap justify-end gap-2"><a className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-muted" href={`mailto:${encodeURIComponent(shareDraft.client_email)}?subject=${encodeURIComponent(`Construction estimate Â· ${shareDraft.project_name || template?.name || "Project"}`)}&body=${encodeURIComponent(`Here is your secure construction estimate preview: ${shareUrl}`)}`}><ExternalLink size={14} /> Email client</a>
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(shareUrl); toast.success("Secure link copied"); }}><Copy size={14} /> Copy link</Button>
            <Button onClick={() => setShareOpen(false)}>Done</Button></div>
        </div>}
      </Modal>
    </div>
  );
}

