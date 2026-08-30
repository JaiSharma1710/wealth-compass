"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bell, Download, Loader2, TrendingUp, X } from "lucide-react";
import toast from "react-hot-toast";

import { DashboardAssetAllocation } from "@/components/dashboard-asset-allocation";
import { DashboardGoalsSummarySection } from "@/components/dashboard-goals-summary";
import { DashboardRecentActivity } from "@/components/dashboard-recent-activity";
import { DashboardSummaryCards } from "@/components/dashboard-summary-cards";
import { DashboardWealthChart } from "@/components/dashboard-wealth-chart";
import type { DashboardData, DashboardHistoryPoint, DashboardHistoryRange } from "@/lib/dashboard.types";

export function DashboardView({
  currencyCode,
  initialData,
}: {
  currencyCode: string;
  initialData: DashboardData;
}) {
  const data = initialData;
  const [historyRange, setHistoryRange] = useState<DashboardHistoryRange>(initialData.historyRange);
  const [history, setHistory] = useState<DashboardHistoryPoint[]>(initialData.history);
  const [historyAvailableRanges, setHistoryAvailableRanges] = useState<DashboardHistoryRange[]>(
    initialData.historyAvailableRanges
  );
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isReportDownloading, setIsReportDownloading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currencyCode || "INR",
        maximumFractionDigits: 2,
      }),
    [currencyCode]
  );
  const compactFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-IN", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
  );

  function formatPercent(value: number | null) {
    if (value == null) {
      return "Unavailable";
    }

    return value >= 0 ? `+${value.toFixed(2)}%` : `(${Math.abs(value).toFixed(2)}%)`;
  }

  function formatSignedCurrency(value: number) {
    return value >= 0
      ? formatter.format(value)
      : `(${formatter.format(Math.abs(value))})`;
  }

  function formatDate(value: string) {
    const isoDate = value.slice(0, 10);
    const [year, month, day] = isoDate.split("-");

    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }

  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(value));
  }

  async function handleRangeChange(nextRange: DashboardHistoryRange) {
    if (!historyAvailableRanges.includes(nextRange) || isHistoryLoading) {
      return;
    }

    setHistoryRange(nextRange);
    setIsHistoryLoading(true);

    try {
      const response = await fetch(`/api/dashboard/history?range=${encodeURIComponent(nextRange)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as
        | {
            history?: DashboardHistoryPoint[];
            historyAvailableRanges?: DashboardHistoryRange[];
            message?: string;
            range?: DashboardHistoryRange;
          }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Could not load dashboard history.");
      }

      setHistory(result?.history || []);
      setHistoryRange(result?.range || nextRange);
      setHistoryAvailableRanges(result?.historyAvailableRanges || historyAvailableRanges);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load dashboard history.");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  function getFilenameFromDisposition(disposition: string | null, fallback: string) {
    const match = /filename="?([^"]+)"?/i.exec(disposition || "");

    return match?.[1] || fallback;
  }

  async function downloadReportFile(format: "xls" | "pdf") {
    const response = await fetch(`/api/portfolio-report?format=${format}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(result?.message || `Could not download ${format.toUpperCase()} report.`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = getFilenameFromDisposition(
      response.headers.get("Content-Disposition"),
      `wealth-compass-portfolio-report.${format}`
    );
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleReportDownload() {
    setIsReportDownloading(true);

    try {
      await downloadReportFile("xls");
      // await downloadReportFile("pdf");
      toast.success("Portfolio report downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download portfolio report.");
    } finally {
      setIsReportDownloading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb]">
      <section className="flex min-h-full flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-[#dce3ef] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-[#72829a]">
                  <span>
                    Last updated:{" "}
                    {data.summary.lastUpdatedAt ? formatDateTime(data.summary.lastUpdatedAt) : "Not yet"}
                  </span>
                </div>
                <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                  <div>
                    <p className="text-base font-semibold text-[#10203a]">Your total wealth</p>
                    <h2 className="mt-3 break-words text-4xl font-semibold tracking-tight text-[#061b49] sm:text-5xl">
                      {formatter.format(data.summary.totalCurrentWorth)}
                    </h2>
                    <div className="mt-7">
                      <p className="text-sm font-semibold text-[#223655]">Today&apos;s movement</p>
                      <div
                        className={`mt-2 inline-flex items-center gap-2 text-sm font-semibold ${
                          data.summary.todayGainLoss == null
                            ? "text-[#72829a]"
                            : data.summary.todayGainLoss >= 0
                              ? "text-[#0f9f5f]"
                              : "text-[#c2410c]"
                        }`}
                      >
                        <TrendingUp className="size-4" />
                        <span>
                          {data.summary.todayGainLoss == null
                            ? "Unavailable"
                            : `${formatSignedCurrency(data.summary.todayGainLoss)} (${formatPercent(
                                data.summary.todayGainLossPercent
                              )})`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <HeroSparkline history={history} />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                <button
                  aria-label="Download detailed portfolio report"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#d6e0ef] bg-white px-4 text-sm font-semibold text-[#234067] shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition hover:border-[#9cb6dc] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:rounded-full"
                  disabled={isReportDownloading}
                  onClick={handleReportDownload}
                  title="Download XLS and PDF report"
                  type="button"
                >
                  {isReportDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>Download</span>
                </button>
                <button
                  aria-label="Open insights and alerts"
                  className="relative inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#d6e0ef] bg-white text-[#234067] shadow-[0_10px_22px_rgba(15,23,42,0.04)] transition hover:border-[#9cb6dc] hover:bg-[#f8fbff] sm:w-11 sm:rounded-full"
                  onClick={() => setIsInsightsOpen(true)}
                  type="button"
                >
                  <Bell className="h-4 w-4" />
                  {data.insights.length ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#173d7a] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      {data.insights.length}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
          </div>

          {data.summary.hasStaleData ? (
            <div className="mx-5 mb-5 rounded-2xl border border-[#f4d6a0] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6120] sm:mx-6">
              Some values may be stale.
            </div>
          ) : null}

          {data.summary.todayMovementUnavailableAssetKeys.length > 0 &&
          data.summary.todayMovementAvailableAssetKeys.length > 0 ? (
            <div className="mx-5 mb-5 rounded-2xl border border-[#dde6f5] bg-[#f8fbff] px-4 py-3 text-sm text-[#5c6b85] sm:mx-6">
              Today&apos;s movement includes only asset classes with reliable daily data right now.
            </div>
          ) : null}
        </div>

        {data.empty ? (
          <section className="rounded-[2rem] border border-[#dce4f0] bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c8aa5]">Welcome to Wealth Compass</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#10203a] sm:text-4xl">Start by adding your first asset</h2>
              <p className="mt-3 text-sm text-[#5f6f89]">
                Your dashboard will show net worth, allocation, recent activity, and long-term wealth movement after you add entries.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { href: "/stocks", label: "Add Stocks" },
                  { href: "/mutual-funds", label: "Add Mutual Funds" },
                  { href: "/gold", label: "Add Gold" },
                  { href: "/cash-and-reserves", label: "Add Cash Reserve" },
                ].map((action) => (
                  <Link
                    key={action.href}
                    className="rounded-[24px] border border-[#dde5f1] bg-[#f8fbff] px-5 py-6 text-sm font-semibold text-[#173d7a] transition hover:bg-[#edf5ff]"
                    href={action.href}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            <DashboardSummaryCards
              assetClasses={data.assetClasses}
              formatCurrency={(value) => formatter.format(value)}
              formatSignedCurrency={formatSignedCurrency}
              formatPercent={formatPercent}
              history={history}
              summary={data.summary}
            />

            <DashboardAssetAllocation
              allocation={data.allocation}
              assetClasses={data.assetClasses}
              formatCurrency={(value) => formatter.format(value)}
              formatPercent={formatPercent}
            />

            <DashboardWealthChart
              formatCompactCurrency={(value) => compactFormatter.format(value)}
              formatCurrency={(value) => formatter.format(value)}
              history={history}
              availableRanges={historyAvailableRanges}
              isLoading={isHistoryLoading}
              onChangeRange={handleRangeChange}
              range={historyRange}
            />

            <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-[#132842]">Asset Class Performance</h2>
                <p className="mt-1 text-sm text-[#6d7d97]">Compare value, profit, movement, and allocation across your assets.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e6edf7] text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
                      <th className="px-3 py-2">Asset Class</th>
                      <th className="px-3 py-2">Current Value</th>
                      <th className="px-3 py-2">Invested</th>
                      <th className="px-3 py-2">Gain / Loss</th>
                      <th className="px-3 py-2">Today</th>
                      <th className="px-3 py-2">Allocation</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.assetClasses.map((assetClass) => (
                      <tr key={assetClass.key} className="border-b border-[#eef3fa] text-[#233a5f]">
                        <td className="px-3 py-3">
                          <div className="font-medium">{assetClass.label}</div>
                          <div className="text-xs text-[#708099]">
                            {assetClass.count} item{assetClass.count === 1 ? "" : "s"}
                          </div>
                        </td>
                        <td className="px-3 py-3">{formatter.format(assetClass.currentValue)}</td>
                        <td className="px-3 py-3">{formatter.format(assetClass.investedAmount)}</td>
                        <td className={`px-3 py-3 ${assetClass.gainLoss >= 0 ? "text-[#0f7a56]" : "text-[#b23434]"}`}>
                          {formatSignedCurrency(assetClass.gainLoss)} • {formatPercent(assetClass.gainLossPercent)}
                        </td>
                        <td className="px-3 py-3">
                          {assetClass.todayGainLoss == null
                            ? "Unavailable"
                            : `${formatSignedCurrency(assetClass.todayGainLoss)} • ${formatPercent(
                                assetClass.todayGainLossPercent
                              )}`}
                        </td>
                        <td className="px-3 py-3">{formatPercent(assetClass.allocationPercent)}</td>
                        <td className="px-3 py-3">
                          <Link className="font-medium text-[#173d7a] hover:text-[#123466]" href={assetClass.actionHref}>
                            View {assetClass.label}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
              <DashboardGoalsSummarySection
                formatCurrency={(value) => formatter.format(value)}
                formatPercent={formatPercent}
                goalsSummary={data.goalsSummary}
              />

              <DashboardRecentActivity
                activity={data.recentActivity}
                formatCurrency={(value) => formatter.format(value)}
                formatDate={formatDate}
              />
            </div>
          </>
        )}
      </section>

      {isInsightsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08101f]/55 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#dde5f1] bg-white p-6 shadow-[0_28px_80px_rgba(8,16,31,0.35)]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-[#132842]">Insights & Alerts</h3>
                <p className="mt-1 text-sm text-[#6d7d97]">
                  {data.insights.length} notification{data.insights.length === 1 ? "" : "s"} available
                </p>
              </div>
              <button
                className="rounded-full border border-[#d8e1ef] p-2 text-[#566883]"
                onClick={() => setIsInsightsOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {data.insights.length ? (
                data.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      insight.tone === "positive"
                        ? "bg-[#e9f7ef] text-[#0f7a56]"
                        : insight.tone === "warning"
                          ? "bg-[#fff8eb] text-[#8a6120]"
                          : insight.tone === "negative"
                            ? "bg-[#fff1f1] text-[#b23434]"
                            : "bg-[#f8fbff] text-[#51627d]"
                    }`}
                  >
                    <p className="font-semibold">{insight.title}</p>
                    <p className="mt-1">{insight.message}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-12 text-center text-sm text-[#72829a]">
                  No alerts right now.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeroSparkline({ history }: { history: DashboardHistoryPoint[] }) {
  const points = history.slice(-42).map((point) => point.totalValue);
  const path = createSparklinePath(points, 420, 132);

  return (
    <div className="flex min-h-[10rem] items-end">
      <svg
        aria-hidden="true"
        className="h-40 w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 420 160"
      >
        <defs>
          <linearGradient id="heroSparklineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line stroke="#cbd5e1" strokeDasharray="4 4" x1="0" x2="420" y1="142" y2="142" />
        {path ? (
          <>
            <path d={`${path} L 420 142 L 0 142 Z`} fill="url(#heroSparklineFill)" />
            <path d={path} fill="none" stroke="#2563eb" strokeLinecap="round" strokeWidth="3" />
          </>
        ) : (
          <path d="M0 142 L420 142" fill="none" stroke="#cbd5e1" strokeDasharray="5 5" />
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
      const y = 16 + (1 - (value - min) / range) * height;

      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
