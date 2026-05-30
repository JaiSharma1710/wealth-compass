"use client";

import Link from "next/link";

import type { DashboardGoalsSummary } from "@/lib/dashboard.types";

export function DashboardGoalsSummarySection({
  formatCurrency,
  formatPercent,
  goalsSummary,
}: {
  formatCurrency: (value: number) => string;
  formatPercent: (value: number | null) => string;
  goalsSummary: DashboardGoalsSummary;
}) {
  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#132842]">Goals Snapshot</h2>
        <p className="mt-1 text-sm text-[#6d7d97]">Keep your targets in view without double-counting them in net worth.</p>
      </div>

      {goalsSummary.empty ? (
        <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-[#223655]">No goals added yet</p>
          <p className="mt-2 text-sm text-[#72829a]">
            Create your first goal to link your assets with a target.
          </p>
          <Link
            className="mt-4 inline-flex rounded-full bg-[#173d7a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#123466]"
            href="/goals"
          >
            Create your first goal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatBox
              label="Active goals"
              progress={
                goalsSummary.activeGoalsCount + goalsSummary.completedGoalsCount > 0
                  ? (goalsSummary.activeGoalsCount /
                      (goalsSummary.activeGoalsCount + goalsSummary.completedGoalsCount)) *
                    100
                  : 0
              }
              value={String(goalsSummary.activeGoalsCount)}
            />
            <StatBox
              label="Completed goals"
              progress={
                goalsSummary.activeGoalsCount + goalsSummary.completedGoalsCount > 0
                  ? (goalsSummary.completedGoalsCount /
                      (goalsSummary.activeGoalsCount + goalsSummary.completedGoalsCount)) *
                    100
                  : 0
              }
              value={String(goalsSummary.completedGoalsCount)}
            />
            <StatBox
              label="Total target amount"
              progress={100}
              value={formatCurrency(goalsSummary.totalTargetAmount)}
            />
            <StatBox
              label="Saved amount"
              progress={
                goalsSummary.totalTargetAmount > 0
                  ? (goalsSummary.totalSavedAmount / goalsSummary.totalTargetAmount) * 100
                  : 0
              }
              value={formatCurrency(goalsSummary.totalSavedAmount)}
            />
            <StatBox
              label="Overall completion"
              progress={goalsSummary.overallCompletionPercent}
              value={formatPercent(goalsSummary.overallCompletionPercent)}
            />
          </div>

          {goalsSummary.nextGoalNeedingAttention ? (
            <div className="rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm">
              <p className="font-semibold text-[#17304f]">
                Next goal needing attention: {goalsSummary.nextGoalNeedingAttention.name}
              </p>
              <p className="mt-1 text-[#5e6e88]">
                Remaining: {formatCurrency(goalsSummary.nextGoalNeedingAttention.remainingAmount)}
              </p>
              <div className="mt-3 h-2 rounded-full bg-[#e4ebf5]">
                <div
                  className="h-2 rounded-full bg-[#173d7a]"
                  style={{
                    width: `${Math.min(
                      goalsSummary.nextGoalNeedingAttention.progressPct,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function StatBox({
  label,
  progress,
  value,
}: {
  label: string;
  progress: number;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-[#f8fbff] px-4 py-4 text-sm">
      <span className="text-[#51627d]">{label}</span>
      <p className="mt-2 font-semibold text-[#17304f]">{value}</p>
      <div className="mt-3 h-2 rounded-full bg-[#e4ebf5]">
        <div
          className="h-2 rounded-full bg-[#173d7a]"
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
