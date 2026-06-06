"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
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
  Landmark,
  Minus,
  PieChart as PieChartIcon,
  Plus,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { AsyncTypeahead, Highlighter } from "react-bootstrap-typeahead";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import {
  MarketSyncBatchReview,
  type MarketSyncBatchSummary,
} from "@/components/market-sync-batch-review";
import { MutualFundsHoldingsTable } from "@/components/mutual-funds-holdings-table";
import type {
  MutualFundDashboardData,
  MutualFundNavHistory,
  MutualFundOptionSummary,
  MutualFundTransactionType,
} from "@/lib/mutual-funds.types";

type MutualFundsViewProps = {
  currencyCode: string;
  initialData: MutualFundDashboardData;
};

type MfSchemeOption = MutualFundOptionSummary;

type BuyMfValues = {
  previousSchemeCode: string;
  units: string;
  nav: string;
  date: string;
};

type SellMfValues = {
  schemeCode: string;
  units: string;
  nav: string;
  date: string;
};

const DISTRIBUTION_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#f97316",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#64748b",
];

const RADIAN = Math.PI / 180;
const TRANSACTIONS_PAGE_SIZE = 5;

function renderDistributionLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (!percent || percent < 0.035 || typeof midAngle !== "number") {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const label = `${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`;

  return (
    <text
      dominantBaseline="central"
      fill="#ffffff"
      fontSize={14}
      fontWeight={700}
      textAnchor="middle"
      x={x}
      y={y}
    >
      {label}
    </text>
  );
}

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  return value >= 0 ? formatter.format(value) : `(${formatter.format(Math.abs(value))})`;
}

function formatSignedPercent(value: number) {
  return value >= 0 ? `${value.toFixed(1)}%` : `(${Math.abs(value).toFixed(1)}%)`;
}

export function MutualFundsView({
  currencyCode,
  initialData,
}: MutualFundsViewProps) {
  const [data, setData] = useState(initialData);
  const [activeModal, setActiveModal] = useState<"buy" | "sell" | null>(null);
  const [marketSyncBatch, setMarketSyncBatch] = useState<MarketSyncBatchSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const [fundSearchOptions, setFundSearchOptions] = useState<MfSchemeOption[]>([]);
  const [isSearchingFunds, setIsSearchingFunds] = useState(false);
  const [selectedBuyFund, setSelectedBuyFund] = useState<MfSchemeOption[]>([]);
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const firstHolding = data.holdings[0];
  const [selectedBuySchemeCode, setSelectedBuySchemeCode] = useState("");
  const [selectedSellSchemeCode, setSelectedSellSchemeCode] = useState(
    firstHolding ? String(firstHolding.schemeCode) : ""
  );
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [latestModalNav, setLatestModalNav] = useState<number | null>(null);
  const [isLatestModalNavLoading, setIsLatestModalNavLoading] = useState(false);
  const [latestModalNavError, setLatestModalNavError] = useState<string | null>(null);
  const [selectedHistorySchemeCode, setSelectedHistorySchemeCode] = useState(
    firstHolding ? String(firstHolding.schemeCode) : ""
  );
  const [selectedFundHistory, setSelectedFundHistory] = useState<MutualFundNavHistory | null>(
    null
  );
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const monthTrendUp = data.monthOverMonthChangeAmount >= 0;
  const overallProfitUp = data.totalProfitLossAmount >= 0;
  const realizedProfitUp = data.totalRealizedProfitAmount >= 0;
  const chartData = data.months;
  const distributionData = useMemo(
    () =>
      data.distribution.map((holding, index) => ({
        ...holding,
        color: DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length],
      })),
    [data.distribution]
  );
  const visibleDistributionData = distributionData.slice(0, 8);
  const hiddenDistributionCount = Math.max(distributionData.length - 8, 0);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const topHolding = distributionData[0];
  const effectiveSelectedHistorySchemeCode = data.holdings.some(
    (holding) => String(holding.schemeCode) === selectedHistorySchemeCode
  )
    ? selectedHistorySchemeCode
    : firstHolding
      ? String(firstHolding.schemeCode)
      : "";
  const selectedHolding =
    data.holdings.find(
      (holding) => String(holding.schemeCode) === effectiveSelectedHistorySchemeCode
    ) || firstHolding;
  const totalTransactionPages = Math.max(
    1,
    Math.ceil(data.recentTransactions.length / TRANSACTIONS_PAGE_SIZE)
  );
  const currentTransactionsPage = Math.min(transactionsPage, totalTransactionPages);
  const paginatedTransactions = data.recentTransactions.slice(
    (currentTransactionsPage - 1) * TRANSACTIONS_PAGE_SIZE,
    currentTransactionsPage * TRANSACTIONS_PAGE_SIZE
  );
  const {
    register: registerBuy,
    handleSubmit: handleBuySubmit,
    reset: resetBuy,
    setValue: setBuyValue,
    clearErrors: clearBuyErrors,
    formState: { errors: buyErrors, isSubmitting: isBuySubmitting },
  } = useForm<BuyMfValues>({
    defaultValues: {
      previousSchemeCode: "",
      units: "",
      nav: "",
      date: new Date().toISOString().slice(0, 10),
    },
  });
  const {
    register: registerSell,
    handleSubmit: handleSellSubmit,
    reset: resetSell,
    setValue: setSellValue,
    formState: { errors: sellErrors, isSubmitting: isSellSubmitting },
  } = useForm<SellMfValues>({
    defaultValues: {
      schemeCode: firstHolding ? String(firstHolding.schemeCode) : "",
      units: "",
      nav: firstHolding ? String(firstHolding.currentNav) : "",
      date: new Date().toISOString().slice(0, 10),
    },
  });

  useEffect(() => {
    if (!effectiveSelectedHistorySchemeCode || !selectedHolding) {
      return;
    }

    const controller = new AbortController();

    async function loadFundHistory() {
      setIsHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch(
          `/api/mutual-funds/history?schemeCode=${encodeURIComponent(
            effectiveSelectedHistorySchemeCode
          )}&schemeName=${encodeURIComponent(selectedHolding.schemeName)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = (await response.json().catch(() => null)) as
          | { history?: MutualFundNavHistory; message?: string }
          | null;

        if (!response.ok || !result?.history) {
          throw new Error(result?.message || "Unable to load fund movement history.");
        }

        setSelectedFundHistory(result.history);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSelectedFundHistory(null);
        setHistoryError(
          error instanceof Error ? error.message : "Unable to load fund movement history."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsHistoryLoading(false);
        }
      }
    }

    void loadFundHistory();

    return () => {
      controller.abort();
    };
  }, [effectiveSelectedHistorySchemeCode, selectedHolding]);

  useEffect(() => {
    const selectedSchemeCode =
      activeModal === "buy"
        ? selectedBuySchemeCode
        : activeModal === "sell"
          ? selectedSellSchemeCode
          : "";

    if (!activeModal || !selectedSchemeCode) {
      return;
    }

    const controller = new AbortController();

    async function loadLatestNav() {
      try {
        const response = await fetch(
          `/api/mutual-funds/latest-nav?schemeCode=${encodeURIComponent(selectedSchemeCode)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = (await response.json().catch(() => null)) as
          | { latestNav?: number; message?: string }
          | null;

        if (!response.ok || typeof result?.latestNav !== "number") {
          throw new Error(result?.message || "Unable to load the latest NAV right now.");
        }

        setLatestModalNav(result.latestNav);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLatestModalNav(null);
        setLatestModalNavError(
          error instanceof Error ? error.message : "Unable to load the latest NAV right now."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLatestModalNavLoading(false);
        }
      }
    }

    void loadLatestNav();

    return () => {
      controller.abort();
    };
  }, [activeModal, selectedBuySchemeCode, selectedSellSchemeCode]);

  async function handleFundSearch(query: string) {
    if (!query.trim()) {
      setFundSearchOptions([]);
      return;
    }

    setIsSearchingFunds(true);

    try {
      const response = await fetch(
        `/api/mutual-funds/search?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => null)) as
        | { options?: MfSchemeOption[]; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to search mutual funds.");
      }

      setFundSearchOptions(result?.options || []);
    } catch (error) {
      setFundSearchOptions([]);
      toast.error(error instanceof Error ? error.message : "Unable to search mutual funds.");
    } finally {
      setIsSearchingFunds(false);
    }
  }

  function closeModal() {
    setActiveModal(null);
    setFundSearchOptions([]);
    setSelectedBuyFund([]);
    setSelectedBuySchemeCode("");
    setSelectedSellSchemeCode(firstHolding ? String(firstHolding.schemeCode) : "");
    setLatestModalNav(null);
    setLatestModalNavError(null);
    setIsLatestModalNavLoading(false);
    resetBuy({
      previousSchemeCode: "",
      units: "",
      nav: "",
      date: new Date().toISOString().slice(0, 10),
    });
    resetSell({
      schemeCode: firstHolding ? String(firstHolding.schemeCode) : "",
      units: "",
      nav: firstHolding ? String(firstHolding.currentNav) : "",
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async function saveTransaction(payload: {
    schemeCode: number;
    schemeName: string;
    transactionType: MutualFundTransactionType;
    units: number;
    nav: number;
    date: string;
  }) {
    const response = await fetch("/api/mutual-funds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as
      | { message?: string; dashboard?: MutualFundDashboardData }
      | null;

    if (!response.ok) {
      throw new Error(result?.message || "Unable to save mutual fund transaction.");
    }

    toast.success(
      result?.message ||
        (payload.transactionType === "buy"
          ? "Mutual fund purchase saved."
          : "Mutual fund sale saved.")
    );

    if (result?.dashboard) {
      setData(result.dashboard);
    }
    closeModal();
  }

  async function reloadDashboard() {
    const response = await fetch("/api/mutual-funds", { cache: "no-store" });
    const result = (await response.json().catch(() => null)) as
      | { dashboard?: MutualFundDashboardData; message?: string }
      | null;

    if (!response.ok || !result?.dashboard) {
      throw new Error(result?.message || "Unable to reload mutual funds.");
    }

    setData(result.dashboard);
  }

  function handleRefreshNavs() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/market-sync/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetType: "mutual_fund" }),
        });
        const result = (await response.json().catch(() => null)) as
          | { batch?: MarketSyncBatchSummary; message?: string }
          | null;

        if (!response.ok || !result?.batch) {
          throw new Error(result?.message || "Unable to refresh mutual fund NAVs.");
        }

        setMarketSyncBatch(result.batch);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to refresh mutual fund NAVs.");
      }
    });
  }

  async function onBuy(values: BuyMfValues) {
    const previousFund = values.previousSchemeCode
      ? data.previousFunds.find(
          (item) => String(item.schemeCode) === values.previousSchemeCode
        )
      : null;
    const fund = previousFund || selectedBuyFund[0];

    if (!fund) {
      toast.error("Please select a previous fund or search for a mutual fund.");
      return;
    }

    try {
      await saveTransaction({
        transactionType: "buy",
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        units: Number(values.units),
        nav: Number(values.nav),
        date: values.date,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to save mutual fund purchase."
      );
    }
  }

  async function onSell(values: SellMfValues) {
    const holding = data.holdings.find(
      (item) => String(item.schemeCode) === values.schemeCode
    );

    if (!holding) {
      toast.error("Please choose a fund to sell.");
      return;
    }

    try {
      await saveTransaction({
        transactionType: "sell",
        schemeCode: holding.schemeCode,
        schemeName: holding.schemeName,
        units: Number(values.units),
        nav: Number(values.nav),
        date: values.date,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save mutual fund sale."
      );
    }
  }

  const previousBuyFundField = registerBuy("previousSchemeCode", {
    validate: (value) =>
      value || selectedBuyFund.length
        ? true
        : "Select a previous fund or search for a mutual fund.",
  });
  const sellSchemeField = registerSell("schemeCode", {
    required: "Please choose a fund.",
  });

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">Current Portfolio Value</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.35rem]">
                  {formatter.format(data.totalPortfolioValue)}
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  Invested value: {formatter.format(data.totalInvestedAmount)}
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
                    {data.monthOverMonthChangePct.toFixed(1)}%
                  </span>
                  <span className="text-current/70">vs last month</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending}
                  onClick={handleRefreshNavs}
                  type="button"
                >
                  <RefreshCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
                  <span>Refresh NAVs</span>
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                  onClick={() => {
                    setLatestModalNav(null);
                    setLatestModalNavError(null);
                    setIsLatestModalNavLoading(false);
                    setActiveModal("buy");
                  }}
                  type="button"
                >
                  <Plus className="size-4" />
                  <span>Buy Units</span>
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!data.holdings.length}
                  onClick={() => {
                    setSelectedSellSchemeCode(firstHolding ? String(firstHolding.schemeCode) : "");
                    setLatestModalNav(null);
                    setLatestModalNavError(null);
                    setIsLatestModalNavLoading(Boolean(firstHolding));
                    setActiveModal("sell");
                  }}
                  type="button"
                >
                  <Minus className="size-4" />
                  <span>Sell Units</span>
                </button>
              </div>
            </div>
          </section>

          <SummaryCard
            icon={<Landmark className="size-5 text-neutral-950" />}
            subtitle={`Realized ${realizedProfitUp ? "Profit" : "Loss"}`}
            title={formatSignedCurrency(data.totalRealizedProfitAmount, formatter)}
            tone={realizedProfitUp ? "positive" : "negative"}
            detail={`${formatSignedPercent(data.totalRealizedProfitPct)} booked`}
          />

          <SummaryCard
            icon={<Wallet className="size-5 text-neutral-950" />}
            subtitle={`Unrealized ${overallProfitUp ? "Profit" : "Loss"}`}
            title={formatSignedCurrency(data.totalProfitLossAmount, formatter)}
            tone={overallProfitUp ? "positive" : "negative"}
            detail={`${formatSignedPercent(data.totalProfitLossPct)} overall`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                  Monthly Portfolio Trend
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Portfolio value and invested capital across the last 6 months.
                </p>
              </div>
            </div>

            <div className="mt-6 h-[21rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mfPortfolioFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="mfInvestedFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--wc-chart-grid)" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                    tickFormatter={(value) => compactCurrency(Number(value) || 0, formatter)}
                    tickLine={false}
                    width={74}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--wc-tooltip-bg)",
                      border: "1px solid var(--wc-tooltip-border)",
                      borderRadius: "16px",
                      boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
                      color: "var(--wc-tooltip-text)",
                    }}
                    formatter={(value, name) => [
                      formatter.format(Number(value) || 0),
                      name === "totalValue" ? "Portfolio Value" : "Invested Capital",
                    ]}
                    labelStyle={{ color: "var(--wc-tooltip-text)", fontWeight: 600 }}
                  />
                  <Area
                    dataKey="totalInvested"
                    fill="url(#mfInvestedFill)"
                    fillOpacity={1}
                    stroke="#16a34a"
                    strokeWidth={2}
                    type="monotone"
                  />
                  <Area
                    dataKey="totalValue"
                    fill="url(#mfPortfolioFill)"
                    fillOpacity={1}
                    stroke="#2563eb"
                    strokeWidth={3}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                  Largest Position
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Your highest allocation from the latest monthly snapshot.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-[#eef2f7] bg-[#f8fbff] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                    <PieChartIcon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Top Holding
                    </p>
                    <p className="mt-1 text-lg font-semibold tracking-tight text-neutral-950">
                      {topHolding?.schemeName || "No holdings yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MetricChip
                    label="Current Value"
                    value={
                      topHolding
                        ? formatter.format(topHolding.currentValue)
                        : formatter.format(0)
                    }
                  />
                  <MetricChip
                    label="Invested Value"
                    value={
                      topHolding
                        ? formatter.format(topHolding.investedAmount)
                        : formatter.format(0)
                    }
                  />
                  <MetricChip
                    label="Average NAV"
                    value={topHolding ? formatter.format(topHolding.averageNav) : formatter.format(0)}
                  />
                  <MetricChip
                    label={topHolding && topHolding.profitLossAmount < 0 ? "Loss" : "Profit"}
                    value={
                      topHolding
                        ? formatSignedCurrency(topHolding.profitLossAmount, formatter)
                        : formatter.format(0)
                    }
                    tone={topHolding && topHolding.profitLossAmount < 0 ? "negative" : "positive"}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Portfolio Distribution
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Allocation on the left, 12-month NAV movement for a selected holding on the right.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[1.75rem] border border-[#eef2f7] bg-[#fafaf8] p-5">
              <div>
                <div>
                  <h4 className="text-base font-semibold text-neutral-950">Allocation Split</h4>
                  <p className="mt-1 text-sm text-neutral-500">
                    Current value spread across your active mutual fund holdings.
                  </p>
                </div>
              </div>

              {distributionData.length ? (
                <>
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleDistributionData.map((entry) => (
                      <div
                        key={entry.schemeCode}
                        className="flex min-w-0 items-center gap-2 rounded-[0.9rem] border border-[#edf1f7] bg-white/85 px-3 py-2"
                        title={entry.schemeName}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="min-w-0 truncate text-xs font-medium text-neutral-600">
                          {entry.schemeName}
                        </span>
                      </div>
                    ))}
                    {hiddenDistributionCount ? (
                      <button
                        className="flex min-w-0 items-center justify-center rounded-[0.9rem] border border-dashed border-[#d6deea] bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:border-[#111111] hover:text-neutral-950"
                        onClick={() => setIsDistributionModalOpen(true)}
                        type="button"
                      >
                        {hiddenDistributionCount} more
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 h-[22rem] rounded-[1.25rem] bg-white p-3 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          cx="50%"
                          cy="50%"
                          data={distributionData}
                          dataKey="currentValue"
                          endAngle={-270}
                          innerRadius={0}
                          isAnimationActive
                          label={renderDistributionLabel}
                          labelLine={false}
                          nameKey="schemeName"
                          outerRadius="86%"
                          paddingAngle={distributionData.length > 1 ? 1 : 0}
                          startAngle={90}
                          stroke="#ffffff"
                          strokeWidth={2}
                        >
                          {distributionData.map((entry) => (
                            <Cell key={entry.schemeCode} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="flex h-[18rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#dbe2ee] bg-white text-sm text-neutral-500">
                  No mutual fund distribution yet.
                </div>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-[#eef2f7] bg-[#fafaf8] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-neutral-950">Fund Movement</h4>
                  <p className="mt-1 text-sm text-neutral-500">
                    Last 12 months NAV trend for one bought mutual fund.
                  </p>
                </div>
                <div className="w-full sm:max-w-xs">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    Selected Fund
                  </label>
                  <select
                    className="h-[2.85rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                    disabled={!data.holdings.length}
                    onChange={(event) => setSelectedHistorySchemeCode(event.target.value)}
                    value={effectiveSelectedHistorySchemeCode}
                  >
                    {data.holdings.map((holding) => (
                      <option key={holding.schemeCode} value={holding.schemeCode}>
                        {holding.schemeName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedHolding ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <MetricChip
                      label="Current NAV"
                      value={formatter.format(selectedHolding.currentNav)}
                    />
                    <MetricChip
                      label="Current Value"
                      value={formatter.format(selectedHolding.currentValue)}
                    />
                    <MetricChip
                      label={selectedFundHistory && selectedFundHistory.changeAmount < 0 ? "12M Loss" : "12M Gain"}
                      tone={
                        selectedFundHistory
                          ? selectedFundHistory.changeAmount < 0
                            ? "negative"
                            : "positive"
                          : "neutral"
                      }
                      value={
                        selectedFundHistory
                          ? `${formatSignedCurrency(selectedFundHistory.changeAmount, formatter)} • ${formatSignedPercent(selectedFundHistory.changePct)}`
                          : "--"
                      }
                    />
                  </div>

                  <div className="mt-5 h-[18rem]">
                    {isHistoryLoading ? (
                      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[#dbe2ee] bg-white text-sm text-neutral-500">
                        Loading 12-month movement...
                      </div>
                    ) : historyError ? (
                      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[#f1d2d2] bg-white px-6 text-center text-sm text-rose-600">
                        {historyError}
                      </div>
                    ) : selectedFundHistory?.points.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={selectedFundHistory.points}
                          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid
                            stroke="var(--wc-chart-grid)"
                            strokeDasharray="4 4"
                            vertical={false}
                          />
                          <XAxis
                            axisLine={false}
                            dataKey="label"
                            tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                            tickLine={false}
                          />
                          <YAxis
                            axisLine={false}
                            tick={{ fill: "var(--wc-chart-tick)", fontSize: 12 }}
                            tickFormatter={(value) => compactCurrency(Number(value) || 0, formatter)}
                            tickLine={false}
                            width={72}
                          />
                          <Tooltip
                            content={(props) => (
                              <FundMovementTooltip
                                {...(props as TooltipContentProps)}
                                currencyFormatter={formatter}
                              />
                            )}
                            cursor={{ stroke: "#2563eb", strokeDasharray: "4 4" }}
                            wrapperStyle={{ zIndex: 20 }}
                          />
                          <Line
                            dataKey="nav"
                            dot={{ fill: "#2563eb", r: 3, strokeWidth: 0 }}
                            stroke="#2563eb"
                            strokeWidth={3}
                            type="monotone"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-[#dbe2ee] bg-white px-6 text-center text-sm text-neutral-500">
                        No 12-month movement data available for this fund yet.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-5 flex h-[22rem] items-center justify-center rounded-[1.5rem] border border-dashed border-[#dbe2ee] bg-white text-sm text-neutral-500">
                  Buy a fund first to view its 12-month movement chart.
                </div>
              )}
            </div>
          </div>
        </section>

        <MutualFundsHoldingsTable
          currencyCode={currencyCode}
          emptyMessage="No holdings yet. Add your first mutual fund purchase to start tracking."
          holdings={data.topHoldings}
          limit={5}
          showViewAll={data.holdings.length > 0}
          subtitle="Top 5 holdings ranked by current value."
          title="Top 5 Holdings"
        />

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Recent Transactions
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Latest mutual fund buy and sell activity saved in the portfolio.
              </p>
            </div>
            {data.recentTransactions.length ? (
              <p className="text-sm font-medium text-neutral-500 sm:text-right">
                Showing {(currentTransactionsPage - 1) * TRANSACTIONS_PAGE_SIZE + 1}-
                {Math.min(
                  currentTransactionsPage * TRANSACTIONS_PAGE_SIZE,
                  data.recentTransactions.length
                )}{" "}
                of {data.recentTransactions.length}
              </p>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3">
            {data.recentTransactions.length ? (
              paginatedTransactions.map((transaction) => {
                const positive = transaction.transactionType === "buy";

                return (
                  <div
                    key={transaction.id}
                    className="flex flex-col gap-3 rounded-[1.4rem] border border-[#eef2f7] bg-[#fafaf8] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-6 text-neutral-950 sm:truncate sm:text-base">
                        {transaction.schemeName}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {positive ? "Buy" : "Sell"} {transaction.units.toFixed(2)} units on{" "}
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(transaction.date))}
                      </p>
                    </div>

                    <div className="min-w-0 sm:text-right">
                      <p
                        className={`text-base font-semibold ${
                          positive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {positive ? "+" : "-"}
                        {formatter.format(transaction.amount)}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                        NAV {formatter.format(transaction.nav)}
                      </p>
                      {transaction.transactionType === "sell" &&
                      transaction.realizedProfitAmount != null ? (
                        <p
                          className={`mt-1 text-xs font-medium ${
                            transaction.realizedProfitAmount >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          Realized {formatSignedCurrency(transaction.realizedProfitAmount, formatter)}
                          {transaction.realizedProfitPct != null
                            ? ` • ${formatSignedPercent(transaction.realizedProfitPct)}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#d9dfeb] bg-[#fafaf8] px-5 py-10 text-center text-sm text-neutral-500">
                No mutual fund transactions yet. Use the buy modal to add your first entry.
              </div>
            )}
          </div>

          {data.recentTransactions.length > TRANSACTIONS_PAGE_SIZE ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#eef2f7] pt-4">
              <p className="text-sm text-neutral-500">
                Page {currentTransactionsPage} of {totalTransactionPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-xl border border-[#dbe2ee] bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentTransactionsPage === 1}
                  onClick={() => setTransactionsPage((page) => Math.max(1, page - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="rounded-xl border border-[#dbe2ee] bg-white px-3.5 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={currentTransactionsPage === totalTransactionPages}
                  onClick={() =>
                    setTransactionsPage((page) => Math.min(totalTransactionPages, page + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {activeModal === "buy" ? (
        <ModalFrame
          description="Search the mutual fund, then enter units, NAV, and purchase date."
          title="Buy Mutual Fund Units"
          onClose={closeModal}
        >
          <form className="mt-6 space-y-5" onSubmit={handleBuySubmit(onBuy)}>
            <div className="space-y-2">
              <span className="text-sm font-medium text-neutral-800">Mutual Fund</span>
              {data.previousFunds.length ? (
                <label className="block space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                    Previous Fund
                  </span>
                  <select
                    className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                    {...previousBuyFundField}
                    onChange={(event) => {
                      void previousBuyFundField.onChange(event);

                      if (!event.target.value) {
                        setLatestModalNav(null);
                        setLatestModalNavError(null);
                        setIsLatestModalNavLoading(false);
                        setSelectedBuySchemeCode("");
                        return;
                      }

                      setSelectedBuyFund([]);
                      setFundSearchOptions([]);
                      clearBuyErrors("previousSchemeCode");
                      setLatestModalNav(null);
                      setLatestModalNavError(null);
                      setIsLatestModalNavLoading(true);
                      setSelectedBuySchemeCode(event.target.value);

                      const matchingHolding = data.holdings.find(
                        (holding) => String(holding.schemeCode) === event.target.value
                      );

                      if (matchingHolding) {
                        setBuyValue("nav", String(matchingHolding.currentNav), {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }
                    }}
                  >
                    <option value="">Select from previous funds</option>
                    {data.previousFunds.map((fund) => (
                      <option key={fund.schemeCode} value={fund.schemeCode}>
                        {fund.schemeName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <span className="block text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
                Search Fund
              </span>
              <AsyncTypeahead
                clearButton
                delay={250}
                filterBy={() => true}
                id="mf-search"
                inputProps={{
                  className:
                    "h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5",
                }}
                isLoading={isSearchingFunds}
                labelKey="schemeName"
                minLength={2}
                onChange={(selected) => {
                  setSelectedBuyFund(selected as MfSchemeOption[]);

                  if (selected.length) {
                    setLatestModalNav(null);
                    setLatestModalNavError(null);
                    setIsLatestModalNavLoading(true);
                    setSelectedBuySchemeCode(String((selected[0] as MfSchemeOption).schemeCode));
                    setBuyValue("previousSchemeCode", "", {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    clearBuyErrors("previousSchemeCode");
                  } else {
                    setLatestModalNav(null);
                    setLatestModalNavError(null);
                    setIsLatestModalNavLoading(false);
                    setSelectedBuySchemeCode("");
                  }
                }}
                onSearch={handleFundSearch}
                options={fundSearchOptions}
                placeholder="Search by fund name"
                renderMenuItemChildren={(option, props) => {
                  const fund = option as MfSchemeOption;

                  return (
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-neutral-950">
                        <Highlighter search={props.text}>{fund.schemeName}</Highlighter>
                      </span>
                      <span className="mt-1 text-xs uppercase tracking-[0.14em] text-neutral-400">
                        Scheme Code: {fund.schemeCode}
                      </span>
                    </div>
                  );
                }}
                searchText="Searching mutual funds..."
                selected={selectedBuyFund}
                useCache={false}
              />
              {buyErrors.previousSchemeCode ? (
                <span className="text-sm text-destructive">
                  {buyErrors.previousSchemeCode.message}
                </span>
              ) : null}
              {!selectedBuyFund.length ? (
                <p className="text-xs text-neutral-500">
                  Start typing at least 2 characters to search for a different fund.
                </p>
              ) : null}
              {selectedBuySchemeCode ? (
                <ModalNavHint
                  formatter={formatter}
                  isLoading={isLatestModalNavLoading}
                  latestNav={latestModalNav}
                  message={latestModalNavError}
                />
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Units Bought</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="125.50"
                  step="0.0001"
                  type="number"
                  {...registerBuy("units", {
                    required: "Units are required.",
                    validate: (value) =>
                      Number(value) > 0 || "Units must be greater than zero.",
                  })}
                />
                {buyErrors.units ? (
                  <span className="text-sm text-destructive">{buyErrors.units.message}</span>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">NAV</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="87.45"
                  step="0.0001"
                  type="number"
                  {...registerBuy("nav", {
                    required: "NAV is required.",
                    validate: (value) => Number(value) > 0 || "NAV must be greater than zero.",
                  })}
                />
                {buyErrors.nav ? (
                  <span className="text-sm text-destructive">{buyErrors.nav.message}</span>
                ) : null}
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800">Purchase Date</span>
              <input
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                max={new Date().toISOString().slice(0, 10)}
                type="date"
                {...registerBuy("date", {
                  required: "Date is required.",
                })}
              />
              {buyErrors.date ? (
                <span className="text-sm text-destructive">{buyErrors.date.message}</span>
              ) : null}
            </label>

            <ModalActions
              isSubmitting={isBuySubmitting || isPending}
              onCancel={closeModal}
              submitLabel="Save Buy"
              submittingLabel="Saving..."
            />
          </form>
        </ModalFrame>
      ) : null}

      {activeModal === "sell" ? (
        <ModalFrame
          description="Pick a tracked holding, then enter units, sell NAV, and sell date."
          title="Sell Mutual Fund Units"
          onClose={closeModal}
        >
          <form className="mt-6 space-y-5" onSubmit={handleSellSubmit(onSell)}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800">Mutual Fund</span>
              <select
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                {...sellSchemeField}
                onChange={(event) => {
                  void sellSchemeField.onChange(event);
                  setLatestModalNav(null);
                  setLatestModalNavError(null);
                  setIsLatestModalNavLoading(true);
                  setSelectedSellSchemeCode(event.target.value);

                  const matchingHolding = data.holdings.find(
                    (holding) => String(holding.schemeCode) === event.target.value
                  );

                  if (matchingHolding) {
                    setSellValue("nav", String(matchingHolding.currentNav), {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                  }
                }}
              >
                {data.holdings.map((holding) => (
                  <option key={holding.schemeCode} value={holding.schemeCode}>
                    {holding.schemeName}
                  </option>
                ))}
              </select>
              <ModalNavHint
                formatter={formatter}
                isLoading={isLatestModalNavLoading}
                latestNav={latestModalNav}
                message={latestModalNavError}
              />
              {sellErrors.schemeCode ? (
                <span className="text-sm text-destructive">{sellErrors.schemeCode.message}</span>
              ) : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Units Sold</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="35.25"
                  step="0.0001"
                  type="number"
                  {...registerSell("units", {
                    required: "Units are required.",
                    validate: (value) =>
                      Number(value) > 0 || "Units must be greater than zero.",
                  })}
                />
                {sellErrors.units ? (
                  <span className="text-sm text-destructive">{sellErrors.units.message}</span>
                ) : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Sell NAV</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="93.10"
                  step="0.0001"
                  type="number"
                  {...registerSell("nav", {
                    required: "NAV is required.",
                    validate: (value) => Number(value) > 0 || "NAV must be greater than zero.",
                  })}
                />
                {sellErrors.nav ? (
                  <span className="text-sm text-destructive">{sellErrors.nav.message}</span>
                ) : null}
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-neutral-800">Sell Date</span>
              <input
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                max={new Date().toISOString().slice(0, 10)}
                type="date"
                {...registerSell("date", {
                  required: "Date is required.",
                })}
              />
              {sellErrors.date ? (
                <span className="text-sm text-destructive">{sellErrors.date.message}</span>
              ) : null}
            </label>

            <ModalActions
              isSubmitting={isSellSubmitting || isPending}
              onCancel={closeModal}
              submitLabel="Save Sell"
              submittingLabel="Saving..."
            />
          </form>
        </ModalFrame>
      ) : null}

      {isDistributionModalOpen ? (
        <ModalFrame
          description="All mutual fund allocations with the complete distribution chart."
          maxWidthClassName="max-w-5xl"
          title="All Fund Allocations"
          onClose={() => setIsDistributionModalOpen(false)}
        >
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {distributionData.map((entry) => (
                <div
                  key={entry.schemeCode}
                  className="flex min-w-0 items-center gap-2 rounded-[0.9rem] border border-[#edf1f7] bg-[#fafaf8] px-3 py-2"
                  title={entry.schemeName}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="min-w-0 truncate text-xs font-medium text-neutral-700">
                    {entry.schemeName}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-[28rem] rounded-[1.5rem] border border-[#eef2f7] bg-[#fafaf8] p-4 shadow-sm">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    cx="50%"
                    cy="50%"
                    data={distributionData}
                    dataKey="currentValue"
                    endAngle={-270}
                    innerRadius={0}
                    isAnimationActive
                    label={renderDistributionLabel}
                    labelLine={false}
                    nameKey="schemeName"
                    outerRadius="88%"
                    paddingAngle={distributionData.length > 1 ? 1 : 0}
                    startAngle={90}
                    stroke="#ffffff"
                    strokeWidth={2}
                  >
                    {distributionData.map((entry) => (
                      <Cell key={entry.schemeCode} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {marketSyncBatch ? (
        <ModalFrame
          description="Approve selected NAV updates or approve all before syncing them to the database."
          maxWidthClassName="max-w-6xl"
          title="Approve refreshed NAVs"
          onClose={() => setMarketSyncBatch(null)}
        >
          <div className="mt-6">
            <MarketSyncBatchReview
              batch={marketSyncBatch}
              compact
              currencyCode={currencyCode}
              onBatchChange={setMarketSyncBatch}
              onSynced={async () => {
                await reloadDashboard();
                setMarketSyncBatch(null);
              }}
            />
          </div>
        </ModalFrame>
      ) : null}
    </div>
  );
}

function ModalNavHint({
  latestNav,
  isLoading,
  message,
  formatter,
}: {
  latestNav: number | null;
  isLoading: boolean;
  message: string | null;
  formatter: Intl.NumberFormat;
}) {
  if (isLoading) {
    return <p className="text-xs text-neutral-500">Loading latest NAV...</p>;
  }

  if (message) {
    return <p className="text-xs text-rose-600">{message}</p>;
  }

  if (latestNav == null) {
    return null;
  }

  return (
    <p className="rounded-[0.9rem] border border-[#e6ebf2] bg-[#f8fbff] px-3 py-2 text-xs font-medium text-neutral-600">
      Latest NAV from live data:{" "}
      <span className="font-semibold text-neutral-950">{formatter.format(latestNav)}</span>
    </p>
  );
}

function SummaryCard({
  title,
  subtitle,
  icon,
  tone,
  detail,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
  detail?: string;
}) {
  const accent =
    tone === "positive"
      ? "bg-emerald-50"
      : tone === "negative"
        ? "bg-rose-50"
        : "bg-[#f2f5ef]";
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
      <div className="flex items-center gap-4">
        <div className={`flex size-14 items-center justify-center rounded-2xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">{subtitle}</p>
          <p className={`mt-2 text-[1.75rem] font-semibold tracking-tight ${valueClass}`}>
            {title}
          </p>
          {detail ? <p className={`mt-2 text-sm ${detailClass}`}>{detail}</p> : null}
        </div>
      </div>
    </section>
  );
}

function MetricChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const valueClass =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "negative"
        ? "text-rose-600"
        : "text-neutral-950";

  return (
    <div className="rounded-[1.2rem] border border-white/70 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </p>
      <p className={`mt-2 text-base font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function ModalFrame({
  title,
  description,
  children,
  onClose,
  maxWidthClassName = "max-w-2xl",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
      <div
        className={`w-full rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)] ${maxWidthClassName}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h3>
            <p className="mt-1 text-sm text-neutral-500">{description}</p>
          </div>
          <button
            className="rounded-full px-3 py-1 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  isSubmitting,
  submitLabel,
  submittingLabel,
  onCancel,
}: {
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onCancel: () => void;
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
        {isSubmitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
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

function FundMovementTooltip({
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

  const nav = Number(payload[0]?.value) || 0;

  return (
    <div className="rounded-2xl border border-[#e6ebf2] bg-white px-3.5 py-3 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
      <p className="text-sm font-semibold text-neutral-950">{label || "NAV"}</p>
      <div className="mt-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-neutral-500">NAV</span>
        <span className="font-semibold text-neutral-950">{currencyFormatter.format(nav)}</span>
      </div>
    </div>
  );
}
