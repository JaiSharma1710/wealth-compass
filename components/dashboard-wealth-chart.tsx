"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardHistoryPoint, DashboardHistoryRange } from "@/lib/dashboard.types";

const RANGE_OPTIONS: DashboardHistoryRange[] = ["1M", "3M", "6M", "1Y", "ALL"];
const DAY_MS = 24 * 60 * 60 * 1000;

type WeeklyWealthPoint = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  averageTotalValue: number;
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

function getWeekStart(date: Date) {
  const day = date.getUTCDay();
  const offsetToMonday = (day + 6) % 7;
  return new Date(date.getTime() - offsetToMonday * DAY_MS);
}

function buildWeeklyAverageHistory(history: DashboardHistoryPoint[]): WeeklyWealthPoint[] {
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
    .reduce<WeeklyWealthPoint[]>((points, [key, week]) => {
      const averageTotalValue = Math.round((week.totalValue / week.count) * 100) / 100;
      const previous = points.at(-1);

      points.push({
        key,
        label: formatWeekLabel(week.startDate, week.endDate),
        startDate: week.startDate.toISOString().slice(0, 10),
        endDate: week.endDate.toISOString().slice(0, 10),
        averageTotalValue,
        movement:
          !previous || averageTotalValue === previous.averageTotalValue
            ? "same"
            : averageTotalValue > previous.averageTotalValue
              ? "increase"
              : "decrease",
      });

      return points;
    }, []);
}

function getMovementColor(movement: WeeklyWealthPoint["movement"]) {
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
  isLoading,
  onChangeRange,
  range,
}: {
  formatCompactCurrency: (value: number) => string;
  formatCurrency: (value: number) => string;
  history: DashboardHistoryPoint[];
  isLoading: boolean;
  onChangeRange: (range: DashboardHistoryRange) => void;
  range: DashboardHistoryRange;
}) {
  const weeklyHistory = buildWeeklyAverageHistory(history);

  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#132842]">Wealth Movement</h2>
          <p className="mt-1 text-sm text-[#6d7d97]">
            Track weekly average worth across saved daily snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] ${
                range === option
                  ? "bg-[#173d7a] text-white"
                  : "border border-[#d5dfef] bg-white text-[#5f6f89]"
              }`}
              onClick={() => onChangeRange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {weeklyHistory.length ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyHistory}
              barCategoryGap={18}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke="#e8eef7" strokeDasharray="4 4" />
              <XAxis dataKey="label" tick={{ fill: "#6c7a93", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6c7a93", fontSize: 12 }} tickFormatter={formatCompactCurrency} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const item = payload[0];
                  const point = item.payload as WeeklyWealthPoint;

                  return (
                    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
                      <div className="font-semibold">{point.label}</div>
                      <div>Weekly avg: {formatCurrency(Number(item.value || 0))}</div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="averageTotalValue"
                name="averageTotalValue"
                radius={[8, 8, 0, 0]}
              >
                {weeklyHistory.map((point) => (
                  <Cell key={point.key} fill={getMovementColor(point.movement)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-12 text-center text-sm text-[#72829a]">
          Wealth history will appear after daily snapshots are recorded.
        </div>
      )}

      {isLoading ? <p className="mt-3 text-sm text-[#6d7d97]">Updating history…</p> : null}
    </section>
  );
}
