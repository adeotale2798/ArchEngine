import { useEffect } from "react";
import { X, Inbox } from "lucide-react";

const cx = (...a) => a.filter(Boolean).join(" ");
export { cx };

export function Button({ variant = "primary", size = "md", className, children, ...p }) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-sm",
    secondary: "bg-secondary text-secondary-foreground hover:brightness-125",
    outline: "border border-border bg-card hover:bg-muted",
    ghost: "hover:bg-muted",
    danger: "bg-danger text-white hover:brightness-110",
  }[variant];
  const s = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" }[size];
  return (
    <button className={cx("inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[filter,background-color,transform] duration-150 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none", v, s, className)} {...p}>
      {children}
    </button>
  );
}

export const inputCls = "flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/60";

export function Field({ label, help, children, className }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {help && <span className="block text-xs text-muted-foreground">{help}</span>}
    </label>
  );
}

export const Input = ({ className, ...p }) => <input className={cx(inputCls, className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx(inputCls, "h-auto min-h-[80px]", className)} {...p} />;
export function Select({ options, className, placeholder, ...p }) {
  return (
    <select className={cx(inputCls, className)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label, ...p }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 text-sm">
      <button type="button" role="switch" aria-checked={!!checked} onClick={() => onChange(!checked)}
        className={cx("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-primary" : "bg-border")} {...p}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
      </button>
      {label}
    </label>
  );
}

export function Card({ className, children, ...p }) {
  return <div className={cx("rounded-lg border border-border bg-card", className)} {...p}>{children}</div>;
}

const tones = {
  success: "bg-success/10 text-success border-success/30", warning: "bg-warning/10 text-warning border-warning/30",
  danger: "bg-danger/10 text-danger border-danger/30", info: "bg-secondary/10 text-secondary border-secondary/30",
  muted: "bg-muted text-muted-foreground border-border", primary: "bg-primary/10 text-primary border-primary/30",
};
export function Badge({ tone = "muted", children, className, ...p }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)} {...p}>{children}</span>;
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {tabs.map(([k, l]) => (
        <button key={k} role="tab" aria-selected={value === k} data-testid={`tab-${k}`} onClick={() => onChange(k)}
          className={cx("whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors", value === k ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, testid = "modal" }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-secondary/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div data-testid={testid} role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}
        className={cx("mt-12 w-full animate-rise rounded-lg border border-border bg-card shadow-2xl", wide ? "max-w-4xl" : "max-w-xl")}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" data-testid={`${testid}-close`} className="rounded p-1 hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        {eyebrow && <div className="mb-1 font-mono text-[11px] uppercase tracking-[.2em] text-primary">{eyebrow}</div>}
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-14 text-center" data-testid="empty-state">
      <Icon size={36} strokeWidth={1.2} className="mb-3 text-muted-foreground" />
      <div className="font-display text-lg font-semibold">{title}</div>
      {children && <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ head, children, className }) {
  return (
    <div className={cx("overflow-x-auto rounded-lg border border-border bg-card", className)}>
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-muted/60">
          <tr>{head.map((h, i) => <th key={i} className="whitespace-nowrap border-b border-border px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_tr:last-child_td]:border-0 [&_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/40">{children}</tbody>
      </table>
    </div>
  );
}

export function Notice({ tone = "warning", icon: Icon, children, className }) {
  return (
    <div className={cx("flex gap-3 rounded-md border px-4 py-3 text-sm", tones[tone], className)} role="note">
      {Icon && <Icon size={18} className="mt-0.5 shrink-0" />}
      <div>{children}</div>
    </div>
  );
}
