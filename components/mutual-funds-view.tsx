"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Landmark, Plus, RefreshCw, Trash2, TrendingUp, Trophy, Layers, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";

import { ConfirmDeleteSheet, MutualFundTradeSheet } from "@/components/mutual-funds-sheets";
import { estimateFundCategory, shortSchemeName } from "@/components/mutual-funds-categories";
import { AllocationBar, ASSET_COLORS, RankedBars, TrendChart } from "@/components/ui/charts";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import { Badge, Button, Card, CardHeader, Delta, EmptyState, Page, StatTile } from "@/components/ui/kit";
import { Field, Select } from "@/components/ui/sheet";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  toneOf,
} from "@/lib/format";
import type {
  MutualFundDashboardData,
  MutualFundHoldingSummary,
  MutualFundNavHistory,
  MutualFundTransactionSummary,
} from "@/lib/mutual-funds.types";
import { cn } from "@/lib/utils";

const FUND_COLORS = [
  "var(--wc-asset-funds)",
  "var(--wc-asset-stocks)",
  "var(--wc-asset-gold)",
  "var(--wc-asset-cash)",
  "var(--wc-asset-other)",
  "var(--wc-ink-3)",
];

export function MutualFundsView({ data: initialData, currencyCode }: { data: MutualFundDashboardData; currencyCode: string }) {
  const router = useRouter();
  const currency = currencyCode;
  const [data, setData] = useState(initialData);
  const [sheet, setSheet] = useState<"buy" | "sell" | null>(null);
  const [presetScheme, setPresetScheme] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toDelete, setToDelete] = useState<MutualFundTransactionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [historyScheme, setHistoryScheme] = useState<number | null>(initialData.holdings[0]?.schemeCode ?? null);
  const [history, setHistory] = useState<MutualFundNavHistory | null>(null);
  const [historyError, setHistoryError] = useState<number | null>(null);

  const [seenData, setSeenData] = useState(initialData);
  if (seenData !== initialData) {
    setSeenData(initialData);
    setData(initialData);
  }

  const { holdings } = data;
  const hasData = holdings.length > 0 || data.recentTransactions.length > 0;

  // Keep the chart's fund valid when holdings change.
  const activeScheme =
    historyScheme != null && holdings.some((item) => item.schemeCode === historyScheme)
      ? historyScheme
      : (holdings[0]?.schemeCode ?? null);

  useEffect(() => {
    if (activeScheme == null) return;
    const controller = new AbortController();
    const name = holdings.find((item) => item.schemeCode === activeScheme)?.schemeName || "";
    fetch(`/api/mutual-funds/history?schemeCode=${activeScheme}&schemeName=${encodeURIComponent(name)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as { history?: MutualFundNavHistory } | null;
        if (!response.ok || !result?.history) throw new Error("no history");
        setHistory(result.history);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setHistoryError(activeScheme);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScheme]);

  const historyReady = history != null && history.schemeCode === activeScheme;
  const historyState = historyReady ? "idle" : historyError === activeScheme ? "error" : "loading";
  const bestFund = useMemo(
    () => [...holdings].filter((item) => item.investedAmount > 0).sort((a, b) => b.profitLossPct - a.profitLossPct)[0] || null,
    [holdings]
  );
  const largestFund = holdings[0] || null;

  const categories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const holding of holdings) {
      const label = estimateFundCategory(holding.schemeName);
      totals.set(label, (totals.get(label) || 0) + holding.currentValue);
    }
    return [...totals.entries()].map(([label, value]) => ({ key: label, label, value })).sort((a, b) => b.value - a.value);
  }, [holdings]);

  const monthly = useMemo(() => {
    const first = data.months.findIndex((month) => month.totalInvested > 0 || month.totalValue > 0);
    return first === -1 ? [] : data.months.slice(first);
  }, [data.months]);

  const allocationItems = holdings.map((holding, index) => ({
    key: String(holding.schemeCode),
    label: shortSchemeName(holding.schemeName),
    value: holding.currentValue,
    color: FUND_COLORS[Math.min(index, FUND_COLORS.length - 1)],
  }));

  function openSheet(mode: "buy" | "sell", scheme: number | null = null) {
    setPresetScheme(scheme);
    setSheet(mode);
  }

  async function refreshNavs() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/market-sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "mutual_fund" }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message || "Unable to refresh NAVs.");
      toast.success("NAVs refreshed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to refresh NAVs.");
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/mutual-funds?id=${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as
        | { message?: string; dashboard?: MutualFundDashboardData }
        | null;
      if (!response.ok) throw new Error(result?.message || "Unable to delete the transaction.");
      toast.success("Transaction deleted.");
      if (result?.dashboard) setData(result.dashboard);
      setToDelete(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete the transaction.");
    } finally {
      setDeleting(false);
    }
  }

  const tradeSheets = (
    <>
      <MutualFundTradeSheet
        mode={sheet}
        onClose={() => setSheet(null)}
        holdings={holdings}
        previousFunds={data.previousFunds}
        presetSchemeCode={presetScheme}
        currency={currency}
        onSaved={(dashboard) => {
          if (dashboard) setData(dashboard);
          router.refresh();
        }}
      />
      <ConfirmDeleteSheet
        open={toDelete !== null}
        title="Delete this transaction?"
        message={
          toDelete
            ? `${toDelete.transactionType === "buy" ? "Purchase" : "Sale"} of ${formatNumber(toDelete.units, 4)} units of ${toDelete.schemeName} on ${formatDate(toDelete.date)} will be removed and your holdings recalculated. This can't be undone.`
            : ""
        }
        loading={deleting}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );

  if (!hasData) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={Landmark}
            title="Track your mutual funds"
            message="Add your first purchase and NAVs, returns and your monthly trend will update automatically every day."
            action={
              <Button variant="primary" icon={Plus} onClick={() => openSheet("buy")}>
                Add purchase
              </Button>
            }
          />
        </Card>
        {tradeSheets}
      </Page>
    );
  }

  const xirr = data.xirr;

  return (
    <Page>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">Current value</p>
            <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
              {formatMoney(data.totalPortfolioValue, { currency, decimals: 0 })}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {data.totalDayChange != null ? (
                <Delta value={data.totalDayChange} percent={data.totalDayChangePct} currency={currency} suffix="1D" />
              ) : (
                <span className="text-sm text-ink-3">Day change appears after the next NAV update</span>
              )}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button variant="primary" icon={Plus} onClick={() => openSheet("buy")} className="flex-1 sm:flex-none">
              Add purchase
            </Button>
            <Button onClick={() => openSheet("sell")} disabled={!holdings.length} className="flex-1 sm:flex-none">
              Record sale
            </Button>
            <Button icon={RefreshCw} loading={refreshing} onClick={refreshNavs} className="flex-1 sm:flex-none">
              Refresh NAVs
            </Button>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">Invested</dt>
            <dd className="tabular text-base font-semibold text-ink">{formatMoney(data.totalInvestedAmount, { currency, decimals: 0 })}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Total returns</dt>
            <dd>
              <Delta value={data.totalProfitLossAmount} percent={data.totalProfitLossPct} currency={currency} className="font-semibold" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Realised profit</dt>
            <dd className={cn("tabular text-base font-semibold", toneOf(data.totalRealizedProfitAmount) === "loss" ? "text-loss" : toneOf(data.totalRealizedProfitAmount) === "gain" ? "text-gain" : "text-ink")}>
              {formatMoney(data.totalRealizedProfitAmount, { currency, decimals: 0 })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3" title="Annualised return. Shown once you have a year of history.">
              XIRR
            </dt>
            <dd className={cn("tabular text-base font-semibold", (xirr ?? 0) >= 0 ? "text-gain" : "text-loss")}>
              {xirr == null ? <span className="text-sm font-normal text-ink-3">after 1 yr</span> : formatPercent(xirr, { sign: true, decimals: 1 })}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          NAVs last updated {data.lastUpdatedAt ? `${formatRelativeTime(data.lastUpdatedAt)} (${formatDate(data.lastUpdatedAt)})` : "— not yet"}
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Layers} label="Funds" value={String(holdings.length)} caption={holdings.length === 1 ? "active holding" : "active holdings"} />
        <StatTile
          icon={Trophy}
          label="Best fund"
          value={bestFund ? formatPercent(bestFund.profitLossPct, { sign: true, decimals: 1 }) : "—"}
          valueClassName={bestFund && bestFund.profitLossPct < 0 ? "text-loss" : "text-gain"}
          caption={bestFund ? shortSchemeName(bestFund.schemeName) : "No holdings"}
        />
        <StatTile
          icon={TrendingUp}
          label="Largest holding"
          value={largestFund ? formatPercent(largestFund.allocationPct, { decimals: 1 }) : "—"}
          caption={largestFund ? shortSchemeName(largestFund.schemeName) : "No holdings"}
        />
        <StatTile
          icon={CalendarClock}
          label="Month on month"
          value={formatCompactMoney(data.monthOverMonthChangeAmount, { currency })}
          valueClassName={toneOf(data.monthOverMonthChangeAmount) === "loss" ? "text-loss" : toneOf(data.monthOverMonthChangeAmount) === "gain" ? "text-gain" : undefined}
          caption={`${formatPercent(data.monthOverMonthChangePct, { sign: true, decimals: 1 })} vs last month`}
        />
      </div>

      {holdings.length ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Allocation by fund" subtitle={`${formatCompactMoney(data.totalPortfolioValue, { currency })} across ${holdings.length} fund${holdings.length === 1 ? "" : "s"}, smaller funds grouped as Other`} />
            <AllocationBar items={allocationItems} currency={currency} maxItems={7} />
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Category split" subtitle="Estimated from fund names" action={<Badge tone="warn">Estimated</Badge>} />
            <RankedBars
              items={categories.map((category) => ({
                key: category.key,
                label: category.label,
                value: category.value,
                caption: formatPercent(data.totalPortfolioValue ? (category.value / data.totalPortfolioValue) * 100 : 0, { decimals: 0 }),
              }))}
              currency={currency}
              color={ASSET_COLORS.mutualFunds}
            />
          </Card>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invested vs value" subtitle="Month-end, last 12 months" />
          {monthly.length >= 2 ? (
            <TrendChart
              data={monthly}
              xKey="label"
              xFormatter={(value) => String(value)}
              height={240}
              currency={currency}
              series={[
                { key: "totalValue", label: "Current value", color: "var(--wc-asset-funds)" },
                { key: "totalInvested", label: "Invested", color: "var(--wc-ink-3)" },
              ]}
            />
          ) : (
            <p className="py-12 text-center text-sm text-ink-3">The trend fills in as monthly snapshots are saved.</p>
          )}
        </Card>
        <Card>
          <CardHeader
            title="NAV history"
            subtitle={historyReady && history ? `Latest NAV ${formatMoney(history.latestNav, { currency, decimals: 2 })}` : "Per-fund NAV movement"}
            action={historyReady && history ? <Delta value={history.changeAmount} percent={history.changePct} currency={currency} size="xs" /> : undefined}
          />
          {holdings.length > 1 ? (
            <Field label="Fund" className="mb-3">
              <Select value={activeScheme ?? ""} onChange={(event) => setHistoryScheme(Number(event.target.value))}>
                {holdings.map((item) => (
                  <option key={item.schemeCode} value={item.schemeCode}>
                    {shortSchemeName(item.schemeName)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {historyState === "loading" ? (
            <p className="py-12 text-center text-sm text-ink-3">Loading NAV history…</p>
          ) : historyReady && history && history.points.length >= 2 ? (
            <TrendChart
              data={history.points}
              xKey="label"
              height={holdings.length > 1 ? 190 : 240}
              currency={currency}
              series={[{ key: "nav", label: "NAV", color: "var(--wc-asset-funds)" }]}
              valueFormatter={(value) => formatMoney(value, { currency, decimals: 2 })}
            />
          ) : (
            <p className="py-12 text-center text-sm text-ink-3">
              {historyState === "error" ? "NAV history isn't available for this fund yet." : "Not enough NAV history yet."}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4" id="holdings">
        <CardHeader title="Holdings" subtitle="Tap a column to sort" />
        <DataTable
          rows={holdings}
          getRowKey={(row) => String(row.schemeCode)}
          initialSort={{ key: "value", direction: "desc" }}
          empty={<p className="py-8 text-center text-sm text-ink-3">No active holdings. Add a purchase to get started.</p>}
          columns={holdingColumns(currency, (code) => openSheet("sell", code), (code) => openSheet("buy", code))}
        />
      </Card>

      <Card className="mt-4">
        <CardHeader title="Transactions" subtitle={`${data.recentTransactions.length} in total`} />
        <DataTable
          rows={data.recentTransactions}
          getRowKey={(row) => row.id}
          pageSize={15}
          initialSort={{ key: "date", direction: "desc" }}
          empty={<p className="py-8 text-center text-sm text-ink-3">No transactions yet.</p>}
          columns={transactionColumns(currency, setToDelete)}
        />
      </Card>

      {tradeSheets}
    </Page>
  );
}

function holdingColumns(
  currency: string,
  onSell: (code: number) => void,
  onBuy: (code: number) => void
): DataColumn<MutualFundHoldingSummary>[] {
  return [
    {
      key: "scheme",
      header: "Fund",
      mobile: "title",
      sortValue: (row) => row.schemeName,
      cell: (row) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate font-medium text-ink" title={row.schemeName}>{shortSchemeName(row.schemeName)}</p>
          <p className="text-xs text-ink-3">{estimateFundCategory(row.schemeName)} · {formatPercent(row.allocationPct, { decimals: 1 })} of portfolio</p>
        </div>
      ),
    },
    { key: "units", header: "Units", align: "right", mobile: "detail", sortValue: (row) => row.units, cell: (row) => <span className="tabular">{formatNumber(row.units, 3)}</span> },
    { key: "avg", header: "Avg NAV", align: "right", mobile: "detail", sortValue: (row) => row.averageNav, cell: (row) => <span className="tabular">{formatMoney(row.averageNav, { currency, decimals: 2 })}</span> },
    { key: "nav", header: "NAV", align: "right", mobile: "detail", sortValue: (row) => row.currentNav, cell: (row) => <span className="tabular">{formatMoney(row.currentNav, { currency, decimals: 2 })}</span> },
    { key: "invested", header: "Invested", align: "right", mobile: "detail", sortValue: (row) => row.investedAmount, cell: (row) => <span className="tabular">{formatMoney(row.investedAmount, { currency, decimals: 0 })}</span> },
    {
      key: "value",
      header: "Current value",
      align: "right",
      mobile: "value",
      sortValue: (row) => row.currentValue,
      cell: (row) => <span className="tabular font-medium text-ink">{formatMoney(row.currentValue, { currency, decimals: 0 })}</span>,
    },
    {
      key: "day",
      header: "1D",
      align: "right",
      mobile: "detail",
      sortValue: (row) => row.dayChange ?? null,
      cell: (row) => (row.dayChange != null ? <Delta value={row.dayChange} percent={row.dayChangePct} compact currency={currency} size="xs" /> : <span className="text-ink-3">—</span>),
    },
    {
      key: "returns",
      header: "Returns",
      align: "right",
      mobile: "valueSub",
      sortValue: (row) => row.profitLossPct,
      cell: (row) => <Delta value={row.profitLossAmount} percent={row.profitLossPct} compact currency={currency} size="xs" />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" onClick={() => onBuy(row.schemeCode)}>Buy</Button>
          <Button size="sm" onClick={() => onSell(row.schemeCode)}>Sell</Button>
        </div>
      ),
    },
  ];
}

function transactionColumns(
  currency: string,
  onDelete: (transaction: MutualFundTransactionSummary) => void
): DataColumn<MutualFundTransactionSummary>[] {
  return [
    {
      key: "scheme",
      header: "Fund",
      mobile: "title",
      sortValue: (row) => row.schemeName,
      cell: (row) => (
        <div className="min-w-0 max-w-[22rem]">
          <p className="truncate font-medium text-ink" title={row.schemeName}>{shortSchemeName(row.schemeName)}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      mobile: "subtitle",
      sortValue: (row) => row.transactionType,
      cell: (row) => <Badge tone={row.transactionType === "buy" ? "brand" : "warn"}>{row.transactionType === "buy" ? "Buy" : "Sell"}</Badge>,
    },
    { key: "date", header: "Date", mobile: "detail", sortValue: (row) => row.date, cell: (row) => <span className="tabular">{formatDate(row.date)}</span> },
    { key: "units", header: "Units", align: "right", mobile: "detail", sortValue: (row) => row.units, cell: (row) => <span className="tabular">{formatNumber(row.units, 3)}</span> },
    { key: "nav", header: "NAV", align: "right", mobile: "detail", sortValue: (row) => row.nav, cell: (row) => <span className="tabular">{formatMoney(row.nav, { currency, decimals: 2 })}</span> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      mobile: "value",
      sortValue: (row) => row.amount,
      cell: (row) => <span className="tabular font-medium text-ink">{formatMoney(row.amount, { currency, decimals: 0 })}</span>,
    },
    {
      key: "realised",
      header: "Realised",
      align: "right",
      mobile: "valueSub",
      sortValue: (row) => row.realizedProfitAmount ?? null,
      cell: (row) =>
        row.realizedProfitAmount != null ? (
          <Delta value={row.realizedProfitAmount} percent={row.realizedProfitPct} compact currency={currency} size="xs" />
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    {
      key: "delete",
      header: "",
      align: "right",
      mobile: "hidden",
      cell: (row) => (
        <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete ${row.transactionType} transaction`} onClick={() => onDelete(row)} />
      ),
    },
  ];
}
