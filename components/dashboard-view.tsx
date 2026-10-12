"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Lightbulb,
  ReceiptText,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { AllocationBar, ASSET_COLORS, TrendChart } from "@/components/ui/charts";
import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  Delta,
  EmptyState,
  Page,
  ProgressBar,
  Segmented,
  Swatch,
} from "@/components/ui/kit";
import { filterHistoryByRange } from "@/lib/dashboard-calculations";
import {
  DASHBOARD_HISTORY_RANGES,
  type DashboardData,
  type DashboardHistoryRange,
  type DashboardInsight,
} from "@/lib/dashboard.types";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatPercent,
  formatShortDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

type ChartMode = "netWorth" | "breakdown";

const BREAKDOWN_SERIES = [
  { key: "stocksValue", label: "Stocks", color: ASSET_COLORS.stocks },
  { key: "mutualFundsValue", label: "Mutual Funds", color: ASSET_COLORS.mutualFunds },
  { key: "cashValue", label: "Cash", color: ASSET_COLORS.cash },
  { key: "goldValue", label: "Gold", color: ASSET_COLORS.gold },
  { key: "otherAssetsValue", label: "Other Assets", color: ASSET_COLORS.otherAssets },
];

export function DashboardView({ data, currencyCode }: { data: DashboardData; currencyCode: string }) {
  const currency = currencyCode;
  const [range, setRange] = useState<DashboardHistoryRange>(data.historyRange);
  const [chartMode, setChartMode] = useState<ChartMode>("netWorth");
  const { summary } = data;
  const rangeHistory = useMemo(() => filterHistoryByRange(data.history, range), [data.history, range]);
  const rangeChange = useMemo(() => {
    if (rangeHistory.length < 2) return null;
    const first = rangeHistory[0].totalValue;
    const last = rangeHistory[rangeHistory.length - 1].totalValue;
    return { value: last - first, percent: first ? ((last - first) / Math.abs(first)) * 100 : null };
  }, [rangeHistory]);
  const breakdownSeries = BREAKDOWN_SERIES.filter((series) =>
    rangeHistory.some((point) => Number(point[series.key as keyof typeof point]) > 0)
  );

  if (data.empty) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={Lightbulb}
            title="Start building your wealth map"
            message="Add a stock, mutual fund, gold holding, cash balance or any other asset to see your net worth come together here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/stocks" variant="primary">Add stocks</ButtonLink>
                <ButtonLink href="/mutual-funds">Add mutual funds</ButtonLink>
                <ButtonLink href="/accounts">Add FD / PPF / loans</ButtonLink>
              </div>
            }
          />
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Hero: net worth + chart */}
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-3">Net worth</p>
              <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
                {formatMoney(summary.netWorth, { currency, decimals: 0 })}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {summary.todayGainLoss != null ? (
                  <Delta value={summary.todayGainLoss} percent={summary.todayGainLossPercent} currency={currency} suffix="1D" />
                ) : (
                  <span className="text-sm text-ink-3">Day change appears after the next price sync</span>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-3 gap-x-5 gap-y-2 text-right sm:gap-x-8">
              <div>
                <dt className="text-xs text-ink-3">Invested</dt>
                <dd className="tabular text-sm font-semibold text-ink">{formatCompactMoney(summary.totalInvested, { currency })}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Returns</dt>
                <dd>
                  <Delta value={summary.totalGainLoss} compact currency={currency} className="font-semibold" />
                  <span className="tabular block text-xs text-ink-3">{formatPercent(summary.totalGainLossPercent, { sign: true })}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3" title="Annualised return on stocks, mutual funds and gold. Shown once you have a year of history; before that, absolute returns are more meaningful.">
                  XIRR
                </dt>
                <dd className={cn("tabular text-sm font-semibold", (summary.xirr ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {summary.xirr == null ? <span className="text-xs font-normal text-ink-3">after 1 yr</span> : formatPercent(summary.xirr, { sign: true, decimals: 1 })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {data.periodChanges.filter((period) => period.key !== "1D").map((period) => (
              <div key={period.key} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2" title={period.fromDate ? `Net worth change since ${formatDate(period.fromDate)}` : "Not enough history yet"}>
                <p className="text-[0.7rem] font-medium text-ink-3">{period.key}</p>
                {period.change == null ? (
                  <p className="text-sm text-ink-3">—</p>
                ) : (
                  <>
                    <Delta value={period.change} compact currency={currency} size="xs" className="text-[0.8rem]" />
                    <p className="tabular text-[0.7rem] text-ink-3">{formatPercent(period.changePercent, { sign: true })}</p>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              ariaLabel="Chart view"
              value={chartMode}
              onChange={setChartMode}
              options={[
                { value: "netWorth", label: "Net worth" },
                { value: "breakdown", label: "By asset" },
              ]}
            />
            <Segmented
              ariaLabel="Time range"
              size="xs"
              value={range}
              onChange={setRange}
              options={DASHBOARD_HISTORY_RANGES.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="mt-3">
            {rangeHistory.length >= 2 ? (
              <>
                <TrendChart
                  data={rangeHistory}
                  xKey="date"
                  height={240}
                  currency={currency}
                  series={
                    chartMode === "netWorth"
                      ? [{ key: "totalValue", label: "Net worth", color: "var(--wc-brand)" }]
                      : breakdownSeries
                  }
                />
                {rangeChange && chartMode === "netWorth" ? (
                  <p className="mt-2 text-xs text-ink-3">
                    {range === "ALL" ? "Since tracking began" : `Over ${range}`}:{" "}
                    <Delta value={rangeChange.value} percent={rangeChange.percent} currency={currency} size="xs" />
                  </p>
                ) : null}
              </>
            ) : (
              <p className="py-12 text-center text-sm text-ink-3">The chart fills in as daily snapshots are saved each morning.</p>
            )}
          </div>
        </Card>

        {/* Allocation */}
        <Card>
          <CardHeader title="Where your money is" subtitle={`${formatCompactMoney(summary.totalAssets, { currency })} across ${data.allocation.length} asset classes`} />
          <AllocationBar
            currency={currency}
            items={data.allocation.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value,
              color: ASSET_COLORS[item.key],
              href: data.assetClasses.find((assetClass) => assetClass.key === item.key)?.actionHref,
            }))}
          />
          <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-3">Total assets</span>
              <span className="tabular font-medium text-ink">{formatMoney(summary.totalAssets, { currency })}</span>
            </div>
            <div className="flex justify-between">
              <Link href="/accounts" className="text-ink-3 hover:text-ink">Liabilities{data.liabilities.count ? ` (${data.liabilities.count})` : ""}</Link>
              <span className="tabular font-medium text-loss">{summary.totalLiabilities ? `-${formatMoney(summary.totalLiabilities, { currency })}` : formatMoney(0, { currency })}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-ink">Net worth</span>
              <span className="tabular text-ink">{formatMoney(summary.netWorth, { currency })}</span>
            </div>
            {!data.liabilities.count ? (
              <Link href="/accounts" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand">
                Add loans, FD, PPF, EPF <ArrowRight className="size-3" />
              </Link>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Asset classes */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {data.assetClasses.map((assetClass) => {
          const empty = assetClass.currentValue <= 0;

          return (
            <Link
              key={assetClass.key}
              href={assetClass.actionHref}
              className={cn(
                "group min-w-0 rounded-2xl border border-line bg-surface p-3.5 transition hover:border-line-strong hover:shadow-sm sm:p-4",
                empty && "opacity-70"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-2">
                  <Swatch color={ASSET_COLORS[assetClass.key]} />
                  <span className="truncate">{assetClass.label}</span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100" />
              </div>
              {empty ? (
                <p className="mt-2 text-sm text-ink-3">Not added yet</p>
              ) : (
                <>
                  <p className="tabular mt-1.5 truncate text-lg font-semibold text-ink">
                    {formatCompactMoney(assetClass.currentValue, { currency })}
                  </p>
                  {assetClass.todayGainLoss != null ? (
                    <Delta value={assetClass.todayGainLoss} percent={assetClass.todayGainLossPercent} compact currency={currency} size="xs" suffix="1D" />
                  ) : (
                    <p className="text-xs text-ink-3">{formatPercent(assetClass.allocationPercent, { decimals: 1 })} of assets</p>
                  )}
                  {assetClass.key !== "cash" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-line pt-2 text-xs">
                      <span className="text-ink-3">Returns</span>
                      <Delta value={assetClass.gainLoss} percent={assetClass.gainLossPercent} compact currency={currency} size="xs" />
                      {assetClass.xirr != null ? (
                        <span className="text-ink-3">· XIRR {formatPercent(assetClass.xirr, { decimals: 1 })}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-2 border-t border-line pt-2 text-xs text-ink-3">
                      {assetClass.count} account{assetClass.count === 1 ? "" : "s"}
                    </div>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <MoversCard data={data} currency={currency} />
        <SpendingCard data={data} currency={currency} />
        <GoalsCard data={data} currency={currency} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Insights" subtitle="What stands out right now" />
          <ul className="space-y-2.5">
            {data.insights.map((insight) => (
              <InsightRow key={insight.id} insight={insight} />
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Recent activity" subtitle="Across investments, cash and spending" />
          {data.recentActivity.length ? (
            <ul className="divide-y divide-line">
              {data.recentActivity.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-surface-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Swatch
                        color={item.assetClassKey === "expenses" ? "var(--wc-ink-3)" : ASSET_COLORS[item.assetClassKey]}
                        className="size-2"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                        <p className="truncate text-xs text-ink-3">
                          {item.type} · {item.assetClassLabel} · {formatShortDate(item.date)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "tabular shrink-0 text-sm font-medium",
                        ["Sold", "Redeemed", "Deposit", "Received"].includes(item.type) ? "text-gain" : "text-ink"
                      )}
                    >
                      {formatMoney(item.amount, { currency })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No activity yet" />
          )}
        </Card>
      </div>
    </Page>
  );
}

function MoversCard({ data, currency }: { data: DashboardData; currency: string }) {
  const [tab, setTab] = useState<"gainers" | "losers">(
    data.movers.gainers.length || !data.movers.losers.length ? "gainers" : "losers"
  );
  const list = data.movers[tab];

  return (
    <Card>
      <CardHeader
        title="Today's movers"
        subtitle="Your holdings by 1-day change"
        action={
          <Segmented
            size="xs"
            value={tab}
            onChange={setTab}
            options={[
              { value: "gainers", label: `Gainers ${data.movers.gainers.length || ""}`.trim() },
              { value: "losers", label: `Losers ${data.movers.losers.length || ""}`.trim() },
            ]}
          />
        }
      />
      {list.length ? (
        <ul className="divide-y divide-line">
          {list.map((mover) => (
            <li key={mover.id}>
              <Link href={mover.href} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition hover:bg-surface-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Swatch color={ASSET_COLORS[mover.assetClassKey]} className="size-2" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{mover.name}</p>
                    <p className="tabular truncate text-xs text-ink-3">{formatCompactMoney(mover.currentValue, { currency })}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Delta percent={mover.dayChangePercent} size="sm" />
                  <p className="tabular text-xs text-ink-3">{formatMoney(mover.dayChange, { currency, sign: true })}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={tab === "gainers" ? TrendingUp : TrendingDown}
          title={tab === "gainers" ? "No gainers today" : "No losers today"}
          message="Day changes appear once prices have synced on two different days."
          className="py-6"
        />
      )}
    </Card>
  );
}

function SpendingCard({ data, currency }: { data: DashboardData; currency: string }) {
  const flow = data.cashFlow;

  if (!flow) {
    return (
      <Card>
        <CardHeader title="Spending this month" />
        <EmptyState icon={ReceiptText} title="Track your spending" message="Log expenses to see your monthly budget here." action={<ButtonLink href="/expenses" size="sm">Open expenses</ButtonLink>} className="py-6" />
      </Card>
    );
  }

  const usedPct = flow.budget ? (flow.spent / flow.budget) * 100 : 0;
  const tone = flow.status === "over_budget" ? "loss" : flow.status === "over_pace" ? "warn" : "gain";

  return (
    <Card>
      <CardHeader
        title="Spending this cycle"
        subtitle={`${formatShortDate(flow.cycleStartDate)} – ${formatShortDate(flow.cycleEndDate)} · ${flow.daysLeft} days left`}
        action={<ButtonLink href="/expenses" size="sm" variant="ghost">Details</ButtonLink>}
      />
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="tabular text-2xl font-semibold text-ink">{formatMoney(flow.spent, { currency })}</p>
          <p className="text-xs text-ink-3">
            {flow.budget ? `of ${formatMoney(flow.budget, { currency })} budget` : "No budget set"}
          </p>
        </div>
        {flow.budget ? (
          <Badge tone={tone}>
            {flow.status === "over_budget" ? "Over budget pace" : flow.status === "over_pace" ? "Spending fast" : "On track"}
          </Badge>
        ) : null}
      </div>
      {flow.budget ? <ProgressBar value={usedPct} tone={tone} className="mt-3" label="Budget used" /> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-ink-3">Left to spend</dt>
          <dd className={cn("tabular text-sm font-semibold", (flow.remainingBudget ?? 0) < 0 ? "text-loss" : "text-ink")}>
            {flow.remainingBudget == null ? "—" : formatMoney(flow.remainingBudget, { currency })}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <dt className="text-ink-3">Last cycle</dt>
          <dd className="tabular text-sm font-semibold text-ink">
            {flow.previousCycleSpent == null ? "—" : formatMoney(flow.previousCycleSpent, { currency })}
          </dd>
        </div>
      </dl>
      {flow.topCategories.length ? (
        <ul className="mt-3 space-y-1.5">
          {flow.topCategories.map((category) => (
            <li key={category.key} className="flex items-center justify-between text-sm">
              <span className="truncate text-ink-2">{category.label}</span>
              <span className="tabular font-medium text-ink">{formatMoney(category.amount, { currency })}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function GoalsCard({ data, currency }: { data: DashboardData; currency: string }) {
  const goals = data.goalsSummary;

  return (
    <Card>
      <CardHeader
        title="Goals"
        subtitle={goals.empty ? "Turn plans into targets" : `${goals.activeGoalsCount} active · ${goals.completedGoalsCount} done`}
        action={<ButtonLink href="/goals" size="sm" variant="ghost">{goals.empty ? "Add" : "All goals"}</ButtonLink>}
      />
      {goals.empty ? (
        <EmptyState icon={Target} title="No goals yet" message="Link a goal to your investments and track progress automatically." className="py-6" />
      ) : (
        <ul className="space-y-4">
          {goals.goals.map((goal) => (
            <li key={goal.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-sm font-medium text-ink">{goal.name}</span>
                <span className="tabular shrink-0 text-xs text-ink-3">
                  {formatCompactMoney(goal.currentValue, { currency })} / {formatCompactMoney(goal.targetAmount, { currency })}
                </span>
              </div>
              <ProgressBar value={goal.progressPct} tone={goal.progressPct >= 100 ? "gain" : "brand"} label={`${goal.name} progress`} />
              <p className="mt-1 text-xs text-ink-3">
                {formatPercent(goal.progressPct, { decimals: 0 })} funded{goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const INSIGHT_ICONS: Record<DashboardInsight["tone"], LucideIcon> = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  negative: AlertTriangle,
  neutral: Info,
};

function InsightRow({ insight }: { insight: DashboardInsight }) {
  const Icon = INSIGHT_ICONS[insight.tone];
  const body = (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
          insight.tone === "positive" && "bg-gain-soft text-gain",
          insight.tone === "warning" && "bg-warn-soft text-warn",
          insight.tone === "negative" && "bg-loss-soft text-loss",
          insight.tone === "neutral" && "bg-brand-soft text-brand"
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{insight.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{insight.message}</p>
      </div>
    </div>
  );

  return (
    <li>
      {insight.href ? (
        <Link href={insight.href} className="-mx-2 block rounded-xl px-2 py-1.5 transition hover:bg-surface-2">
          {body}
        </Link>
      ) : (
        <div className="py-1.5">{body}</div>
      )}
    </li>
  );
}
