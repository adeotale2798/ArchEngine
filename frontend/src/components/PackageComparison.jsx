import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Badge, Input, cx } from "@/components/ui";
import { inr } from "@/lib/format";

const PALETTES = {
  TYPE_A: { title: "Type A", border: "#d97706", tint: "#fffaf0", badge: "warning" },
  TYPE_B: { title: "Type B", border: "#0891b2", tint: "#f0fcff", badge: "info" },
  TYPE_C: { title: "Type C", border: "#7c3aed", tint: "#faf7ff", badge: "primary" },
  ONLY_CIVIL: { title: "Civil Work", border: "#6b7280", tint: "#f8fafc", badge: "secondary" },
};

export default function PackageComparison({ packages, lines, options, overrides = {}, results = {}, editable = false, showRates = true,
  selectedPackageId, allowEditAll = false, lockedPackageIds = [], allPackages = packages, onOverrideChange, onSaveOption }) {
  const [drag, setDrag] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [drafts, setDrafts] = useState({});

  const columnCount = Math.max(packages.length || 1, 1);
  const gridCols = `repeat(${columnCount}, minmax(210px, 1fr))`;
  const keyOf = (packageId, lineId) => `${packageId}:${lineId}`;
  const packageFor = (packageId) => allPackages.find((candidate) => candidate.id === packageId);
  const paletteFor = (pkg) => PALETTES[pkg?.code] || (pkg?.name && /civil/i.test(pkg.name)
    ? PALETTES.ONLY_CIVIL : PALETTES.TYPE_A);

  const cellsByLine = useMemo(() => lines.map((line) => {
    const lineId = line.id || line.line_item_id;
    return {
      line,
      lineId,
      cells: packages.map((pkg) => {
        const packageId = pkg.id;
        const overrideValue = overrides?.[packageId]?.[lineId];
        const sourcePackageId = typeof overrideValue === "string" ? overrideValue : overrideValue?.option_package_id || null;
        const option = options.find((item) => item.line_item_id === lineId && item.package_id === (sourcePackageId || packageId));
        const budgetLine = results?.[packageId]?.lines?.find((item) => item.line_item_id === lineId);
        return { pkg, packageId, sourcePackageId, option, budgetLine };
      }),
    };
  }), [lines, packages, overrides, options, results]);

  const patchDraft = (key, patch) => setDrafts((current) => ({ ...current, [key]: { ...(current[key] || {}), ...patch } }));

  const beginEdit = (pkg, line) => {
    if (!editable || !onSaveOption || (!allowEditAll && (line.client_can_change_option ?? line.can_change_option) === false)) return;
    const key = keyOf(pkg.id, line.id || line.line_item_id);
    const option = options.find((item) => item.line_item_id === (line.id || line.line_item_id) && item.package_id === pkg.id);
    setDrafts((current) => ({ ...current, [key]: {
      specification_label: option?.specification_label || "",
      specification_details: option?.specification_details || line.description || "",
      rate: option?.rate ?? 0,
    } }));
    setEditing(key);
  };

  const saveEdit = async (pkg, line) => {
    const lineId = line.id || line.line_item_id;
    const key = keyOf(pkg.id, lineId);
    const draft = drafts[key];
    if (!draft) return;
    setEditing(null);
    await onSaveOption(pkg, line, draft);
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  const handleDrop = (event, pkg, lineId) => {
    event.preventDefault();
    let source = drag;
    try {
      source = JSON.parse(event.dataTransfer.getData("text/plain")) || source;
    } catch {
      source = source || drag;
    }
    if (source?.lineId === lineId && source.packageId !== pkg.id
      && !lockedPackageIds.includes(source.packageId) && !lockedPackageIds.includes(pkg.id)
      && (allowEditAll || (line?.client_can_change_option ?? line?.can_change_option) !== false)) {
      onOverrideChange?.(pkg.id, lineId, source.packageId);
    }
    setDrag(null);
    setDropTarget(null);
  };

  return (
   <div className="w-full overflow-hidden rounded-xl border border-border bg-white" data-testid="package-comparison-scroll">
     <div className="overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity", touchAction: "pan-x" }}>
       <div style={{ minWidth: `${Math.max(columnCount, 1) * 220}px` }}>
          <div className="sticky top-0 z-10 grid gap-px border-b border-border bg-border" style={{ gridTemplateColumns: gridCols }}>
            {packages.map((pkg) => {
              const palette = paletteFor(pkg);
             const active = selectedPackageId === pkg.id;
             return (
               <div key={pkg.id} className="flex items-center justify-between gap-2 px-3 py-3" style={{ backgroundColor: palette.tint, scrollSnapAlign: "start" }} data-testid={`comparison-package-${pkg.code}`}>
                 <div>
                   <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: palette.border }}>{palette.title}</div>
                   <h3 className="mt-1 text-sm font-bold leading-tight text-slate-900">{pkg.name}</h3>
                 </div>
                 <Badge tone={active ? "success" : palette.badge}>{active ? "Selected" : palette.title}</Badge>
               </div>
             );
           })}
         </div>

         {!cellsByLine.length && (
           <div className="p-6 text-center text-sm text-muted-foreground">
             No package specification rows are configured for this estimate yet.
           </div>
         )}

         {cellsByLine.map(({ line, lineId, cells }) => {
           const values = cells.map((cell) => (cell.option?.specification_label || cell.option?.label || "").trim() || "—");
           const rates = cells.map((cell) => Number(cell.option?.rate ?? cell.budgetLine?.rate ?? 0) || 0);
           const nonEmpty = values.filter((value) => value !== "—");
           const uniqueValues = [...new Set(nonEmpty)];
           const uniqueRates = [...new Set(rates.filter((value) => Number.isFinite(value)))];
           const rowHasDifferentSpecs = uniqueValues.length > 1;
           const rowHasDifferentRates = uniqueRates.length > 1;
           const rowHasMeaningfulDifference = rowHasDifferentSpecs || rowHasDifferentRates;
           const rowHasAnySpec = uniqueValues.length > 0;

           return (
             <div key={lineId} className="grid gap-px border-b border-border bg-border last:border-b-0" style={{ gridTemplateColumns: gridCols, scrollSnapAlign: "start" }} data-testid={`comparison-line-${line.code}`}>
               {cells.map(({ pkg, packageId, sourcePackageId, option, budgetLine }) => {
                 const sourcePackage = sourcePackageId ? packageFor(sourcePackageId) : null;
                 const displayPackage = sourcePackage || pkg;
                 const palette = paletteFor(displayPackage);
                 const targetKey = keyOf(packageId, lineId);
                 const sourcePackageLocked = lockedPackageIds.includes(sourcePackageId || packageId);
                 const canMove = !!editable && !sourcePackageLocked && !lockedPackageIds.includes(packageId)
                   && (allowEditAll || (line.client_can_change_option ?? line.can_change_option) !== false);
                 const editKey = keyOf(packageId, lineId);
                 const isEditing = editing === editKey;
                 const draft = drafts[editKey] || {};
                 const blankValue = "—";
                 const displaySpec = (option?.specification_label || option?.label || "").trim() || blankValue;
                 const displayDetails = (option?.specification_details || option?.details || line.description || "").trim() || blankValue;
                 const traceText = (budgetLine?.client_trace || budgetLine?.trace || "").trim();
                 const currentRate = Number(option?.rate ?? budgetLine?.rate ?? 0) || 0;
                 const isDiff = rowHasMeaningfulDifference && displaySpec !== blankValue && uniqueValues.includes(displaySpec);
                 const baselineSpec = uniqueValues[0] || blankValue;
                 const isBaselineDiff = rowHasMeaningfulDifference && displaySpec !== blankValue && displaySpec !== baselineSpec;
                 const rateDiffers = rowHasDifferentRates && currentRate !== Number(rates[0] ?? 0); 

                 if (!option && !budgetLine) {
                   return <div key={packageId} className="min-w-0 bg-transparent" data-testid={`comparison-row-${pkg.code}-${line.code}`} aria-hidden="true" />;
                 }

                 if (!option && budgetLine && /civil/i.test(pkg.name || "")) {
                   return (
                     <div
                       key={packageId}
                       className="min-w-0 border-l border-border bg-slate-100 p-3"
                       style={{ borderLeftColor: palette.border }}
                       data-testid={`comparison-row-${pkg.code}-${line.code}`}
                     >
                       <div className="flex min-h-[72px] items-center justify-center text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500" />
                     </div>
                   );
                 }

                 return (
                   <div
                     key={packageId}
                     draggable={canMove && !isEditing}
                     title={editable ? "Double-click to edit this specification" : undefined}
                     onDragStart={(event) => {
                       const payload = { lineId, packageId };
                       event.dataTransfer.effectAllowed = "copy";
                       event.dataTransfer.setData("text/plain", JSON.stringify(payload));
                       setDrag(payload);
                     }}
                     onDragEnd={() => { setDrag(null); setDropTarget(null); }}
                     onDragOver={(event) => { if (canMove) { event.preventDefault(); setDropTarget(targetKey); } }}
                     onDrop={(event) => handleDrop(event, pkg, lineId)}
                     onDragLeave={() => setDropTarget(null)}
                     onDoubleClick={() => {
                       if (!onSaveOption) return;
                       beginEdit(pkg, line);
                     }}
                     onBlur={(event) => { if (isEditing && !event.currentTarget.contains(event.relatedTarget)) saveEdit(pkg, line); }}
                     className={cx(
                       "min-w-0 p-3 transition-all duration-200 ease-out hover:brightness-[0.99]",
                       canMove && !isEditing && "cursor-grab active:cursor-grabbing",
                       dropTarget === targetKey && "ring-2 ring-inset ring-primary/40",
                       rowHasMeaningfulDifference && "border-l-2 border-l-amber-400",
                       (isDiff || rateDiffers) && "outline outline-1 outline-amber-300",
                       isBaselineDiff && "shadow-inner"
                     )}
                     style={{
                       backgroundColor: /civil/i.test(pkg.name || "") ? "#f8fafc" : (dropTarget === targetKey || sourcePackageId ? palette.tint : isDiff || isBaselineDiff || rateDiffers ? "#fffaf0" : palette.tint),
                       outlineColor: palette.border,
                       borderLeftColor: palette.border,
                       borderLeftWidth: rowHasMeaningfulDifference ? 2 : 1,
                     }}
                     data-testid={`comparison-row-${pkg.code}-${line.code}`}
                   >
                     <div className="flex items-start justify-between gap-2">
                       <div className="min-w-0 flex-1">
                         <div className="flex flex-wrap items-center gap-1.5">
                           <span className="text-[11px] font-semibold leading-snug text-slate-700">{line.name}</span>
                           {line.code && <span className="font-mono text-[8px] text-muted-foreground">{line.code}</span>}
                           {rowHasAnySpec && rowHasMeaningfulDifference ? <Badge tone="warning" className="px-1.5 py-0.5 text-[7px]">Different</Badge> : rowHasAnySpec ? <Badge tone="secondary" className="px-1.5 py-0.5 text-[7px]">Same</Badge> : null}
                           {sourcePackageId && <Badge tone={palette.badge}>Using {sourcePackage?.name || "package"}</Badge>}
                         </div>

                         {isEditing ? (
                           <div className="mt-2 space-y-2">
                             <Input autoFocus aria-label={`${pkg.name} ${line.name} specification`} data-testid={`comparison-spec-${pkg.code}-${line.code}`}
                               value={draft.specification_label ?? ""} onChange={(event) => patchDraft(editKey, { specification_label: event.target.value })} placeholder="Quality / specification" />
                             <textarea aria-label={`${pkg.name} ${line.name} details`} data-testid={`comparison-details-${pkg.code}-${line.code}`}
                               className="min-h-16 w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/60"
                               value={draft.specification_details ?? ""} onChange={(event) => patchDraft(editKey, { specification_details: event.target.value })} placeholder="Specification explanation / content" />
                           </div>
                         ) : (
                           <>
                             <div className={cx("mt-1 text-[10px] font-semibold", rowHasMeaningfulDifference ? "text-amber-700" : "text-slate-800")}>{displaySpec}</div>
                             <div className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground">{displayDetails}</div>
                             {traceText && (
                               <div className="mt-2 flex items-start gap-1 overflow-hidden text-[8px] leading-relaxed text-slate-500">
                                 <span className="shrink-0 font-semibold uppercase tracking-[0.12em] text-slate-400">Logic</span>
                                 <span className="num max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{traceText}</span>
                               </div>
                             )}
                           </>
                         )}
                       </div>

                       <div className="w-20 shrink-0 text-right">
                         {isEditing ? (
                           <Input aria-label={`${pkg.name} ${line.name} rate`} data-testid={`comparison-rate-${pkg.code}-${line.code}`}
                             type="number" min="0" step="any" className="num h-8 px-1.5 text-right text-xs" value={draft.rate ?? ""}
                             onChange={(event) => patchDraft(editKey, { rate: event.target.value })} placeholder="Rate" />
                         ) : showRates ? (
                           <div className="num text-[10px] font-bold text-slate-800">{inr(option?.rate ?? budgetLine?.rate ?? 0)}</div>
                         ) : null}

                         {editable && (
                           <div className="mt-1 flex items-center justify-end gap-1">
                             {sourcePackageId && (
                               <button type="button" className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary hover:underline"
                                 aria-label={`Reset ${line.name} in ${pkg.name}`} data-testid={`comparison-reset-${pkg.code}-${line.code}`}
                                 onClick={(event) => { event.stopPropagation(); onOverrideChange?.(packageId, lineId, null); }}><RotateCcw size={10} /> Reset</button>
                             )}
                             {!sourcePackageId && <span className="text-[8px] text-muted-foreground">{canMove ? "Drag" : "Fixed"}</span>}
                           </div>
                         )}
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           );
         })}
       </div>
     </div>
   </div>
 );
}
