"use client";

import type { ReactNode } from "react";
import {
  ArrowDownRight,
  CircleDollarSign,
  Coins,
  Layers3,
  PiggyBank,
  TrendingUp,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { DashboardAllocationPoint, DashboardAssetClassSummary } from "@/lib/dashboard.types";

const ALLOCATION_COLORS = ["#2563eb", "#16a34a", "#d97706", "#0f766e", "#7c3aed"];

export function DashboardAssetAllocation({
  allocation,
  assetClasses,
  formatCurrency,
  formatPercent,
}: {
  allocation: DashboardAllocationPoint[];
  assetClasses: DashboardAssetClassSummary[];
  formatCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
}) {
  const topAssetClass = allocation[0];
  const mostProfitable = [...assetClasses].sort((left, right) => right.gainLossPercent - left.gainLossPercent)[0];
  const worstPerforming = [...assetClasses].sort((left, right) => left.gainLossPercent - right.gainLossPercent)[0];
  const cashAsset = assetClasses.find((assetClass) => assetClass.key === "cash");
  const totalWorth = allocation.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <section className="overflow-hidden rounded-[32px] border border-[#dce4f0] bg-[radial-gradient(circle_at_top,#f8fbff_0%,#ffffff_44%,#f9fbff_100%)] p-6 shadow-[0_24px_70px_rgba(37,99,235,0.08)]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[1.75rem] font-semibold tracking-tight text-[#132842]">Portfolio Allocation</h2>
          <p className="mt-2 text-base text-[#6d7d97]">See how your current worth is distributed.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e1ef] bg-white/90 px-4 py-2 text-sm font-medium text-[#314869] shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <Layers3 className="h-4 w-4" />
          {allocation.length} asset classes
        </div>
      </div>
      {allocation.length ? (
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1.25fr]">
          <div className="relative flex min-h-[360px] items-center justify-center">
            <div className="absolute inset-x-6 top-6 h-28 rounded-full bg-[radial-gradient(circle,#eff6ff_0%,rgba(239,246,255,0)_72%)] blur-3xl" />
            <div className="relative h-[320px] w-full max-w-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    innerRadius={96}
                    outerRadius={132}
                    paddingAngle={2.4}
                    cornerRadius={8}
                    stroke="#ffffff"
                    strokeWidth={4}
                  >
                    {allocation.map((entry, index) => (
                      <Cell key={entry.key} fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 40 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) {
                        return null;
                      }

                      const item = payload[0]?.payload as DashboardAllocationPoint;
                      return (
                        <div className="rounded-2xl border border-[#dbe4f0] bg-white px-4 py-3 text-sm text-[#17304f] shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                          <div className="font-semibold">{item.label}</div>
                          <div className="mt-1">{formatCurrency(item.value)}</div>
                          <div className="text-xs text-[#71819a]">{formatPercent(item.percentage)}</div>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="z-10 flex h-[190px] w-[190px] flex-col items-center justify-center rounded-full bg-white/95 text-center shadow-[inset_0_0_0_1px_rgba(220,228,240,0.9),0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur">
                  <div className="text-[15px] font-medium text-[#7383a0]">Total Worth</div>
                  <div className="mt-2 text-[1.15rem] font-semibold leading-tight text-[#10203a] sm:text-[1.5rem]">
                    {formatCurrency(totalWorth)}
                  </div>
                  <div className="mt-3 max-w-[110px] text-sm leading-6 text-[#7383a0]">
                    Based on current asset value
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {allocation.map((entry, index) => (
              <div
                key={entry.key}
                className="rounded-[22px] border border-[#dce4f0] bg-white/90 px-5 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-[#213655]">
                    <span
                      className="h-4 w-4 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.95)]"
                      style={{ backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length] }}
                    />
                    <span className="text-xl font-medium tracking-tight">{entry.label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.95rem] font-semibold text-[#1c3152] sm:text-[1.15rem]">
                      {formatCurrency(entry.value)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-[#72829a]">
                      {formatPercent(entry.percentage)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf3fb]">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.min(100, Math.max(0, entry.percentage))}%`,
                      backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="grid gap-3 pt-3 md:grid-cols-3">
              <InsightTile
                icon={<CircleDollarSign className="h-5 w-5" />}
                label="Largest Asset"
                tone="blue"
                title={topAssetClass?.label || "N/A"}
                value={topAssetClass ? formatPercent(topAssetClass.percentage) : "N/A"}
              />
              <InsightTile
                icon={<TrendingUp className="h-5 w-5" />}
                label="Best Performer"
                tone="green"
                title={mostProfitable?.label || "N/A"}
                value={mostProfitable ? formatPercent(mostProfitable.gainLossPercent) : "N/A"}
              />
              <InsightTile
                icon={<ArrowDownRight className="h-5 w-5" />}
                label="Lowest Performer"
                tone="amber"
                title={worstPerforming?.label || "N/A"}
                value={worstPerforming ? formatPercent(worstPerforming.gainLossPercent) : "N/A"}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <MiniStat
                icon={<PiggyBank className="h-4 w-4" />}
                label="Cash allocation"
                value={cashAsset ? formatPercent(cashAsset.allocationPercent) : "0.00%"}
              />
              <MiniStat
                icon={<Coins className="h-4 w-4" />}
                label="Tracked allocation"
                value={formatCurrency(totalWorth)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-12 text-center text-sm text-[#72829a]">
          Allocation will appear after you add assets.
        </div>
      )}
    </section>
  );
}

function InsightTile({
  icon,
  label,
  title,
  tone,
  value,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  tone: "blue" | "green" | "amber";
  value: string;
}) {
  const toneStyles = {
    blue: {
      wrap: "bg-[linear-gradient(135deg,#eff6ff_0%,#f8fbff_100%)]",
      badge: "bg-[#2563eb] text-white",
      value: "text-[#2563eb]",
    },
    green: {
      wrap: "bg-[linear-gradient(135deg,#ecfdf3_0%,#f7fcf8_100%)]",
      badge: "bg-[#22c55e] text-white",
      value: "text-[#15803d]",
    },
    amber: {
      wrap: "bg-[linear-gradient(135deg,#fff7ed_0%,#fffaf4_100%)]",
      badge: "bg-[#fbbf24] text-white",
      value: "text-[#b45309]",
    },
  }[tone];

  return (
    <div className={`rounded-[24px] border border-white/70 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${toneStyles.wrap}`}>
      <div className="flex items-center gap-3">
        <div className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${toneStyles.badge}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#6f7f99]">{label}</div>
          <div className="truncate text-lg font-semibold text-[#18304f]">{title}</div>
        </div>
      </div>
      <div className={`mt-3 text-[1.15rem] font-semibold ${toneStyles.value}`}>{value}</div>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[#dce4f0] bg-white/75 px-4 py-3 text-sm shadow-[0_10px_20px_rgba(15,23,42,0.03)]">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f6fd] text-[#2c4c7d]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[#6f7f99]">{label}</div>
        <div className="truncate font-semibold text-[#18304f]">{value}</div>
      </div>
    </div>
  );
}
