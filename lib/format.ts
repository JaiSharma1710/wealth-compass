// Client-safe display formatters. Every money / percent / date string in the UI goes
// through here so the whole app reads consistently.

const DEFAULT_CURRENCY = "INR";

function localeFor(currency: string) {
  return currency === "INR" ? "en-IN" : "en-US";
}

export type MoneyOptions = {
  currency?: string;
  /** Fraction digits; defaults to 0 for |value| >= 1000, else 2. */
  decimals?: number;
  /** Prefix a + for positive values. */
  sign?: boolean;
};

export function formatMoney(value: number | null | undefined, options: MoneyOptions = {}) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const currency = options.currency || DEFAULT_CURRENCY;
  const decimals = options.decimals ?? (Math.abs(value) >= 1000 ? 0 : 2);
  const formatted = new Intl.NumberFormat(localeFor(currency), {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  if (value < 0) return `-${formatted}`;
  if (options.sign && value > 0) return `+${formatted}`;
  return formatted;
}

/** ₹16.24L, ₹1.20Cr, ₹45.2K — for hero numbers, axes and tight spaces. */
export function formatCompactMoney(
  value: number | null | undefined,
  options: Omit<MoneyOptions, "decimals"> = {}
) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const currency = options.currency || DEFAULT_CURRENCY;
  const abs = Math.abs(value);
  const prefix = value < 0 ? "-" : options.sign && value > 0 ? "+" : "";
  const symbol = currency === "INR" ? "₹" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0).replace(/[\d.,\s]/g, "");

  if (currency === "INR") {
    if (abs >= 1e7) return `${prefix}${symbol}${trim(abs / 1e7)}Cr`;
    if (abs >= 1e5) return `${prefix}${symbol}${trim(abs / 1e5)}L`;
    if (abs >= 1e3) return `${prefix}${symbol}${trim(abs / 1e3, 1)}K`;
    return `${prefix}${symbol}${Math.round(abs)}`;
  }

  if (abs >= 1e9) return `${prefix}${symbol}${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${prefix}${symbol}${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${prefix}${symbol}${trim(abs / 1e3, 1)}K`;
  return `${prefix}${symbol}${Math.round(abs)}`;
}

function trim(value: number, decimals = 2) {
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function formatPercent(
  value: number | null | undefined,
  options: { sign?: boolean; decimals?: number } = {}
) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  const decimals = options.decimals ?? 2;
  const formatted = `${Math.abs(value).toFixed(decimals)}%`;

  if (value < 0) return `-${formatted}`;
  if (options.sign && value > 0) return `+${formatted}`;
  return formatted;
}

export function formatNumber(value: number | null | undefined, decimals = 2) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: decimals }).format(value);
}

export function toneOf(value: number | null | undefined): "gain" | "loss" | "flat" {
  if (value == null || !Number.isFinite(value) || Math.abs(value) < 0.005) return "flat";
  return value > 0 ? "gain" : "loss";
}

const IST = "Asia/Kolkata";

/** 7 Oct 2026 */
export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST }).format(date);
}

/** 7 Oct */
export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+05:30` : value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(date);
}

/** 7 Oct, 7:12 am */
export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  }).format(date);
}

/** "just now", "5m ago", "3h ago", "yesterday", "4 Oct" */
export function formatRelativeTime(value: string | Date | null | undefined, now = new Date()) {
  if (!value) return "never";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "never";

  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "yesterday";
  return formatShortDate(date);
}
