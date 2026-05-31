"use client";

import type { DashboardAssetClassSummary, DashboardGoalsSummary, DashboardSummary } from "@/lib/dashboard.types";

export function DashboardSummaryCards({
  assetClasses,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  goalsSummary,
  summary,
}: {
  assetClasses: DashboardAssetClassSummary[];
  formatCurrency: (value: number) => string;
  formatSignedCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
  goalsSummary: DashboardGoalsSummary;
  summary: DashboardSummary;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-[#dce4f0] bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c8aa5]">
              Total Current Worth
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-[#10203a]">
              {formatCurrency(summary.totalCurrentWorth)}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Invested" value={formatCurrency(summary.totalInvested)} />
            <MetricCard
              label="Gain / Loss"
              tone={summary.totalGainLoss >= 0 ? "positive" : "negative"}
              value={`${formatSignedCurrency(summary.totalGainLoss)} • ${formatPercent(
                summary.totalGainLossPercent
              )}`}
            />
            <MetricCard
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
            <MetricCard
              label="Goal Completion"
              value={goalsSummary.empty ? "No goals yet" : formatPercent(goalsSummary.overallCompletionPercent)}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {assetClasses.map((assetClass) => (
          <AssetCard
            key={assetClass.key}
            assetClass={assetClass}
            formatCurrency={formatCurrency}
            formatSignedCurrency={formatSignedCurrency}
            formatPercent={formatPercent}
          />
        ))}
        <section className="rounded-[24px] border border-[#dde5f1] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">Goals</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[#132842]">
            {goalsSummary.activeGoalsCount}
          </p>
          <div className="mt-3 space-y-1.5 text-sm text-[#5e6e88]">
            <p>Saved: {formatCurrency(goalsSummary.totalSavedAmount)}</p>
            <p>Target: {formatCurrency(goalsSummary.totalTargetAmount)}</p>
            <p>Completed: {goalsSummary.completedGoalsCount}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "positive" | "negative";
  value: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-[#0f7a56]"
      : tone === "negative"
        ? "text-[#b23434]"
        : "text-[#132842]";

  return (
    <div className="rounded-2xl bg-[#f7faff] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7c8aa5]">{label}</p>
      <p className={`mt-2 text-base font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function AssetCard({
  assetClass,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
}: {
  assetClass: DashboardAssetClassSummary;
  formatCurrency: (value: number) => string;
  formatSignedCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
}) {
  const toneClass =
    assetClass.gainLoss > 0
      ? "text-[#0f7a56]"
      : assetClass.gainLoss < 0
        ? "text-[#b23434]"
        : "text-[#132842]";

  return (
    <section className="rounded-[24px] border border-[#dde5f1] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
            {assetClass.label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#132842]">
            {formatCurrency(assetClass.currentValue)}
          </p>
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
    </section>
  );
}
