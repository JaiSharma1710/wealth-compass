"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Swatch } from "@/components/ui/kit";
import { formatCompactMoney, formatMoney, formatPercent, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Fixed series colours by entity (never by rank). Values are CSS vars so dark mode follows. */
export const ASSET_COLORS = {
  stocks: "var(--wc-asset-stocks)",
  mutualFunds: "var(--wc-asset-funds)",
  cash: "var(--wc-asset-cash)",
  gold: "var(--wc-asset-gold)",
  otherAssets: "var(--wc-asset-other)",
} as const;

/** Categorical order for non-asset series (e.g. invested vs current). */
export const SERIES_COLORS = [
  "var(--wc-asset-stocks)",
  "var(--wc-asset-funds)",
  "var(--wc-asset-cash)",
  "var(--wc-asset-gold)",
  "var(--wc-asset-other)",
] as const;

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
};

const axisTick = { fill: "var(--wc-chart-tick)", fontSize: 11 };

function niceDomain(values: number[], includeZero: boolean): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));

  if (!finite.length) return [0, 1];

  let min = Math.min(...finite);
  let max = Math.max(...finite);

  if (includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }

  if (min === max) {
    const pad = Math.abs(max) * 0.05 || 1;
    return [min - pad, max + pad];
  }

  const pad = (max - min) * 0.12;
  return [includeZero && min >= 0 ? 0 : min - pad, max + pad];
}

function TooltipCard({
  title,
  rows,
}: {
  title: ReactNode;
  rows: Array<{ label: string; color?: string; value: ReactNode }>;
}) {
  return (
    <div className="min-w-40 rounded-xl border border-[var(--wc-tooltip-border)] bg-[var(--wc-tooltip-bg)] px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-ink-3">{title}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-2">
              {row.color ? <Swatch color={row.color} /> : null}
              {row.label}
            </span>
            <span className="tabular font-semibold text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ series, className }: { series: ChartSeries[]; className?: string }) {
  if (series.length < 2) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2", className)}>
      {series.map((entry) => (
        <span key={entry.key} className="inline-flex items-center gap-1.5">
          <Swatch color={entry.color} />
          {entry.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Time-series area/line chart with a crosshair tooltip listing every series.
 * Y domain fits the data (not forced to zero) so real movement is visible.
 */
export function TrendChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 240,
  currency,
  valueFormatter,
  xFormatter = (value) => formatShortDate(String(value)),
  tooltipTitle,
  includeZero = false,
  showLegend = true,
  className,
}: {
  data: T[];
  xKey: keyof T & string;
  series: ChartSeries[];
  height?: number;
  currency?: string;
  valueFormatter?: (value: number) => string;
  xFormatter?: (value: unknown) => string;
  tooltipTitle?: (row: T) => ReactNode;
  includeZero?: boolean;
  showLegend?: boolean;
  className?: string;
}) {
  const gradientId = useId().replace(/:/g, "");
  const formatAxis = valueFormatter || ((value: number) => formatCompactMoney(value, { currency }));
  const formatTooltip = valueFormatter || ((value: number) => formatMoney(value, { currency }));
  const domain = useMemo(
    () =>
      niceDomain(
        data.flatMap((row) => series.map((entry) => Number(row[entry.key]))),
        includeZero
      ),
    [data, series, includeZero]
  );

  return (
    <div className={cn("min-w-0", className)}>
      {showLegend ? <ChartLegend series={series} className="mb-3" /> : null}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((entry, index) => (
                <linearGradient key={entry.key} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={series.length > 1 ? 0.06 : 0.16} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--wc-chart-grid)" />
            <XAxis
              dataKey={xKey as string}
              tickFormatter={xFormatter}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
              tickMargin={8}
            />
            <YAxis
              domain={domain}
              tickFormatter={(value: number) => formatAxis(value)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={58}
              tickCount={5}
            />
            <Tooltip
              cursor={{ stroke: "var(--wc-ink-3)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as T;

                return (
                  <TooltipCard
                    title={tooltipTitle ? tooltipTitle(row) : xFormatter(row[xKey])}
                    rows={series.map((entry) => ({
                      label: entry.label,
                      color: series.length > 1 ? entry.color : undefined,
                      value: formatTooltip(Number(row[entry.key])),
                    }))}
                  />
                );
              }}
            />
            {series.map((entry, index) => (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label}
                stroke={entry.color}
                strokeWidth={2}
                fill={`url(#${gradientId}-${index})`}
                dot={false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--wc-surface)", fill: entry.color }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * Column chart for one or a few series (monthly spend, invested vs value...).
 * Negative values grow down from a zero baseline.
 */
export function ColumnChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 220,
  currency,
  valueFormatter,
  xFormatter = (value) => String(value),
  highlightIndex,
  colorFor,
  className,
}: {
  data: T[];
  xKey: keyof T & string;
  series: ChartSeries[];
  height?: number;
  currency?: string;
  valueFormatter?: (value: number) => string;
  xFormatter?: (value: unknown) => string;
  /** Emphasise one column (e.g. current month); others render muted. Single series only. */
  highlightIndex?: number;
  /** Per-bar colour override for single-series charts (e.g. gain/loss). */
  colorFor?: (row: T) => string;
  className?: string;
}) {
  const formatAxis = valueFormatter || ((value: number) => formatCompactMoney(value, { currency }));
  const formatTooltip = valueFormatter || ((value: number) => formatMoney(value, { currency }));
  const hasNegative = data.some((row) => series.some((entry) => Number(row[entry.key]) < 0));

  return (
    <div className={cn("min-w-0", className)}>
      <ChartLegend series={series} className="mb-3" />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--wc-chart-grid)" />
            <XAxis
              dataKey={xKey as string}
              tickFormatter={xFormatter}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={8}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(value: number) => formatAxis(value)}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={52}
              tickCount={5}
            />
            {hasNegative ? <ReferenceLine y={0} stroke="var(--wc-line-strong)" /> : null}
            <Tooltip
              cursor={{ fill: "var(--wc-surface-2)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as T;

                return (
                  <TooltipCard
                    title={xFormatter(row[xKey])}
                    rows={series.map((entry) => ({
                      label: entry.label,
                      color: series.length > 1 ? entry.color : undefined,
                      value: formatTooltip(Number(row[entry.key])),
                    }))}
                  />
                );
              }}
            />
            {series.map((entry) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                fill={entry.color}
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {series.length === 1 && (colorFor || highlightIndex != null)
                  ? data.map((row, index) => (
                      <Cell
                        key={index}
                        fill={colorFor ? colorFor(row) : entry.color}
                        fillOpacity={highlightIndex != null && index !== highlightIndex ? 0.35 : 1}
                      />
                    ))
                  : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type AllocationItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  sublabel?: ReactNode;
  href?: string;
};

/**
 * Part-to-whole as a single stacked bar + labelled list (replaces pies/donuts).
 * Every segment is named with its value and share, so identity never relies on colour.
 */
export function AllocationBar({
  items,
  currency,
  className,
  showList = true,
  maxItems = 6,
}: {
  items: AllocationItem[];
  currency?: string;
  className?: string;
  showList?: boolean;
  /** Extra items fold into "Other". */
  maxItems?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const positive = items.filter((item) => item.value > 0).sort((left, right) => right.value - left.value);
  const folded =
    positive.length > maxItems
      ? [
          ...positive.slice(0, maxItems - 1),
          {
            key: "__other",
            label: `Other (${positive.length - maxItems + 1})`,
            value: positive.slice(maxItems - 1).reduce((sum, item) => sum + item.value, 0),
            color: "var(--wc-ink-3)",
          },
        ]
      : positive;
  const total = folded.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return null;
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Allocation">
        {folded.map((item) => (
          <div
            key={item.key}
            title={`${item.label}: ${formatPercent((item.value / total) * 100, { decimals: 1 })}`}
            onMouseEnter={() => setHovered(item.key)}
            onMouseLeave={() => setHovered(null)}
            className="h-full transition-opacity first:rounded-l-full last:rounded-r-full"
            style={{
              width: `${(item.value / total) * 100}%`,
              background: item.color,
              opacity: hovered && hovered !== item.key ? 0.35 : 1,
            }}
          />
        ))}
      </div>
      {showList ? (
        <ul className="mt-4 space-y-0.5">
          {folded.map((item) => {
            const share = (item.value / total) * 100;
            const body = (
              <>
                <span className="flex min-w-0 items-center gap-2">
                  <Swatch color={item.color} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{item.label}</span>
                    {"sublabel" in item && item.sublabel ? (
                      <span className="block truncate text-xs text-ink-3">{item.sublabel}</span>
                    ) : null}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right">
                  <span className="block text-sm font-medium text-ink">{formatCompactMoney(item.value, { currency })}</span>
                  <span className="block text-xs text-ink-3">{formatPercent(share, { decimals: 1 })}</span>
                </span>
              </>
            );
            const href = "href" in item ? item.href : undefined;

            return (
              <li
                key={item.key}
                onMouseEnter={() => setHovered(item.key)}
                onMouseLeave={() => setHovered(null)}
              >
                {href ? (
                  <a href={href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition hover:bg-surface-2">
                    {body}
                  </a>
                ) : (
                  <div className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Horizontal bars for ranked lists (holdings by weight, spend by category). Single hue. */
export function RankedBars({
  items,
  currency,
  color = "var(--wc-asset-stocks)",
  valueFormatter,
  className,
}: {
  items: Array<{ key: string; label: ReactNode; value: number; caption?: ReactNode }>;
  currency?: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  const format = valueFormatter || ((value: number) => formatCompactMoney(value, { currency }));

  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li key={item.key} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">{item.label}</span>
            <span className="tabular shrink-0 font-medium text-ink">
              {format(item.value)}
              {item.caption ? <span className="ml-1.5 text-xs font-normal text-ink-3">{item.caption}</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 2) : 0}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tiny trend line for table rows / tiles. */
export function Sparkline({
  values,
  width = 80,
  height = 24,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * width},${height - 2 - ((value - min) / span) * (height - 4)}`)
    .join(" ");
  const up = values[values.length - 1] >= values[0];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={up ? "var(--wc-gain)" : "var(--wc-loss)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
