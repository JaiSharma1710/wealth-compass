"use client";

import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardHistoryPoint, DashboardHistoryRange } from "@/lib/dashboard.types";

const RANGE_OPTIONS: DashboardHistoryRange[] = ["1M", "3M", "6M", "1Y", "ALL"];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CHART_BARS = 24;

type WealthChartPoint = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  movement: "increase" | "decrease" | "same";
};

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWeekLabel(startDate: Date, endDate: Date) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function getWeekStart(date: Date) {
  const day = date.getUTCDay();
  const offsetToMonday = (day + 6) % 7;
  return new Date(date.getTime() - offsetToMonday * DAY_MS);
}

function getMovement(value: number, previous?: WealthChartPoint): WealthChartPoint["movement"] {
  if (!previous || value === previous.totalValue) {
    return "same";
  }

  return value > previous.totalValue ? "increase" : "decrease";
}

function buildDailyHistory(history: DashboardHistoryPoint[]): WealthChartPoint[] {
  return history
    .map((point) => {
      const date = parseDateKey(point.date);

      if (!date) {
        return null;
      }

      return {
        date,
        point,
      };
    })
    .filter((entry): entry is { date: Date; point: DashboardHistoryPoint } => Boolean(entry))
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .reduce<WealthChartPoint[]>((points, entry) => {
      const totalValue = Math.round(entry.point.totalValue * 100) / 100;
      const previous = points.at(-1);

      points.push({
        key: entry.point.date,
        label: formatDateLabel(entry.date),
        startDate: entry.point.date,
        endDate: entry.point.date,
        totalValue,
        movement: getMovement(totalValue, previous),
      });

      return points;
    }, []);
}

function buildWeeklyAverageHistory(history: DashboardHistoryPoint[]): WealthChartPoint[] {
  const weeks = new Map<
    string,
    {
      startDate: Date;
      endDate: Date;
      totalValue: number;
      count: number;
    }
  >();

  for (const point of history) {
    const date = parseDateKey(point.date);

    if (!date) {
      continue;
    }

    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart.getTime() + 6 * DAY_MS);
    const key = weekStart.toISOString().slice(0, 10);
    const week = weeks.get(key) || {
      startDate: weekStart,
      endDate: weekEnd,
      totalValue: 0,
      count: 0,
    };

    week.totalValue += point.totalValue;
    week.count += 1;
    weeks.set(key, week);
  }

  return [...weeks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<WealthChartPoint[]>((points, [key, week]) => {
      const totalValue = Math.round((week.totalValue / week.count) * 100) / 100;
      const previous = points.at(-1);

      points.push({
        key,
        label: formatWeekLabel(week.startDate, week.endDate),
        startDate: week.startDate.toISOString().slice(0, 10),
        endDate: week.endDate.toISOString().slice(0, 10),
        totalValue,
        movement: getMovement(totalValue, previous),
      });

      return points;
    }, []);
}

function buildMonthlyAverageHistory(history: DashboardHistoryPoint[]): WealthChartPoint[] {
  const months = new Map<
    string,
    {
      startDate: Date;
      endDate: Date;
      totalValue: number;
      count: number;
    }
  >();

  for (const point of history) {
    const date = parseDateKey(point.date);

    if (!date) {
      continue;
    }

    const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
    const key = monthStart.toISOString().slice(0, 7);
    const month = months.get(key) || {
      startDate: monthStart,
      endDate: monthEnd,
      totalValue: 0,
      count: 0,
    };

    month.totalValue += point.totalValue;
    month.count += 1;
    months.set(key, month);
  }

  return [...months.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .reduce<WealthChartPoint[]>((points, [key, month]) => {
      const totalValue = Math.round((month.totalValue / month.count) * 100) / 100;
      const previous = points.at(-1);

      points.push({
        key,
        label: formatMonthLabel(month.startDate),
        startDate: month.startDate.toISOString().slice(0, 10),
        endDate: month.endDate.toISOString().slice(0, 10),
        totalValue,
        movement: getMovement(totalValue, previous),
      });

      return points;
    }, []);
}

function shouldUseDailyHistory(range: DashboardHistoryRange) {
  return range === "1W" || range === "1M";
}

function shouldUseMonthlyHistory(range: DashboardHistoryRange) {
  return range === "1Y" || range === "ALL";
}

function limitChartBars(points: WealthChartPoint[]) {
  const visiblePoints = points.slice(-MAX_CHART_BARS);

  return visiblePoints.map((point, index) => ({
    ...point,
    movement: getMovement(point.totalValue, index > 0 ? visiblePoints[index - 1] : undefined),
  }));
}

function getChartHistory(history: DashboardHistoryPoint[], range: DashboardHistoryRange) {
  if (shouldUseDailyHistory(range)) {
    return limitChartBars(buildDailyHistory(history));
  }

  if (shouldUseMonthlyHistory(range)) {
    return limitChartBars(buildMonthlyAverageHistory(history));
  }

  return limitChartBars(buildWeeklyAverageHistory(history));
}

function getValueLabel(range: DashboardHistoryRange) {
  if (shouldUseDailyHistory(range)) {
    return "Daily value";
  }

  if (shouldUseMonthlyHistory(range)) {
    return "Monthly avg";
  }

  return "Weekly avg";
}

function getMovementColor(movement: WealthChartPoint["movement"]) {
  if (movement === "increase") {
    return "#16a34a";
  }

  if (movement === "decrease") {
    return "#ef4444";
  }

  return "#eab308";
}

export function DashboardWealthChart({
  formatCompactCurrency,
  formatCurrency,
  history,
  availableRanges,
  isLoading,
  onChangeRange,
  range,
}: {
  formatCompactCurrency: (value: number) => string;
  formatCurrency: (value: number) => string;
  history: DashboardHistoryPoint[];
  availableRanges: DashboardHistoryRange[];
  isLoading: boolean;
  onChangeRange: (range: DashboardHistoryRange) => void;
  range: DashboardHistoryRange;
}) {
  const chartHistory = getChartHistory(history, range);
  const valueLabel = getValueLabel(range);
  const availableRangeSet = new Set(availableRanges);

  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#132842]">Wealth Movement</h2>
          <p className="mt-1 text-sm text-[#6d7d97]">
            Track daily worth for 1M, weekly averages for mid ranges, and monthly averages for 1Y and ALL.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => {
            const isAvailable = availableRangeSet.has(option);

            return (
              <button
                key={option}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] transition disabled:cursor-not-allowed ${
                  range === option
                    ? "bg-[#173d7a] text-white disabled:bg-[#173d7a] disabled:text-white"
                    : "border border-[#d5dfef] bg-white text-[#5f6f89] hover:border-[#9cb6dc] hover:bg-[#f8fbff] disabled:border-[#e4e9f2] disabled:bg-[#f3f6fa] disabled:text-[#a8b3c4]"
                }`}
                disabled={!isAvailable || isLoading}
                onClick={() => onChangeRange(option)}
                title={isAvailable ? `${option} history` : `Not enough data for ${option}`}
                type="button"
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {chartHistory.length ? (
        <div className="relative h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartHistory}
              barCategoryGap={18}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#e8eef7" strokeDasharray="4 4" />
              <XAxis dataKey="label" minTickGap={18} tick={{ fill: "#6c7a93", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6c7a93", fontSize: 12 }} tickFormatter={formatCompactCurrency} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const item = payload[0];
                  const point = item.payload as WealthChartPoint;

                  return (
                    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
                      <div className="font-semibold">{point.label}</div>
                      <div>{valueLabel}: {formatCurrency(Number(item.value || 0))}</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="totalValue"
                name="totalValue"
                radius={[8, 8, 0, 0]}
              >
                {chartHistory.map((point) => (
                  <Cell key={point.key} fill={getMovementColor(point.movement)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {isLoading ? <ChartLoadingOverlay /> : null}
        </div>
      ) : (
        <div className="relative rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-12 text-center text-sm text-[#72829a]">
          Wealth history will appear after daily snapshots are recorded.
          {isLoading ? <ChartLoadingOverlay /> : null}
        </div>
      )}
    </section>
  );
}

function ChartLoadingOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-3xl bg-white/75 backdrop-blur-[2px]">
      <div className="inline-flex items-center gap-2 rounded-full border border-[#d6e0ef] bg-white px-4 py-2 text-sm font-semibold text-[#234067] shadow-[0_12px_32px_rgba(15,23,42,0.10)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading chart</span>
      </div>
    </div>
  );
}
