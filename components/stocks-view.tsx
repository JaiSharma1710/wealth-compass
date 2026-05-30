"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
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
import type { PieLabelRenderProps } from "recharts";
import { AsyncTypeahead, Highlighter } from "react-bootstrap-typeahead";
import { useForm } from "react-hook-form";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeIndianRupee,
  BriefcaseBusiness,
  CircleAlert,
  LoaderCircle,
  Plus,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

import type { StockDashboardData, StockHoldingSummary, StockSearchResult } from "@/lib/stocks.types";

type StocksViewProps = {
  currencyCode: string;
  initialData: StockDashboardData;
};

type BuyFormValues = {
  quantity: string;
  price: string;
  transactionDate: string;
  note: string;
};

type SellFormValues = {
  quantity: string;
  price: string;
  transactionDate: string;
  note: string;
};

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#7c3aed", "#0891b2"];
const RADIAN = Math.PI / 180;

function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: PieLabelRenderProps) {
  if (!percent || percent < 0.05 || typeof midAngle !== "number") {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.58;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(percent >= 0.1 ? 0 : 1)}%`}
    </text>
  );
}

export function StocksView({ currencyCode, initialData }: StocksViewProps) {
  const router = useRouter();
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const [activeModal, setActiveModal] = useState<"buy" | "sell" | null>(null);
  const [selectedSearch, setSelectedSearch] = useState<StockSearchResult[]>([]);
  const [selectedHolding, setSelectedHolding] = useState<StockHoldingSummary | null>(
    initialData.holdings[0] || null
  );
  const [searchOptions, setSearchOptions] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [transactionFilter, setTransactionFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [isPending, startTransition] = useTransition();
  const buyForm = useForm<BuyFormValues>({
    defaultValues: {
      quantity: "",
      price: "",
      transactionDate: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });
  const sellForm = useForm<SellFormValues>({
    defaultValues: {
      quantity: "",
      price: selectedHolding?.currentPrice ? String(selectedHolding.currentPrice) : "",
      transactionDate: new Date().toISOString().slice(0, 10),
      note: "",
    },
  });

  const stockAllocationData = initialData.stockAllocation.map((entry, index) => ({
    ...entry,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const sectorAllocationData = initialData.sectorAllocation.map((entry, index) => ({
    ...entry,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const holdingsChartData = initialData.holdings.map((holding) => ({
    symbol: holding.symbol,
    invested: holding.investedAmount,
    current: holding.currentValue,
  }));
  const filteredTransactions = initialData.transactions.filter((transaction) =>
    transactionFilter === "ALL" ? true : transaction.type === transactionFilter
  );

  async function onSearch(query: string) {
    if (!query.trim()) {
      setSearchOptions([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as
        | { options?: StockSearchResult[]; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to search stocks.");
      }

      setSearchOptions(result?.options || []);
    } catch (error) {
      setSearchOptions([]);
      toast.error(error instanceof Error ? error.message : "Unable to search stocks.");
    } finally {
      setIsSearching(false);
    }
  }

  function closeModal() {
    setActiveModal(null);
    setSelectedSearch([]);
    buyForm.reset({
      quantity: "",
      price: "",
      transactionDate: new Date().toISOString().slice(0, 10),
      note: "",
    });
    sellForm.reset({
      quantity: "",
      price: selectedHolding?.currentPrice ? String(selectedHolding.currentPrice) : "",
      transactionDate: new Date().toISOString().slice(0, 10),
      note: "",
    });
  }

  async function save(endpoint: "/api/stocks/buy" | "/api/stocks/sell", payload: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      throw new Error(result?.message || "Unable to save stock transaction.");
    }

    toast.success(result?.message || "Stock transaction saved.");
    closeModal();
    startTransition(() => router.refresh());
  }

  async function submitBuy(values: BuyFormValues) {
    const stock = selectedSearch[0];

    if (!stock) {
      toast.error("Please select a stock from the stock list.");
      return;
    }

    try {
      await save("/api/stocks/buy", {
        symbol: stock.symbol,
        exchange: stock.exchange,
        companyName: stock.companyName,
        shortName: stock.shortName,
        sector: stock.sector,
        industry: stock.industry,
        quantity: Number(values.quantity),
        price: Number(values.price),
        transactionDate: values.transactionDate,
        note: values.note,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save stock purchase.");
    }
  }

  async function submitSell(values: SellFormValues) {
    if (!selectedHolding) {
      toast.error("Please choose an active holding to sell.");
      return;
    }

    try {
      await save("/api/stocks/sell", {
        symbol: selectedHolding.symbol,
        quantity: Number(values.quantity),
        price: Number(values.price),
        transactionDate: values.transactionDate,
        note: values.note,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save stock sale.");
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-[#f5f7fb]">
      <section className="flex flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[#dce3ef] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7c8aa5]">
                Direct Equity Portfolio
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#10203a]">
                Stocks
              </h1>
              <p className="max-w-2xl text-sm text-[#5f6f89]">
                Track active positions, locked-in realized profit, and full lifecycle history
                with Yahoo Finance market data.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full border border-[#d6e0ef] bg-white px-4 py-2 text-sm font-medium text-[#234067] transition hover:border-[#9cb6dc] hover:bg-[#f8fbff]"
                disabled={isPending}
                onClick={() => startTransition(() => router.refresh())}
                type="button"
              >
                <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
                Refresh prices
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#173d7a] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#123466]"
                onClick={() => setActiveModal("buy")}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add buy
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#0f7a56] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0d6849]"
                onClick={() => setActiveModal("sell")}
                type="button"
              >
                <ArrowDownRight className="h-4 w-4" />
                Add sell
              </button>
            </div>
          </div>
          {initialData.hasStaleQuotes ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#f4d6a0] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6120]">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Quote refresh failed for part of the portfolio. Saved prices are still shown, and
                some values may be stale.
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            label="Current value"
            value={formatter.format(initialData.totalCurrentValue)}
            accent="blue"
          />
          <SummaryCard
            icon={<BadgeIndianRupee className="h-5 w-5" />}
            label="Invested amount"
            value={formatter.format(initialData.totalInvestedAmount)}
            accent="slate"
          />
          <SummaryCard
            icon={<ArrowUpRight className="h-5 w-5" />}
            label="Unrealized P&L"
            value={`${formatter.format(initialData.totalUnrealizedProfit)} (${formatPercent(
              initialData.totalUnrealizedProfitPercent
            )})`}
            accent={initialData.totalUnrealizedProfit >= 0 ? "green" : "red"}
          />
          <SummaryCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Realized P&L"
            value={formatter.format(initialData.totalRealizedProfit)}
            accent={initialData.totalRealizedProfit >= 0 ? "green" : "red"}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Panel title="Active holdings" subtitle={`${initialData.holdingCount} open positions`}>
            {initialData.holdings.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
                      <th className="px-3">Stock</th>
                      <th className="px-3">Qty</th>
                      <th className="px-3">Avg</th>
                      <th className="px-3">Current</th>
                      <th className="px-3">P&L</th>
                      <th className="px-3">Today</th>
                      <th className="px-3">Allocation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {initialData.holdings.map((holding) => (
                      <tr
                        key={holding.id}
                        className="rounded-2xl bg-[#f8fbff] text-sm text-[#143155] shadow-[inset_0_0_0_1px_#e4edf7]"
                      >
                        <td className="rounded-l-2xl px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <Link
                              className="font-semibold text-[#173d7a] hover:text-[#0f2d5c]"
                              href={`/stocks/${encodeURIComponent(holding.symbol)}`}
                            >
                              {displaySymbol(holding.symbol, holding.shortName)}
                            </Link>
                            <span className="text-xs text-[#6c7a93]">{holding.companyName}</span>
                            {holding.isStale ? (
                              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#b27712]">
                                Stale quote
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">{holding.quantity}</td>
                        <td className="px-3 py-3">{formatter.format(holding.averagePrice)}</td>
                        <td className="px-3 py-3">
                          {holding.currentPrice == null ? "Unavailable" : formatter.format(holding.currentPrice)}
                        </td>
                        <td className="px-3 py-3">
                          <ValuePill
                            formatter={formatter}
                            percent={holding.unrealizedProfitPercent}
                            value={holding.unrealizedProfit}
                          />
                        </td>
                        <td className="px-3 py-3">
                          {holding.todayPnL == null ? (
                            <span className="text-xs text-[#8a97ad]">Unavailable</span>
                          ) : (
                            <ValuePill
                              formatter={formatter}
                              percent={holding.todayPnLPercent}
                              value={holding.todayPnL}
                            />
                          )}
                        </td>
                        <td className="rounded-r-2xl px-3 py-3">{formatPercent(holding.allocationPercent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                description="Add your first buy transaction to open a stock position."
                title="No active holdings yet"
              />
            )}
          </Panel>

          <Panel title="Portfolio mix" subtitle="Allocation by stock">
            {stockAllocationData.length ? (
              <div className="space-y-5">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stockAllocationData}
                        dataKey="value"
                        innerRadius={70}
                        outerRadius={105}
                        label={renderPieLabel}
                        labelLine={false}
                      >
                        {stockAllocationData.map((entry) => (
                          <Cell key={entry.label} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(props) => (
                          <PieValueTooltip {...props} currencyFormatter={formatter} />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {stockAllocationData.slice(0, 6).map((entry) => (
                    <LegendRow
                      key={entry.label}
                      color={entry.color}
                      label={entry.label}
                      value={`${formatter.format(entry.value)} • ${formatPercent(entry.percentage)}`}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                description="Allocation charts will appear once the portfolio has active holdings."
                title="Nothing to chart yet"
              />
            )}
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Invested vs current" subtitle="Position-level comparison">
            {holdingsChartData.length ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={holdingsChartData}>
                    <defs>
                      <linearGradient id="stocksCurrent" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#e8eef7" strokeDasharray="4 4" />
                    <XAxis dataKey="symbol" tick={{ fill: "#6c7a93", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#6c7a93", fontSize: 12 }} tickFormatter={(value) => compactNumber(value)} />
                    <Tooltip
                      content={(props) => (
                        <AreaValueTooltip {...props} currencyFormatter={formatter} />
                      )}
                    />
                    <Area
                      dataKey="current"
                      fill="url(#stocksCurrent)"
                      stroke="#2563eb"
                      strokeWidth={2}
                      type="monotone"
                    />
                    <Area
                      dataKey="invested"
                      fill="#16a34a10"
                      stroke="#16a34a"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState description="The comparison view will populate after your first position." title="No chart data" />
            )}
          </Panel>

          <Panel title="Sector exposure" subtitle="Grouped by sector">
            <div className="space-y-3">
              {sectorAllocationData.length ? (
                sectorAllocationData.slice(0, 6).map((entry) => (
                  <div key={entry.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm text-[#213655]">
                      <span>{entry.label}</span>
                      <span>{formatPercent(entry.percentage)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#edf3fb]">
                      <div
                        className="h-2 rounded-full bg-[#173d7a]"
                        style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState description="Sector reporting appears when holdings have market metadata." title="No sector data" />
              )}
            </div>
          </Panel>

          <Panel title="Quick stats" subtitle="At-a-glance counts">
            <div className="grid gap-3">
              <StatRow label="Profitable holdings" value={String(initialData.profitableHoldingsCount)} />
              <StatRow label="Loss-making holdings" value={String(initialData.lossHoldingsCount)} />
              <StatRow label="Total dividends" value={formatter.format(initialData.totalDividends)} />
              <StatRow
                label="Today P&L"
                value={initialData.totalTodayPnL == null ? "Unavailable" : formatter.format(initialData.totalTodayPnL)}
              />
              <StatRow label="Last updated" value={initialData.lastUpdatedAt ? formatDateTime(initialData.lastUpdatedAt) : "Not yet"} />
            </div>
          </Panel>
        </div>

        <Panel title="Transaction history" subtitle="Includes active and closed lifecycles">
          <div className="mb-4 flex flex-wrap gap-2">
            {(["ALL", "BUY", "SELL"] as const).map((filter) => (
              <button
                key={filter}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.14em] ${
                  transactionFilter === filter
                    ? "bg-[#173d7a] text-white"
                    : "border border-[#d5dfef] bg-white text-[#5f6f89]"
                }`}
                onClick={() => setTransactionFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          {filteredTransactions.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e6edf7] text-left text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Net cash</th>
                    <th className="px-3 py-2">Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-[#eef3fa] text-[#233a5f]">
                      <td className="px-3 py-3">{formatDate(transaction.transactionDate)}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{displaySymbol(transaction.symbol)}</div>
                        <div className="text-xs text-[#708099]">{transaction.companyName}</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          transaction.type === "BUY"
                            ? "bg-[#e9f7ef] text-[#0f7a56]"
                            : "bg-[#fff1f1] text-[#b23434]"
                        }`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-3 py-3">{transaction.quantity}</td>
                      <td className="px-3 py-3">{formatter.format(transaction.price)}</td>
                      <td className="px-3 py-3">
                        {transaction.type === "BUY"
                          ? formatter.format(transaction.buyNetAmount || 0)
                          : formatter.format(transaction.sellNetAmount || 0)}
                      </td>
                      <td className="px-3 py-3">
                        {transaction.realizedProfitForSell == null ? (
                          <span className="text-xs text-[#8a97ad]">Pending sale</span>
                        ) : (
                          <ValuePill formatter={formatter} percent={null} value={transaction.realizedProfitForSell} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState description="No transactions match the current filter." title="No history to show" />
          )}
        </Panel>
      </section>

      {activeModal === "buy" ? (
        <Modal title="Add stock buy" onClose={closeModal}>
          <form className="space-y-4" onSubmit={buyForm.handleSubmit(submitBuy)}>
            <div>
              <label className="mb-2 block text-sm font-medium text-[#234067]">Stock</label>
              <AsyncTypeahead
                className="stocks-typeahead"
                filterBy={() => true}
                id="stock-buy-typeahead"
                isLoading={isSearching}
                labelKey={(option) =>
                  typeof option === "string"
                    ? option
                    : `${option.shortName} • ${option.companyName}`
                }
                minLength={1}
                onChange={(selected) => setSelectedSearch(selected as StockSearchResult[])}
                onSearch={onSearch}
                options={searchOptions}
                placeholder="Search by company, symbol, or Yahoo symbol"
                renderMenuItemChildren={(option) => {
                  const typed = option as StockSearchResult;
                  return (
                    <div className="flex flex-col gap-0.5">
                      <Highlighter search={typed.shortName}>{typed.shortName}</Highlighter>
                      <span className="text-xs text-[#6c7a93]">
                        {typed.companyName} • {typed.exchange} • {typed.symbol}
                      </span>
                    </div>
                  );
                }}
                selected={selectedSearch}
                useCache={false}
              />
            </div>
            <Field label="Quantity">
              <input {...buyForm.register("quantity", { required: true })} className={inputClassName} inputMode="numeric" />
            </Field>
            <Field label="Buy price">
              <input {...buyForm.register("price", { required: true })} className={inputClassName} inputMode="decimal" />
            </Field>
            <Field label="Transaction date">
              <input {...buyForm.register("transactionDate", { required: true })} className={inputClassName} type="date" />
            </Field>
            <Field label="Note">
              <textarea {...buyForm.register("note")} className={`${inputClassName} min-h-24`} />
            </Field>
            <ModalActions isSubmitting={buyForm.formState.isSubmitting} submitLabel="Save buy" />
          </form>
        </Modal>
      ) : null}

      {activeModal === "sell" ? (
        <Modal title="Add stock sell" onClose={closeModal}>
          <form className="space-y-4" onSubmit={sellForm.handleSubmit(submitSell)}>
            <Field label="Active holding">
              <select
                className={inputClassName}
                onChange={(event) => {
                  const holding = initialData.holdings.find((entry) => entry.id === event.target.value) || null;
                  setSelectedHolding(holding);
                  sellForm.setValue("price", holding?.currentPrice ? String(holding.currentPrice) : "");
                }}
                value={selectedHolding?.id || ""}
              >
                {initialData.holdings.map((holding) => (
                  <option key={holding.id} value={holding.id}>
                    {holding.symbol} • {holding.quantity} shares
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantity">
              <input {...sellForm.register("quantity", { required: true })} className={inputClassName} inputMode="numeric" />
            </Field>
            <Field label="Sell price">
              <input {...sellForm.register("price", { required: true })} className={inputClassName} inputMode="decimal" />
            </Field>
            <Field label="Transaction date">
              <input {...sellForm.register("transactionDate", { required: true })} className={inputClassName} type="date" />
            </Field>
            <Field label="Note">
              <textarea {...sellForm.register("note")} className={`${inputClassName} min-h-24`} />
            </Field>
            <ModalActions isSubmitting={sellForm.formState.isSubmitting} submitLabel="Save sell" />
          </form>
        </Modal>
      ) : null}

      <style jsx global>{`
        .stocks-typeahead .form-control,
        .stocks-typeahead .rbt-input-main {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #d7e1f0;
          background: #ffffff;
          padding: 0.9rem 1rem;
          color: #17304f;
          font-size: 0.875rem;
          box-shadow: none;
        }

        .stocks-typeahead .form-control:focus,
        .stocks-typeahead .rbt-input-main:focus {
          border-color: #7fa7df;
          box-shadow: 0 0 0 4px #d9e9ff;
          outline: none;
        }

        .stocks-typeahead .rbt-menu {
          margin-top: 0.5rem;
          border-radius: 1rem;
          border: 1px solid #dbe4f0;
          padding: 0.35rem;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
        }

        .stocks-typeahead .dropdown-item {
          border-radius: 0.85rem;
          padding: 0.7rem 0.85rem;
        }
      `}</style>
    </div>
  );
}

function createCurrencyFormatter(currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode || "INR",
    maximumFractionDigits: 2,
  });
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
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

function formatPercent(value: number | null) {
  if (value == null) {
    return "Unavailable";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function displaySymbol(symbol: string, shortName?: string | null) {
  if (shortName) {
    return shortName;
  }

  return symbol.includes(".") ? symbol.split(".")[0] || symbol : symbol;
}

const inputClassName =
  "w-full rounded-2xl border border-[#d7e1f0] bg-white px-4 py-3 text-sm text-[#17304f] outline-none transition placeholder:text-[#96a1b5] focus:border-[#7fa7df] focus:ring-4 focus:ring-[#d9e9ff]";

function SummaryCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "blue" | "slate" | "green" | "red";
}) {
  const accentClass =
    accent === "blue"
      ? "bg-[#e8f1ff] text-[#17448d]"
      : accent === "green"
        ? "bg-[#e9f7ef] text-[#0f7a56]"
        : accent === "red"
          ? "bg-[#fff1f1] text-[#b23434]"
          : "bg-[#eef2f7] text-[#44556f]";

  return (
    <div className="rounded-[24px] border border-[#dde5f1] bg-white p-4 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
      <div className={`mb-3 inline-flex rounded-2xl p-3 ${accentClass}`}>{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7c8aa5]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#132842]">{value}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#dce4f0] bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-[#132842]">{title}</h2>
        <p className="mt-1 text-sm text-[#6d7d97]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-[#d7e1ef] bg-[#f8fbff] px-5 py-10 text-center">
      <p className="text-sm font-semibold text-[#223655]">{title}</p>
      <p className="mt-2 text-sm text-[#72829a]">{description}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#234067]">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08101f]/55 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[#dde5f1] bg-white p-6 shadow-[0_28px_80px_rgba(8,16,31,0.35)]">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-[#132842]">{title}</h3>
          <button className="rounded-full border border-[#d8e1ef] px-3 py-1.5 text-sm text-[#566883]" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ isSubmitting, submitLabel }: { isSubmitting: boolean; submitLabel: string }) {
  return (
    <div className="flex justify-end">
      <button
        className="inline-flex items-center gap-2 rounded-full bg-[#173d7a] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#123466] disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-[#213655]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span>{label}</span>
      </div>
      <span className="text-[#6d7d97]">{value}</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#f8fbff] px-4 py-3 text-sm">
      <span className="text-[#51627d]">{label}</span>
      <span className="font-semibold text-[#17304f]">{value}</span>
    </div>
  );
}

function ValuePill({
  formatter,
  value,
  percent,
}: {
  formatter: Intl.NumberFormat;
  value: number;
  percent: number | null;
}) {
  const positive = value >= 0;

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        positive ? "bg-[#e9f7ef] text-[#0f7a56]" : "bg-[#fff1f1] text-[#b23434]"
      }`}
    >
      {formatter.format(value)}
      {percent == null ? "" : ` • ${formatPercent(percent)}`}
    </span>
  );
}

function PieValueTooltip({
  active,
  payload,
  currencyFormatter,
}: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload as { label: string; value: number; percentage: number };

  return (
    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
      <div className="font-semibold">{item.label}</div>
      <div>{currencyFormatter.format(item.value)}</div>
      <div className="text-xs text-[#71819a]">{formatPercent(item.percentage)}</div>
    </div>
  );
}

function AreaValueTooltip({
  active,
  payload,
  label,
  currencyFormatter,
}: any) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm text-[#17304f] shadow-lg">
      <div className="font-semibold">{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="capitalize text-[#6d7d97]">{String(entry.dataKey)}</span>
          <span>{currencyFormatter.format(Number(entry.value || 0))}</span>
        </div>
      ))}
    </div>
  );
}
