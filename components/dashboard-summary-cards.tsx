"use client";

import type { ComponentType } from "react";
import {
  BadgeCheck,
  Banknote,
  Coins,
  LineChart,
  PieChart,
  TrendingUp,
  Wallet,
} from "lucide-react";

import type {
  DashboardAssetClassSummary,
  DashboardAssetClassKey,
  DashboardHistoryPoint,
  DashboardSummary,
} from "@/lib/dashboard.types";

const ASSET_META: Record<
  DashboardAssetClassKey,
  { icon: ComponentType<{ className?: string }>; color: string; bg: string; historyKey: keyof DashboardHistoryPoint }
> = {
  stocks: {
    icon: LineChart,
    color: "#2563eb",
    bg: "#eff6ff",
    historyKey: "stocksValue",
  },
  mutualFunds: {
    icon: PieChart,
    color: "#16a34a",
    bg: "#ecfdf3",
    historyKey: "mutualFundsValue",
  },
  gold: {
    icon: Coins,
    color: "#f59e0b",
    bg: "#fffbeb",
    historyKey: "goldValue",
  },
  cash: {
    icon: Wallet,
    color: "#0f8a98",
    bg: "#ecfeff",
    historyKey: "cashValue",
  },
};

export function DashboardSummaryCards({
  assetClasses,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  history,
  summary,
}: {
  assetClasses: DashboardAssetClassSummary[];
  formatCurrency: (value: number) => string;
  formatSignedCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
  history: DashboardHistoryPoint[];
  summary: DashboardSummary;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[2rem] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c8aa5]">
              Total Current Worth
            </p>
            <h2 className="break-words text-3xl font-semibold tracking-tight text-[#10203a] sm:text-4xl">
              {formatCurrency(summary.totalCurrentWorth)}
            </h2>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-3xl xl:grid-cols-3">
            <MetricCard
              icon={Banknote}
              label="Invested"
              tone="blue"
              value={formatCurrency(summary.totalInvested)}
            />
            <MetricCard
              icon={TrendingUp}
              label="Gain / Loss"
              tone={summary.totalGainLoss >= 0 ? "positive" : "negative"}
              value={`${formatSignedCurrency(summary.totalGainLoss)} • ${formatPercent(
                summary.totalGainLossPercent
              )}`}
            />
            <MetricCard
              icon={BadgeCheck}
              label="Today's Movement"
              tone={summary.todayGainLoss == null ? "neutral" : summary.todayGainLoss >= 0 ? "positive" : "negative"}
              value={
                summary.todayGainLoss == null
                  ? "Unavailable"
                  : `${formatSignedCurrency(summary.todayGainLoss)} • ${formatPercent(
                      summary.todayGainLossPercent
                    )}`
              }
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {assetClasses.map((assetClass) => (
          <AssetCard
            key={assetClass.key}
            assetClass={assetClass}
            formatCurrency={formatCurrency}
            formatSignedCurrency={formatSignedCurrency}
            formatPercent={formatPercent}
            history={history}
          />
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  tone?: "neutral" | "positive" | "negative" | "blue" | "purple";
  value: string;
}) {
  const toneStyles = {
    neutral: { icon: "bg-[#f1f5f9] text-[#334155]", value: "text-[#132842]" },
    positive: { icon: "bg-[#dcfce7] text-[#15803d]", value: "text-[#0f7a56]" },
    negative: { icon: "bg-[#fee2e2] text-[#b91c1c]", value: "text-[#b23434]" },
    blue: { icon: "bg-[#dbeafe] text-[#2563eb]", value: "text-[#132842]" },
    purple: { icon: "bg-[#ede9fe] text-[#7c3aed]", value: "text-[#132842]" },
  }[tone];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#edf2f7] bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.04)]">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${toneStyles.icon}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#7c8aa5]">{label}</p>
        <p className={`mt-1 break-words text-base font-semibold ${toneStyles.value}`}>{value}</p>
      </div>
    </div>
  );
}

function AssetCard({
  assetClass,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  history,
}: {
  assetClass: DashboardAssetClassSummary;
  formatCurrency: (value: number) => string;
  formatSignedCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
  history: DashboardHistoryPoint[];
}) {
  const meta = ASSET_META[assetClass.key];
  const Icon = meta.icon;
  const toneClass =
    assetClass.gainLoss > 0
      ? "text-[#0f7a56]"
      : assetClass.gainLoss < 0
        ? "text-[#b23434]"
        : "text-[#132842]";

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-[#dde5f1] bg-white shadow-[0_14px_32px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(15,23,42,0.07)]">
      <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#10203a]">
            {assetClass.label}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-[#132842]">
            {formatCurrency(assetClass.currentValue)}
          </p>
          </div>
        </div>
        {assetClass.stale ? (
          <span className="rounded-full bg-[#fff5e5] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#b27712]">
            Stale
          </span>
        ) : null}
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-[#5e6e88]">
        <p>Invested: {formatCurrency(assetClass.investedAmount)}</p>
        <p className={toneClass}>
          P&amp;L: {formatSignedCurrency(assetClass.gainLoss)} • {formatPercent(assetClass.gainLossPercent)}
        </p>
        <p>
          Today:{" "}
          {assetClass.todayGainLoss == null
            ? "Unavailable"
            : `${formatSignedCurrency(assetClass.todayGainLoss)} • ${formatPercent(
                assetClass.todayGainLossPercent
              )}`}
        </p>
        <p>Allocation: {formatPercent(assetClass.allocationPercent)}</p>
      </div>
      </div>
      <AssetSparkline
        color={meta.color}
        values={history.slice(-28).map((point) => Number(point[meta.historyKey] || 0))}
      />
    </section>
  );
}

function AssetSparkline({ color, values }: { color: string; values: number[] }) {
  const path = createSparklinePath(values, 260, 44);

  return (
    <div className="px-4 pb-4">
      <svg
        aria-hidden="true"
        className="h-14 w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 260 56"
      >
        <line stroke="#e2e8f0" strokeDasharray="4 4" x1="0" x2="260" y1="48" y2="48" />
        {path ? (
          <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeWidth="3" />
        ) : (
          <path d="M0 48 L260 48" fill="none" stroke={color} strokeDasharray="5 5" strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}

function createSparklinePath(values: number[], width: number, height: number) {
  const filteredValues = values.filter((value) => Number.isFinite(value));

  if (filteredValues.length < 2) {
    return "";
  }

  const min = Math.min(...filteredValues);
  const max = Math.max(...filteredValues);
  const range = max - min || 1;

  return filteredValues
    .map((value, index) => {
      const x = (index / (filteredValues.length - 1)) * width;
      const y = 6 + (1 - (value - min) / range) * height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
