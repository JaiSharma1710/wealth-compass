"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, LoaderCircle, Minus, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { formatCompactMoney, formatMoney, formatPercent, toneOf } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Layout */

/** Standard page wrapper: scrolls inside the shell's <main>, consistent gutters. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="h-full overflow-y-auto overscroll-contain">
      <div className={cn("mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-6 lg:px-8", className)}>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-3">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  padded = true,
  ...props
}: ComponentProps<"section"> & { padded?: boolean }) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        padded && "p-4 sm:p-5",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="text-[0.95rem] font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-3 sm:text-[0.8rem]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Numbers */

/**
 * Gain/loss readout: arrow + signed amount and/or percent, coloured by direction.
 * Colour is never the only signal: the arrow and sign carry it too.
 */
export function Delta({
  value,
  percent,
  currency,
  compact = false,
  size = "sm",
  pill = false,
  className,
  suffix,
}: {
  value?: number | null;
  percent?: number | null;
  currency?: string;
  compact?: boolean;
  size?: "xs" | "sm" | "md";
  pill?: boolean;
  className?: string;
  suffix?: ReactNode;
}) {
  const basis = value ?? percent ?? null;
  const tone = toneOf(basis);
  const Icon = tone === "gain" ? ArrowUpRight : tone === "loss" ? ArrowDownRight : Minus;

  if (basis == null) {
    return <span className={cn("text-ink-3", size === "xs" ? "text-xs" : "text-sm", className)}>—</span>;
  }

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 font-medium whitespace-nowrap",
        size === "xs" && "text-xs",
        size === "sm" && "text-sm",
        size === "md" && "text-base",
        tone === "gain" && "text-gain",
        tone === "loss" && "text-loss",
        tone === "flat" && "text-ink-3",
        pill && "rounded-full px-2 py-0.5",
        pill && tone === "gain" && "bg-gain-soft",
        pill && tone === "loss" && "bg-loss-soft",
        pill && tone === "flat" && "bg-surface-2",
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "md" ? "size-4" : "size-3.5")} aria-hidden />
      {value != null ? (
        <span>
          {compact
            ? formatCompactMoney(Math.abs(value), { currency })
            : formatMoney(Math.abs(value), { currency })}
        </span>
      ) : null}
      {percent != null ? (
        <span className={cn(value != null && "opacity-90")}>
          {value != null ? ` (${formatPercent(Math.abs(percent))})` : formatPercent(Math.abs(percent))}
        </span>
      ) : null}
      {suffix ? <span className="ml-1 font-normal text-ink-3">{suffix}</span> : null}
    </span>
  );
}

/** Label + big value + optional delta / caption. */
export function Stat({
  label,
  value,
  caption,
  delta,
  className,
  valueClassName,
  icon: Icon,
}: {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  delta?: ReactNode;
  className?: string;
  valueClassName?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
        {label}
      </p>
      <p className={cn("tabular mt-1 truncate text-lg font-semibold text-ink sm:text-xl", valueClassName)}>{value}</p>
      {delta ? <div className="mt-0.5">{delta}</div> : null}
      {caption ? <p className="mt-0.5 truncate text-xs text-ink-3">{caption}</p> : null}
    </div>
  );
}

/** Bordered tile wrapping a Stat — use in KPI rows. */
export function StatTile(props: ComponentProps<typeof Stat>) {
  return (
    <Card className="p-3.5 sm:p-4">
      <Stat {...props} />
    </Card>
  );
}

/* ------------------------------------------------------------------ Controls */

const buttonStyles = {
  primary: "bg-cta text-cta-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-loss/30 bg-loss-soft text-loss hover:bg-loss/15",
  brand: "bg-brand text-white hover:opacity-90",
} as const;

export type ButtonVariant = keyof typeof buttonStyles;

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        size === "sm" ? "h-8 px-2.5 text-[0.8rem]" : "h-10 px-3.5 text-sm",
        buttonStyles[variant],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : Icon ? (
        <Icon className="size-4" aria-hidden />
      ) : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md"; icon?: LucideIcon }) {
  return (
    <Link
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-medium whitespace-nowrap transition",
        size === "sm" ? "h-8 px-2.5 text-[0.8rem]" : "h-10 px-3.5 text-sm",
        buttonStyles[variant],
        className
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...props
}: ComponentProps<"button"> & { icon: LucideIcon; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-40",
        className
      )}
      {...props}
    >
      <Icon className="size-[1.1rem]" aria-hidden />
    </button>
  );
}

/** Pill tab group — ranges (1M/3M/1Y), view toggles, filters. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "sm",
  className,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  size?: "xs" | "sm";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("no-scrollbar inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-2 p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-[0.6rem] font-medium whitespace-nowrap transition",
              size === "xs" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-[0.8rem]",
              active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.08)]" : "text-ink-3 hover:text-ink"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Status */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "gain" | "loss" | "warn" | "brand";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide whitespace-nowrap",
        tone === "neutral" && "bg-surface-3 text-ink-2",
        tone === "gain" && "bg-gain-soft text-gain",
        tone === "loss" && "bg-loss-soft text-loss",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "brand" && "bg-brand-soft text-brand-ink",
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "brand",
  className,
  label,
}: {
  /** 0-100 */
  value: number;
  tone?: "brand" | "gain" | "loss" | "warn";
  className?: string;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          tone === "brand" && "bg-brand",
          tone === "gain" && "bg-gain",
          tone === "loss" && "bg-loss",
          tone === "warn" && "bg-warn"
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-10 text-center", className)}>
      {Icon ? (
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-ink-3">
          <Icon className="size-5" aria-hidden />
        </div>
      ) : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-sm text-ink-3">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-surface-3", className)} />;
}

/** Key/value row used in detail lists. */
export function MetaRow({ label, value, className }: { label: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2 text-sm", className)}>
      <span className="text-ink-3">{label}</span>
      <span className="tabular text-right font-medium text-ink">{value}</span>
    </div>
  );
}

/** Small coloured square identifying a chart series (identity is also named in text). */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", className)} style={{ background: color }} />;
}
