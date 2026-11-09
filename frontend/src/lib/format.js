export function inr(v, { symbol = "₹", dp = 0 } = {}) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return symbol + n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp === 0 ? 0 : 2 });
}

export const date = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export const STATUS = {
  INCLUDED: { label: "Included", tone: "success" },
  OPTIONAL: { label: "Optional", tone: "info" },
  EXCLUDED: { label: "Excluded", tone: "muted" },
  INCLUDED_IN_RATE: { label: "In package rate", tone: "muted" },
  NOT_APPLICABLE: { label: "Not applicable", tone: "muted" },
  UNPRICED: { label: "Unpriced", tone: "danger" },
  REQUIRES_REVIEW: { label: "Requires review", tone: "warning" },
  DRAFT: { label: "Draft", tone: "muted" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  ISSUED: { label: "Issued", tone: "success" },
  SUPERSEDED: { label: "Superseded", tone: "muted" },
  WITHDRAWN: { label: "Withdrawn", tone: "muted" },
};

export const QTY_MODES = [
  ["FIXED_QUANTITY", "Fixed quantity"], ["INPUT_MULTIPLIER", "Building input × factor"], ["PER_FLOOR", "Per floor (slab rule)"],
  ["PER_BATHROOM", "Per bathroom (bathroom rule)"], ["FLOOR_BAND_LOOKUP", "Floor-band lookup (foundation rule)"],
  ["LOOKUP_TABLE", "Lookup table (rule)"], ["COMPOSITE", "Composite of other items (rule)"], ["RULE", "Custom formula rule"],
  ["LUMP_SUM", "Lump sum"], ["MANUAL_INTERNAL", "Architect enters quantity"], ["CLIENT_MANUAL", "Client enters quantity"],
];
export const INCLUSIONS = [["INCLUDED", "Included"], ["OPTIONAL", "Optional"], ["EXCLUDED", "Excluded"], ["INCLUDED_IN_RATE", "Included in package rate (spec only)"], ["NOT_APPLICABLE", "Not applicable"]];
