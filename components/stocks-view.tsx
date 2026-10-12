"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LineChart, Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { displaySymbol, StockBuySheet, StockSellSheet } from "@/components/stocks-trade-sheets";
import { RankedBars } from "@/components/ui/charts";
import { DataTable, type DataColumn } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Delta,
  EmptyState,
  IconButton,
  Page,
  Segmented,
  StatTile,
} from "@/components/ui/kit";
import { Sheet } from "@/components/ui/sheet";
import {
  formatCompactMoney,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
import type { StockDashboardData, StockHoldingSummary, StockTransactionSummary } from "@/lib/stocks.types";
import { cn } from "@/lib/utils";

type TransactionFilter = "ALL" | "BUY" | "SELL";

export function StocksView({ initialData, currencyCode }: { initialData: StockDashboardData; currencyCode: string }) {
  const router = useRouter();
  const currency = currencyCode;
  const [data, setData] = useState(initialData);
  const [sheet, setSheet] = useState<"buy" | "sell" | null>(null);
  const [sellSymbol, setSellSymbol] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransactionFilter>("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StockTransactionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Adopt fresh server data after router.refresh() (e.g. the header price sync).
  const [source, setSource] = useState(initialData);
  if (source !== initialData) {
    setSource(initialData);
    setData(initialData);
  }

  const holdings = data.holdings;
  const profitable = holdings.filter((holding) => holding.unrealizedProfit >= 0).length;
  const best = [...holdings].sort((a, b) => b.unrealizedProfitPercent - a.unrealizedProfitPercent)[0];
  const worst = [...holdings].sort((a, b) => a.unrealizedProfitPercent - b.unrealizedProfitPercent)[0];
  const topMover = [...holdings]
    .filter((holding) => holding.todayPnLPercent != null)
    .sort((a, b) => Math.abs(b.todayPnLPercent || 0) - Math.abs(a.todayPnLPercent || 0))[0];
  const transactions = useMemo(
    () => data.transactions.filter((transaction) => filter === "ALL" || transaction.type === filter),
    [data.transactions, filter]
  );
  const staleCount = holdings.filter((holding) => holding.isStale).length;

  function applyDashboard(next: StockDashboardData | undefined) {
    if (next) setData(next);
    router.refresh();
  }

  async function refreshPrices() {
    setRefreshing(true);

    try {
      const response = await fetch("/api/market-sync/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetType: "stock" }),
      });

      if (!response.ok) throw new Error("Price refresh failed.");

      const result = await response.json();
      const failed = result?.batch?.itemCounts?.error || 0;
      toast[failed ? "error" : "success"](failed ? `${failed} price${failed === 1 ? "" : "s"} could not refresh` : "Prices updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Price refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);

    try {
      const response = await fetch(`/api/stocks/transactions/${pendingDelete.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => null);

      if (!response.ok) throw new Error(result?.message || "Unable to delete.");

      toast.success("Transaction deleted");
      applyDashboard(result?.dashboard);
      setPendingDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete.");
    } finally {
      setDeleting(false);
    }
  }

  const holdingColumns: DataColumn<StockHoldingSummary>[] = [
    {
      key: "symbol",
      header: "Stock",
      mobile: "title",
      sortValue: (row) => displaySymbol(row.symbol),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{displaySymbol(row.symbol)}</p>
          <p className="hidden max-w-[14rem] truncate text-xs text-ink-3 md:block">{row.companyName}</p>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Qty · Avg",
      mobile: "subtitle",
      cell: (row) => (
        <span className="text-ink-2">
          {formatNumber(row.quantity, 0)} <span className="text-ink-3">@ {formatMoney(row.averagePrice, { currency, decimals: 2 })}</span>
        </span>
      ),
    },
    {
      key: "ltp",
      header: "LTP",
      align: "right",
      mobile: "detail",
      sortValue: (row) => row.currentPrice,
      cell: (row) => (
        <span className={cn("text-ink", row.isStale && "text-ink-3")} title={row.isStale ? "Last synced price" : undefined}>
          {formatMoney(row.currentPrice, { currency, decimals: 2 })}
        </span>
      ),
    },
    {
      key: "value",
      header: "Current value",
      align: "right",
      mobile: "value",
      sortValue: (row) => row.currentValue,
      cell: (row) => (
        <div>
          <p className="font-medium text-ink">{formatMoney(row.currentValue, { currency })}</p>
          <p className="hidden text-xs text-ink-3 md:block">Inv. {formatMoney(row.investedAmount, { currency })}</p>
        </div>
      ),
    },
    {
      key: "day",
      header: "1D",
      align: "right",
      mobile: "detail",
      sortValue: (row) => row.todayPnLPercent,
      cell: (row) => <Delta value={row.todayPnL} percent={row.todayPnLPercent} size="xs" compact currency={currency} />,
    },
    {
      key: "pnl",
      header: "Returns",
      align: "right",
      mobile: "valueSub",
      sortValue: (row) => row.unrealizedProfitPercent,
      cell: (row) => (
        <Delta value={row.unrealizedProfit} percent={row.unrealizedProfitPercent} size="xs" currency={currency} compact />
      ),
    },
    {
      key: "weight",
      header: "Weight",
      align: "right",
      mobile: "detail",
      sortValue: (row) => row.allocationPercent,
      cell: (row) => <span className="text-ink-2">{formatPercent(row.allocationPercent, { decimals: 1 })}</span>,
    },
  ];

  const transactionColumns: DataColumn<StockTransactionSummary>[] = [
    {
      key: "stock",
      header: "Stock",
      mobile: "title",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <Badge tone={row.type === "BUY" ? "brand" : "warn"}>{row.type}</Badge>
          <span className="font-medium text-ink">{displaySymbol(row.symbol)}</span>
        </span>
      ),
    },
    {
      key: "date",
      header: "Date",
      mobile: "subtitle",
      sortValue: (row) => row.transactionDate,
      cell: (row) => (
        <span className="text-ink-2">
          {formatDate(row.transactionDate)}
          <span className="text-ink-3 md:hidden"> · {formatNumber(row.quantity, 0)} @ {formatMoney(row.price, { currency, decimals: 2 })}</span>
        </span>
      ),
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      mobile: "hidden",
      cell: (row) => formatNumber(row.quantity, 0),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      mobile: "hidden",
      cell: (row) => formatMoney(row.price, { currency, decimals: 2 }),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      mobile: "value",
      sortValue: (row) => (row.type === "BUY" ? row.buyNetAmount : row.sellNetAmount),
      cell: (row) => (
        <span className="font-medium text-ink">
          {formatMoney(row.type === "BUY" ? row.buyNetAmount ?? row.quantity * row.price : row.sellNetAmount ?? row.quantity * row.price, { currency })}
        </span>
      ),
    },
    {
      key: "realized",
      header: "Realised P&L",
      align: "right",
      mobile: "valueSub",
      cell: (row) =>
        row.type === "SELL" && row.realizedProfitForSell != null ? (
          <Delta value={row.realizedProfitForSell} size="xs" currency={currency} />
        ) : (
          <span className="text-xs text-ink-3">—</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      mobile: "detail",
      cell: (row) => (
        <IconButton
          icon={Trash2}
          label="Delete transaction"
          className="size-8 hover:text-loss"
          onClick={(event) => {
            event.stopPropagation();
            setPendingDelete(row);
          }}
        />
      ),
    },
  ];

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" icon={Plus} onClick={() => setSheet("buy")}>
        Buy
      </Button>
      <Button
        icon={Minus}
        disabled={!holdings.length}
        onClick={() => {
          setSellSymbol(null);
          setSheet("sell");
        }}
      >
        Sell
      </Button>
      <Button icon={RefreshCw} loading={refreshing} onClick={refreshPrices}>
        <span className="hidden sm:inline">Refresh prices</span>
        <span className="sm:hidden">Refresh</span>
      </Button>
    </div>
  );

  return (
    <Page>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">Stocks portfolio</p>
            <p className="tabular mt-1 text-[2rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.4rem]">
              {formatMoney(data.totalCurrentValue, { currency, decimals: 0 })}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {data.totalTodayPnL != null ? (
                <Delta value={data.totalTodayPnL} percent={data.totalTodayPnLPercent} currency={currency} suffix="1D" />
              ) : (
                <span className="text-sm text-ink-3">Day change appears after the next sync</span>
              )}
              <span className="text-xs text-ink-3">
                Prices {data.lastUpdatedAt ? `updated ${formatRelativeTime(data.lastUpdatedAt)}` : "not synced yet"}
                {staleCount ? ` · ${staleCount} not from today` : ""}
              </span>
            </div>
          </div>
          {actions}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-3">Invested</dt>
            <dd className="tabular mt-0.5 font-semibold text-ink">{formatMoney(data.totalInvestedAmount, { currency })}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Total returns</dt>
            <dd className="mt-0.5">
              <Delta value={data.totalUnrealizedProfit} percent={data.totalUnrealizedProfitPercent} currency={currency} compact className="font-semibold" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3">Realised P&amp;L</dt>
            <dd className="mt-0.5">
              {data.totalRealizedProfit ? (
                <Delta value={data.totalRealizedProfit} currency={currency} compact className="font-semibold" />
              ) : (
                <span className="tabular font-semibold text-ink-3">{formatMoney(0, { currency })}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-3" title="Annualised return. Shown once you have a year of history.">XIRR</dt>
            <dd className="tabular mt-0.5 font-semibold text-ink">
              {data.xirr == null ? <span className="text-sm font-normal text-ink-3">after 1 yr</span> : formatPercent(data.xirr, { sign: true, decimals: 1 })}
            </dd>
          </div>
        </dl>
      </Card>

      {holdings.length ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Holdings"
              value={holdings.length}
              caption={`${profitable} in profit · ${holdings.length - profitable} in loss`}
            />
            <StatTile
              label="Best performer"
              value={best ? displaySymbol(best.symbol) : "—"}
              delta={best ? <Delta percent={best.unrealizedProfitPercent} size="xs" /> : null}
            />
            <StatTile
              label="Worst performer"
              value={worst ? displaySymbol(worst.symbol) : "—"}
              delta={worst ? <Delta percent={worst.unrealizedProfitPercent} size="xs" /> : null}
            />
            <StatTile
              label="Biggest move today"
              value={topMover ? displaySymbol(topMover.symbol) : "—"}
              delta={topMover ? <Delta percent={topMover.todayPnLPercent} size="xs" /> : <span className="text-xs text-ink-3">After next sync</span>}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Holdings" subtitle="Tap a stock for its price history and trades" />
              <DataTable
                rows={holdings}
                columns={holdingColumns}
                getRowKey={(row) => row.symbol}
                rowHref={(row) => `/stocks/${encodeURIComponent(row.symbol)}`}
                initialSort={{ key: "value", direction: "desc" }}
              />
            </Card>
            <div className="grid gap-4">
              <Card>
                <CardHeader title="Portfolio weight" subtitle="Share of current value" />
                <RankedBars
                  currency={currency}
                  color="var(--wc-asset-stocks)"
                  items={[...holdings]
                    .sort((a, b) => b.currentValue - a.currentValue)
                    .map((holding) => ({
                      key: holding.symbol,
                      label: displaySymbol(holding.symbol),
                      value: holding.currentValue,
                      caption: formatPercent(holding.allocationPercent, { decimals: 1 }),
                    }))}
                />
              </Card>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader title="Profit & loss by stock" subtitle="Unrealised returns on each holding" />
            <PnlBars holdings={holdings} currency={currency} />
          </Card>
        </>
      ) : (
        <Card className="mt-4">
          <EmptyState
            icon={LineChart}
            title="No stocks yet"
            message="Add your first purchase. Prices then update automatically every morning."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setSheet("buy")}>
                Add a stock
              </Button>
            }
          />
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader
          title="Transactions"
          subtitle={`${data.transactions.length} trades`}
          action={
            <Segmented
              size="xs"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "ALL", label: "All" },
                { value: "BUY", label: "Buys" },
                { value: "SELL", label: "Sells" },
              ]}
            />
          }
        />
        <DataTable
          rows={transactions}
          columns={transactionColumns}
          getRowKey={(row) => row.id}
          pageSize={10}
          initialSort={{ key: "date", direction: "desc" }}
          empty={<EmptyState title="No transactions" message="Nothing matches this filter." className="py-6" />}
        />
      </Card>

      <StockBuySheet
        open={sheet === "buy"}
        onClose={() => setSheet(null)}
        onSaved={applyDashboard}
        currency={currency}
      />
      {sheet === "sell" ? (
        <StockSellSheet
          open
          onClose={() => setSheet(null)}
          onSaved={applyDashboard}
          holdings={holdings}
          currency={currency}
          initialSymbol={sellSymbol}
        />
      ) : null}

      <Sheet
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete transaction?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} loading={deleting} onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        {pendingDelete ? (
          <p className="text-sm text-ink-2">
            {pendingDelete.type === "BUY" ? "Purchase" : "Sale"} of {formatNumber(pendingDelete.quantity, 0)}{" "}
            {displaySymbol(pendingDelete.symbol)} on {formatDate(pendingDelete.transactionDate)} will be removed and
            your holdings recalculated.
          </p>
        ) : null}
      </Sheet>
    </Page>
  );
}

/** Diverging bars: gains extend right in green, losses left in red, from a shared zero line. */
function PnlBars({ holdings, currency }: { holdings: StockHoldingSummary[]; currency: string }) {
  const sorted = [...holdings].sort((a, b) => b.unrealizedProfit - a.unrealizedProfit);
  const max = Math.max(...sorted.map((holding) => Math.abs(holding.unrealizedProfit)), 1);

  return (
    <ul className="space-y-2">
      {sorted.map((holding) => {
        const width = (Math.abs(holding.unrealizedProfit) / max) * 50;
        const gain = holding.unrealizedProfit >= 0;

        return (
          <li key={holding.symbol} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 text-sm sm:grid-cols-[7rem_1fr_8rem]">
            <span className="truncate font-medium text-ink">{displaySymbol(holding.symbol)}</span>
            <div className="relative h-4">
              <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" aria-hidden />
              <div
                className={cn("absolute inset-y-0.5 rounded-[3px]", gain ? "bg-gain" : "bg-loss")}
                style={gain ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
              />
            </div>
            <span className="tabular text-right">
              <span className={cn("block font-medium", gain ? "text-gain" : "text-loss")}>
                {formatCompactMoney(holding.unrealizedProfit, { currency, sign: true })}
              </span>
              <span className="block text-xs text-ink-3">{formatPercent(holding.unrealizedProfitPercent, { sign: true })}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
