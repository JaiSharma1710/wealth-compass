"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DashboardHistoryPoint, DashboardHistoryRange } from "@/lib/dashboard.types";

const RANGE_OPTIONS: DashboardHistoryRange[] = ["1W", "1M", "3M", "6M", "1Y", "ALL"];

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
  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#132842]">Wealth Movement</h2>
          <p className="mt-1 text-sm text-[#6d7d97]">
            Track your total current worth across saved daily snapshots.
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

      {history.length >= 2 ? (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="dashboardWealth" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e8eef7" strokeDasharray="4 4" />
              <XAxis dataKey="date" tick={{ fill: "#6c7a93", fontSize: 12 }} />
              <YAxis tick={{ fill: "#6c7a93", fontSize: 12 }} tickFormatter={formatCompactCurrency} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }

                  const item = payload[0];
                  return (
                    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
                      <div className="font-semibold">{label}</div>
                      <div>Total worth: {formatCurrency(Number(item.value || 0))}</div>
                    </div>
                  );
                }}
              />
              <Area dataKey="totalValue" fill="url(#dashboardWealth)" stroke="#2563eb" strokeWidth={2} type="monotone" />
            </AreaChart>
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
