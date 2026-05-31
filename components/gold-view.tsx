"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps, TooltipContentProps } from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Minus,
  Plus,
  RefreshCw,
  Wallet,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { GOLD_INVESTMENT_OPTIONS } from "@/lib/gold.types";
import type {
  GoldActivitySummary,
  GoldDashboardData,
  GoldHoldingSummary,
  GoldRecentActivityPage,
} from "@/lib/gold.types";

type GoldViewProps = {
  currencyCode: string;
  initialData: GoldDashboardData;
};

type BuyGoldValues = {
  date: string;
  investmentOption: string;
  schemeName: string;
  investedAmount: string;
  currentValue: string;
};

type SellGoldValues = {
  date: string;
  holdingId: string;
  sellAmount: string;
};

type ValuationGoldValues = {
  date: string;
  holdingId: string;
  currentValue: string;
};

const GOLD_CHART_COLORS = [
  "#d97706",
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#8b5cf6",
];
const RADIAN = Math.PI / 180;

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  return value >= 0 ? formatter.format(value) : `(${formatter.format(Math.abs(value))})`;
}

function formatSignedPercent(value: number) {
  return value >= 0 ? `${value.toFixed(1)}%` : `(${Math.abs(value).toFixed(1)}%)`;
}

function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (!percent || percent < 0.04 || typeof midAngle !== "number") {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={13}
      fontWeight={700}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {`${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`}
    </text>
  );
}

export function GoldView({ currencyCode, initialData }: GoldViewProps) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<"buy" | "sell" | "valuation" | null>(
    null
  );
  const [activityState, setActivityState] = useState<GoldRecentActivityPage | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const distributionData = useMemo(
    () =>
      initialData.optionDistribution.map((entry, index) => ({
        ...entry,
        color: GOLD_CHART_COLORS[index % GOLD_CHART_COLORS.length],
      })),
    [initialData.optionDistribution]
  );
  const trendData = initialData.months;
  const activity = activityState ?? initialData.recentActivity;
  const hasActivityInteraction = activityState !== null;
  const profitUp = initialData.totalProfitLossAmount >= 0;
  const monthTrendUp = initialData.monthOverMonthChangeAmount >= 0;
  const defaultHoldingId = initialData.holdings[0]?.id || "";
  const {
    register: registerBuy,
    handleSubmit: handleBuySubmit,
    reset: resetBuy,
    formState: { errors: buyErrors, isSubmitting: isBuySubmitting },
  } = useForm<BuyGoldValues>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      investmentOption: GOLD_INVESTMENT_OPTIONS[0].value,
      schemeName: "",
      investedAmount: "",
      currentValue: "",
    },
  });
  const {
    register: registerSell,
    handleSubmit: handleSellSubmit,
    reset: resetSell,
    formState: { errors: sellErrors, isSubmitting: isSellSubmitting },
  } = useForm<SellGoldValues>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      holdingId: defaultHoldingId,
      sellAmount: "",
    },
  });
  const {
    register: registerValuation,
    handleSubmit: handleValuationSubmit,
    reset: resetValuation,
    formState: { errors: valuationErrors, isSubmitting: isValuationSubmitting },
  } = useForm<ValuationGoldValues>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      holdingId: defaultHoldingId,
      currentValue: "",
    },
  });

  useEffect(() => {
    if (!hasActivityInteraction) {
      return;
    }

    const controller = new AbortController();

    async function loadActivity() {
      setIsActivityLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(activity.page),
          pageSize: "10",
        });
        const response = await fetch(`/api/gold?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { activity?: GoldRecentActivityPage; message?: string }
          | null;

        if (!response.ok || !result?.activity) {
          throw new Error(result?.message || "Unable to load gold activity.");
        }

        setActivityState(result.activity);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        toast.error(error instanceof Error ? error.message : "Unable to load gold activity.");
      } finally {
        if (!controller.signal.aborted) {
          setIsActivityLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      controller.abort();
    };
  }, [activity.page, hasActivityInteraction]);

  function closeModal() {
    setActiveModal(null);
    resetBuy({
      date: new Date().toISOString().slice(0, 10),
      investmentOption: GOLD_INVESTMENT_OPTIONS[0].value,
      schemeName: "",
      investedAmount: "",
      currentValue: "",
    });
    resetSell({
      date: new Date().toISOString().slice(0, 10),
      holdingId: defaultHoldingId,
      sellAmount: "",
    });
    resetValuation({
      date: new Date().toISOString().slice(0, 10),
      holdingId: defaultHoldingId,
      currentValue: "",
    });
  }

  async function saveGoldTransaction(payload: Record<string, unknown>) {
    const response = await fetch("/api/gold", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      throw new Error(result?.message || "Unable to save gold transaction.");
    }

    toast.success(result?.message || "Gold transaction saved.");
    closeModal();
    setActivityState(null);
    startTransition(() => {
      router.refresh();
    });
  }

  async function onBuy(values: BuyGoldValues) {
    try {
      await saveGoldTransaction({
        transactionType: "buy",
        investmentOption: values.investmentOption,
        schemeName: values.schemeName,
        investedAmount: Number(values.investedAmount),
        currentValue: Number(values.currentValue),
        date: values.date,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save gold purchase.");
    }
  }

  async function onSell(values: SellGoldValues) {
    const holding = initialData.holdings.find((entry) => entry.id === values.holdingId);
    const sellAmount = Number(values.sellAmount);

    if (!holding) {
      toast.error("Please choose an active gold holding to sell.");
      return;
    }

    if (sellAmount > holding.currentValue) {
      toast.error("Sell amount cannot exceed the holding current value.");
      return;
    }

    try {
      await saveGoldTransaction({
        transactionType: "sell",
        investmentOption: holding.investmentOption,
        schemeName: holding.schemeName,
        sellAmount,
        date: values.date,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save gold sale.");
    }
  }

  async function onValuation(values: ValuationGoldValues) {
    const holding = initialData.holdings.find((entry) => entry.id === values.holdingId);

    if (!holding) {
      toast.error("Please choose an active gold holding to update.");
      return;
    }

    try {
      await saveGoldTransaction({
        transactionType: "valuation",
        investmentOption: holding.investmentOption,
        schemeName: holding.schemeName,
        currentValue: Number(values.currentValue),
        date: values.date,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update gold value.");
    }
  }

  const activityRangeStart = activity.totalCount ? (activity.page - 1) * activity.pageSize + 1 : 0;
  const activityRangeEnd = activity.totalCount
    ? activityRangeStart + activity.entries.length - 1
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
          <section className="min-w-0 rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Gold Portfolio Value</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.35rem]">
                  {formatter.format(initialData.totalCurrentValue)}
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Invested value: {formatter.format(initialData.totalInvestedAmount)}
                </p>
                <div
                  className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                    monthTrendUp
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {monthTrendUp ? (
                    <ArrowUpRight className="size-4" />
                  ) : (
                    <ArrowDownRight className="size-4" />
                  )}
                  <span>
                    {monthTrendUp ? "+" : ""}
                    {initialData.monthOverMonthChangePct.toFixed(1)}%
                  </span>
                  <span className="text-current/70">vs last month</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  onClick={() => setActiveModal("buy")}
                  type="button"
                >
                  <Plus className="size-4" />
                  <span>Buy Gold</span>
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!initialData.holdings.length}
                  onClick={() => setActiveModal("sell")}
                  type="button"
                >
                  <Minus className="size-4" />
                  <span>Sell Gold</span>
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!initialData.holdings.length}
                  onClick={() => setActiveModal("valuation")}
                  type="button"
                >
                  <RefreshCw className="size-4" />
                  <span>Update Value</span>
                </button>
              </div>
            </div>
          </section>

          <SummaryCard
            icon={<Wallet className="size-5 text-neutral-950" />}
            subtitle="Total Invested"
            title={formatter.format(initialData.totalInvestedAmount)}
            tone="neutral"
          />

          <SummaryCard
            icon={<Coins className="size-5 text-neutral-950" />}
            subtitle={profitUp ? "Total Profit" : "Total Loss"}
            title={formatSignedCurrency(initialData.totalProfitLossAmount, formatter)}
            detail={`${formatSignedPercent(initialData.totalProfitLossPct)} overall`}
            tone={profitUp ? "positive" : "negative"}
          />
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Gold Distribution
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Current value split across gold investment options.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.75rem] border border-[#eef2f7] bg-[#fafaf8] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950">Option Split</h4>
                  <p className="mt-1 text-sm text-neutral-500">Allocation by gold type.</p>
                </div>
              </div>

              {distributionData.length ? (
                <>
                  <div className="h-[18rem] rounded-[1.25rem] bg-white p-3 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          cx="50%"
                          cy="50%"
                          data={distributionData}
                          dataKey="currentValue"
                          endAngle={-270}
                          label={renderPieLabel}
                          labelLine={false}
                          nameKey="investmentOptionLabel"
                          outerRadius="86%"
                          paddingAngle={distributionData.length > 1 ? 1 : 0}
                          startAngle={90}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {distributionData.map((entry) => (
                            <Cell key={entry.investmentOption} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={(props) => (
                            <GoldDistributionTooltip
                              {...(props as TooltipContentProps)}
                              currencyFormatter={formatter}
                            />
                          )}
                          cursor={false}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                    {distributionData.map((entry) => (
                      <div key={entry.investmentOption} className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs font-medium text-neutral-600">
                          {entry.investmentOptionLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[18rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#dbe2ee] bg-white text-sm text-neutral-500">
                  No gold holdings yet.
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-[#eef2f7] bg-[#fafaf8] p-5">
              <div className="mb-4">
                <h4 className="text-base font-semibold text-neutral-950">6-Month Value Trend</h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Invested amount and current value over time.
                </p>
              </div>
              <div className="h-[22rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ left: 8, right: 10, top: 10 }}>
                    <defs>
                      <linearGradient id="goldValueFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--wc-chart-grid)" strokeDasharray="4 6" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                      tickFormatter={(value) => compactCurrency(Number(value), formatter)}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => (
                        <GoldTrendTooltip
                          {...(props as TooltipContentProps)}
                          currencyFormatter={formatter}
                        />
                      )}
                    />
                    <Area
                      dataKey="totalValue"
                      fill="url(#goldValueFill)"
                      name="Current Value"
                      stroke="#d97706"
                      strokeWidth={3}
                      type="monotone"
                    />
                    <Area
                      dataKey="totalInvested"
                      fill="transparent"
                      name="Invested"
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Active Holdings
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Current value, invested value, and profit for each gold holding.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#eef2f7]">
            {initialData.holdings.length ? (
              <table className="min-w-full text-left">
                <thead className="bg-[#fafaf8] text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Holding</th>
                    <th className="px-4 py-3">Option</th>
                    <th className="px-4 py-3">Invested</th>
                    <th className="px-4 py-3">Current Value</th>
                    <th className="px-4 py-3">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f7] bg-white">
                  {initialData.holdings.map((holding) => (
                    <tr key={holding.id} className="text-sm text-neutral-700">
                      <td className="max-w-xs px-4 py-3 font-medium text-neutral-950">
                        <span className="block truncate">{holding.schemeName}</span>
                      </td>
                      <td className="px-4 py-3">{holding.investmentOptionLabel}</td>
                      <td className="px-4 py-3">{formatter.format(holding.investedAmount)}</td>
                      <td className="px-4 py-3 font-medium text-neutral-950">
                        {formatter.format(holding.currentValue)}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          holding.profitLossAmount >= 0
                            ? "text-emerald-600"
                            : "text-rose-600"
                        }`}
                      >
                        {formatSignedCurrency(holding.profitLossAmount, formatter)} •{" "}
                        {formatSignedPercent(holding.profitLossPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bg-[#fafaf8] px-5 py-10 text-center text-sm text-neutral-500">
                No active gold holdings yet.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Recent Activity
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Latest gold buys, sells, and valuation updates.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
            <p>
              {activity.totalCount
                ? `Showing ${activityRangeStart}-${activityRangeEnd} of ${activity.totalCount} entries`
                : "No entries to show"}
            </p>
            {isActivityLoading || isPending ? <p>Refreshing...</p> : null}
          </div>

          <div className="mt-5 grid gap-3">
            {activity.entries.length ? (
              activity.entries.map((entry) => {
                const tone =
                  entry.transactionType === "buy"
                    ? "text-emerald-600"
                    : entry.transactionType === "sell"
                      ? "text-rose-600"
                      : "text-amber-700";

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-4 rounded-[1.4rem] border border-[#eef2f7] bg-[#fafaf8] px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-950">
                        {entry.schemeName}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {entry.investmentOptionLabel} ·{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(entry.date))}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${tone}`}>
                        {formatActivityAmount(entry, formatter)}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                        {entry.transactionType}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#d9dfeb] bg-[#fafaf8] px-5 py-10 text-center text-sm text-neutral-500">
                No gold activity yet.
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              className="rounded-[1rem] border border-[#dbe2ee] px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activity.page <= 1 || isActivityLoading}
              onClick={() => {
                setActivityState({
                  ...activity,
                  page: Math.max(1, activity.page - 1),
                });
              }}
              type="button"
            >
              Previous
            </button>
            <p className="min-w-[7rem] text-center text-sm font-medium text-neutral-600">
              Page {activity.page} of {activity.totalPages}
            </p>
            <button
              className="rounded-[1rem] border border-[#111111] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activity.page >= activity.totalPages || isActivityLoading}
              onClick={() => {
                setActivityState({
                  ...activity,
                  page: Math.min(activity.totalPages, activity.page + 1),
                });
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      {activeModal === "buy" ? (
        <ModalFrame title="Buy Gold" onClose={closeModal}>
          <form className="mt-6 space-y-5" onSubmit={handleBuySubmit(onBuy)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800">Investment Option</span>
              <select
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                {...registerBuy("investmentOption", {
                  required: "Investment option is required.",
                })}
              >
                {GOLD_INVESTMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {buyErrors.investmentOption ? (
                <span className="text-sm text-destructive">
                  {buyErrors.investmentOption.message}
                </span>
              ) : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800">
                Fund, Scheme, or Asset Name
              </span>
              <input
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                placeholder="SGB 2026-27 Series II"
                {...registerBuy("schemeName", {
                  required: "Fund or scheme name is required.",
                  maxLength: {
                    value: 220,
                    message: "Name must be 220 characters or fewer.",
                  },
                })}
              />
              {buyErrors.schemeName ? (
                <span className="text-sm text-destructive">{buyErrors.schemeName.message}</span>
              ) : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <AmountInput
                error={buyErrors.investedAmount?.message}
                label="Invested Amount"
                placeholder="50000"
                register={registerBuy("investedAmount", {
                  required: "Invested amount is required.",
                  validate: (value) =>
                    Number(value) > 0 || "Invested amount must be greater than zero.",
                })}
              />
              <AmountInput
                error={buyErrors.currentValue?.message}
                label="Current Value"
                placeholder="52000"
                register={registerBuy("currentValue", {
                  required: "Current value is required.",
                  validate: (value) =>
                    Number(value) > 0 || "Current value must be greater than zero.",
                })}
              />
            </div>

            <DateInput
              error={buyErrors.date?.message}
              label="Purchase Date"
              register={registerBuy("date", {
                required: "Date is required.",
              })}
            />

            <ModalActions
              isSubmitting={isBuySubmitting || isPending}
              onCancel={closeModal}
              submitLabel="Save Buy"
            />
          </form>
        </ModalFrame>
      ) : null}

      {activeModal === "sell" ? (
        <ModalFrame title="Sell Gold" onClose={closeModal}>
          <form className="mt-6 space-y-5" onSubmit={handleSellSubmit(onSell)}>
            <HoldingSelect
              error={sellErrors.holdingId?.message}
              holdings={initialData.holdings}
              register={registerSell("holdingId", {
                required: "Please choose a holding.",
              })}
            />
            <AmountInput
              error={sellErrors.sellAmount?.message}
              label="Sell Amount"
              placeholder="10000"
              register={registerSell("sellAmount", {
                required: "Sell amount is required.",
                validate: (value) =>
                  Number(value) > 0 || "Sell amount must be greater than zero.",
              })}
            />
            <DateInput
              error={sellErrors.date?.message}
              label="Sell Date"
              register={registerSell("date", {
                required: "Date is required.",
              })}
            />
            <ModalActions
              isSubmitting={isSellSubmitting || isPending}
              onCancel={closeModal}
              submitLabel="Save Sell"
            />
          </form>
        </ModalFrame>
      ) : null}

      {activeModal === "valuation" ? (
        <ModalFrame title="Update Gold Value" onClose={closeModal}>
          <form className="mt-6 space-y-5" onSubmit={handleValuationSubmit(onValuation)}>
            <HoldingSelect
              error={valuationErrors.holdingId?.message}
              holdings={initialData.holdings}
              register={registerValuation("holdingId", {
                required: "Please choose a holding.",
              })}
            />
            <AmountInput
              error={valuationErrors.currentValue?.message}
              label="New Current Value"
              placeholder="56000"
              register={registerValuation("currentValue", {
                required: "Current value is required.",
                validate: (value) =>
                  Number(value) > 0 || "Current value must be greater than zero.",
              })}
            />
            <DateInput
              error={valuationErrors.date?.message}
              label="Valuation Date"
              register={registerValuation("date", {
                required: "Date is required.",
              })}
            />
            <ModalActions
              isSubmitting={isValuationSubmitting || isPending}
              onCancel={closeModal}
              submitLabel="Update Value"
            />
          </form>
        </ModalFrame>
      ) : null}
    </div>
  );
}

function AmountInput({
  error,
  label,
  placeholder,
  register,
}: {
  error?: string;
  label: string;
  placeholder: string;
  register: Record<string, unknown>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <input
        className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
        placeholder={placeholder}
        step="0.01"
        type="number"
        {...register}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function DateInput({
  error,
  label,
  register,
}: {
  error?: string;
  label: string;
  register: Record<string, unknown>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <input
        className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
        max={new Date().toISOString().slice(0, 10)}
        type="date"
        {...register}
      />
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function HoldingSelect({
  error,
  holdings,
  register,
}: {
  error?: string;
  holdings: GoldHoldingSummary[];
  register: Record<string, unknown>;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-neutral-800">Gold Holding</span>
      <select
        className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
        {...register}
      >
        {holdings.map((holding) => (
          <option key={holding.id} value={holding.id}>
            {holding.schemeName} · {holding.investmentOptionLabel}
          </option>
        ))}
      </select>
      {error ? <span className="text-sm text-destructive">{error}</span> : null}
    </label>
  );
}

function ModalFrame({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <div className="max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h3>
          </div>
          <button
            aria-label="Close modal"
            className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  isSubmitting,
  onCancel,
  submitLabel,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        className="rounded-[1rem] border border-[#dbe2ee] px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        onClick={onCancel}
        type="button"
      >
        Cancel
      </button>
      <button
        className="rounded-[1rem] bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function SummaryCard({
  detail,
  icon,
  subtitle,
  title,
  tone,
}: {
  detail?: string;
  icon: React.ReactNode;
  subtitle: string;
  title: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "negative"
        ? "bg-rose-50 text-rose-700"
        : "bg-[#f7f7f5] text-neutral-600";
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-neutral-950";
  const detailClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-neutral-500";

  return (
    <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
      <div className={`mb-5 inline-flex rounded-2xl p-3 ${toneClass}`}>{icon}</div>
      <p className="text-sm font-medium text-neutral-500">{subtitle}</p>
      <h3 className={`mt-2 text-2xl font-semibold tracking-tight ${valueClass}`}>{title}</h3>
      {detail ? <p className={`mt-2 text-sm font-medium ${detailClass}`}>{detail}</p> : null}
    </section>
  );
}

function GoldDistributionTooltip({
  active,
  payload,
  currencyFormatter,
}: TooltipContentProps & {
  currencyFormatter: Intl.NumberFormat;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const entry = payload[0]?.payload as
    | {
        investmentOptionLabel?: string;
        currentValue?: number;
        percentage?: number;
      }
    | undefined;

  if (!entry) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#e6ebf2] bg-white px-3.5 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
      <p className="text-sm font-semibold text-neutral-950">
        {entry.investmentOptionLabel || "Gold"}
      </p>
      <p className="mt-1 text-sm text-neutral-500">
        {currencyFormatter.format(entry.currentValue || 0)} ·{" "}
        {(entry.percentage || 0).toFixed(1)}%
      </p>
    </div>
  );
}

function GoldTrendTooltip({
  active,
  payload,
  label,
  currencyFormatter,
}: TooltipContentProps & {
  currencyFormatter: Intl.NumberFormat;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#e6ebf2] bg-white px-3.5 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
      <p className="text-sm font-semibold text-neutral-950">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div
            className="flex min-w-[11rem] items-center justify-between gap-4 text-sm"
            key={String(item.dataKey)}
          >
            <span className="text-neutral-500">{item.name}</span>
            <span className="font-semibold text-neutral-950">
              {currencyFormatter.format(Number(item.value) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatActivityAmount(entry: GoldActivitySummary, formatter: Intl.NumberFormat) {
  if (entry.transactionType === "buy") {
    return `+${formatter.format(entry.currentValue || entry.investedAmount || 0)}`;
  }

  if (entry.transactionType === "sell") {
    return `-${formatter.format(entry.sellAmount || 0)}`;
  }

  return formatter.format(entry.currentValue || 0);
}

function createCurrencyFormatter(currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 2,
    });
  } catch {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 2,
    });
  }
}

function compactCurrency(value: number, formatter: Intl.NumberFormat) {
  if (Math.abs(value) >= 100000) {
    return `${Math.round(value / 1000)}k`;
  }

  const parts = formatter.formatToParts(value);
  const currency = parts.find((part) => part.type === "currency")?.value || "";

  return `${currency}${Math.round(value)}`;
}
