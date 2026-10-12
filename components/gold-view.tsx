"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, Minus, Plus, RefreshCw, Trash2, Zap } from "lucide-react";
import toast from "react-hot-toast";

import { GoldAutoPricingSheet } from "@/components/gold-autopricing-sheet";
import {
  GoldTransactionSheet,
  type GoldFormKind,
  type GoldFormPayload,
} from "@/components/gold-forms";
import { AllocationBar, ASSET_COLORS, TrendChart } from "@/components/ui/charts";
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
import {
  formatDate,
  formatMoney,
  formatPercent,
  formatShortDate,
} from "@/lib/format";
import type {
  GoldActivitySummary,
  GoldDashboardData,
  GoldHoldingSummary,
  GoldTrackerInfo,
  GoldValuePoint,
} from "@/lib/gold.types";

type GoldViewProps = {
  currencyCode: string;
  data: GoldDashboardData;
  trackers: GoldTrackerInfo[];
};

const RANGES = ["1M", "3M", "6M", "1Y", "ALL"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Exclude<Range, "ALL">, number> = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366 };

function filterRange(points: GoldValuePoint[], range: Range) {
  if (range === "ALL" || !points.length) return points;
  const last = new Date(`${points[points.length - 1].date}T00:00:00`);
  const cutoff = new Date(last.getTime() - RANGE_DAYS[range] * 86400000);
  return points.filter((point) => new Date(`${point.date}T00:00:00`) >= cutoff);
}

export function GoldView({ currencyCode: currency, data, trackers }: GoldViewProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<{ kind: GoldFormKind; holdingId?: string } | null>(null);
  const [pricingHoldingId, setPricingHoldingId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("ALL");
  const [activityTab, setActivityTab] = useState<"transactions" | "valuations">("transactions");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const holdings = data.holdings;

  const trackerByHolding = useMemo(() => new Map(trackers.map((tracker) => [tracker.holdingId, tracker])), [trackers]);
  const autoCount = holdings.filter((holding) => trackerByHolding.has(holding.id)).length;
  const history = useMemo(() => data.valueHistory ?? [], [data.valueHistory]);
  const rangeHistory = useMemo(() => filterRange(history, range), [history, range]);
  const rangeChange = useMemo(() => {
    if (rangeHistory.length < 2) return null;
    const first = rangeHistory[0].totalValue;
    const last = rangeHistory[rangeHistory.length - 1].totalValue;
    return { value: last - first, percent: first ? ((last - first) / first) * 100 : null };
  }, [rangeHistory]);
  const activity = useMemo(() => data.allActivity ?? data.recentActivity.entries, [data]);
  const transactions = useMemo(() => activity.filter((entry) => entry.transactionType !== "valuation"), [activity]);
  const valuations = useMemo(() => activity.filter((entry) => entry.transactionType === "valuation"), [activity]);
  const pricingHolding = holdings.find((holding) => holding.id === pricingHoldingId) ?? null;
  const lastDay = data.lastDayChange;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function saveTransaction(payload: GoldFormPayload) {
    try {
      const response = await fetch("/api/gold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) throw new Error(result?.message || "Unable to save gold transaction.");

      toast.success(result?.message || "Gold transaction saved.");
      setForm(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save gold transaction.");
    }
  }

  async function deleteEntry(entry: GoldActivitySummary) {
    const label = entry.transactionType === "valuation" ? "price update" : entry.transactionType;

    if (!window.confirm(`Delete this ${label} for ${entry.schemeName} on ${formatDate(entry.date)}? This cannot be undone.`)) {
      return;
    }

    setDeletingId(entry.id);

    try {
      const response = await fetch(`/api/gold?transactionId=${encodeURIComponent(entry.id)}`, { method: "DELETE" });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) throw new Error(result?.message || "Unable to delete entry.");

      toast.success("Entry deleted.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveTracker(input: { holdingId: string; symbol: string; units: number }) {
    const response = await fetch("/api/gold/trackers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) throw new Error(result?.message || "Unable to enable auto-pricing.");

    toast.success("Auto-pricing enabled. Value refreshes every morning.");
    setPricingHoldingId(null);
    refresh();
  }

  async function disableTracker(holding: GoldHoldingSummary) {
    if (!window.confirm(`Stop auto-pricing ${holding.schemeName}? You will need to update its value by hand again.`)) return;

    const response = await fetch(`/api/gold/trackers?holdingId=${encodeURIComponent(holding.id)}`, { method: "DELETE" });

    if (!response.ok) {
      toast.error("Unable to disable auto-pricing.");
      return;
    }

    toast.success("Auto-pricing disabled.");
    refresh();
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" icon={Plus} onClick={() => setForm({ kind: "buy" })}>Buy</Button>
      <Button icon={Minus} disabled={!holdings.length} onClick={() => setForm({ kind: "sell" })}>Sell</Button>
      <Button icon={RefreshCw} disabled={!holdings.length} onClick={() => setForm({ kind: "valuation" })}>Update value</Button>
    </div>
  );

  const sheets = (
    <>
      <GoldTransactionSheet
        kind={form?.kind ?? null}
        holdings={holdings}
        initialHoldingId={form?.holdingId}
        currency={currency}
        onClose={() => setForm(null)}
        onSave={saveTransaction}
      />
      <GoldAutoPricingSheet
        holding={pricingHolding}
        tracker={pricingHolding ? trackerByHolding.get(pricingHolding.id) ?? null : null}
        currency={currency}
        onClose={() => setPricingHoldingId(null)}
        onSave={saveTracker}
      />
    </>
  );

  if (!holdings.length) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={Coins}
            title="No gold holdings yet"
            message="Add Sovereign Gold Bonds, gold ETFs, digital or physical gold to track their value and returns."
            action={<Button variant="primary" icon={Plus} onClick={() => setForm({ kind: "buy" })}>Buy gold</Button>}
          />
        </Card>
        {sheets}
      </Page>
    );
  }

  const holdingColumns: DataColumn<GoldHoldingSummary>[] = [
    {
      key: "holding",
      header: "Holding",
      mobile: "title",
      sortValue: (row) => row.schemeName,
      cell: (row) => <span className="font-medium text-ink">{row.schemeName}</span>,
    },
    {
      key: "type",
      header: "Type",
      mobile: "subtitle",
      sortValue: (row) => row.investmentOptionLabel,
      cell: (row) => <span className="text-ink-2">{row.investmentOptionLabel}</span>,
    },
    {
      key: "invested",
      header: "Invested",
      align: "right",
      mobile: "detail",
      sortValue: (row) => row.investedAmount,
      cell: (row) => <span className="tabular">{formatMoney(row.investedAmount, { currency, decimals: 0 })}</span>,
    },
    {
      key: "value",
      header: "Current value",
      align: "right",
      mobile: "value",
      sortValue: (row) => row.currentValue,
      cell: (row) => <span className="tabular font-semibold text-ink">{formatMoney(row.currentValue, { currency, decimals: 0 })}</span>,
    },
    {
      key: "returns",
      header: "Returns",
      align: "right",
      mobile: "valueSub",
      sortValue: (row) => row.profitLossAmount,
      cell: (row) => <Delta value={row.profitLossAmount} percent={row.profitLossPct} compact currency={currency} size="xs" />,
    },
    {
      key: "valued",
      header: "Last valued",
      mobile: "detail",
      sortValue: (row) => row.lastValuedAt ?? "",
      cell: (row) => <span className="tabular text-ink-2">{row.lastValuedAt ? formatShortDate(row.lastValuedAt) : "—"}</span>,
    },
    {
      key: "pricing",
      header: "Pricing",
      mobile: "detail",
      cell: (row) => {
        const tracker = trackerByHolding.get(row.id);

        return (
          <div className="flex flex-wrap items-center gap-2">
            {tracker ? (
              <Badge tone={tracker.lastError ? "warn" : "gain"}>Auto · {tracker.symbol}</Badge>
            ) : (
              <Badge>Manual</Badge>
            )}
            <button
              type="button"
              className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-brand hover:underline"
              onClick={() => setPricingHoldingId(row.id)}
            >
              <Zap className="size-3" />
              {tracker ? "Edit" : "Enable auto-pricing"}
            </button>
            {tracker ? (
              <button type="button" className="inline-flex min-h-8 items-center text-xs text-ink-3 hover:text-loss hover:underline" onClick={() => void disableTracker(row)}>
                Disable
              </button>
            ) : null}
          </div>
        );
      },
    },
  ];

  const activityColumns: DataColumn<GoldActivitySummary>[] = [
    {
      key: "date",
      header: "Date",
      mobile: "subtitle",
      sortValue: (row) => row.date,
      cell: (row) => <span className="tabular text-ink-2">{formatDate(row.date)}</span>,
    },
    {
      key: "holding",
      header: "Holding",
      mobile: "title",
      cell: (row) => <span className="font-medium text-ink">{row.schemeName}</span>,
    },
    {
      key: "type",
      header: "Type",
      mobile: "hidden",
      cell: (row) => (
        <Badge tone={row.transactionType === "buy" ? "gain" : row.transactionType === "sell" ? "loss" : "neutral"}>
          {row.transactionType === "valuation" ? "Value" : row.transactionType === "buy" ? "Buy" : "Sell"}
        </Badge>
      ),
    },
    {
      key: "amount",
      header: activityTab === "valuations" ? "Value" : "Amount",
      align: "right",
      mobile: "value",
      sortValue: (row) => row.sellAmount ?? row.investedAmount ?? row.currentValue ?? 0,
      cell: (row) => (
        <span className="tabular font-medium text-ink">
          {row.transactionType === "sell" ? "−" : ""}
          {formatMoney(
            row.transactionType === "sell" ? row.sellAmount : row.transactionType === "buy" ? row.investedAmount : row.currentValue,
            { currency, decimals: 0 }
          )}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Note",
      align: "right",
      mobile: "valueSub",
      cell: (row) =>
        row.transactionType === "sell" && row.realizedProfitAmount != null ? (
          <Delta value={row.realizedProfitAmount} compact currency={currency} size="xs" suffix="realised" />
        ) : (
          <span className="text-xs text-ink-3">
            {row.transactionType === "buy" ? "Bought" : row.transactionType === "sell" ? "Sold" : "Value set"}
          </span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (row) => (
        <IconButton icon={Trash2} label="Delete entry" disabled={deletingId === row.id} onClick={() => void deleteEntry(row)} />
      ),
    },
  ];

  const split = data.optionDistribution;
  const sinceLabel = lastDay ? `since ${formatShortDate(lastDay.fromDate)}` : undefined;

  return (
    <Page>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">Gold value</p>
            <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
              {formatMoney(data.totalCurrentValue, { currency, decimals: 0 })}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {lastDay ? (
                <Delta value={lastDay.amount} percent={lastDay.pct} currency={currency} suffix={sinceLabel} />
              ) : (
                <span className="text-sm text-ink-3">Change appears after the next price update</span>
              )}
              <span className="text-xs text-ink-3">
                {autoCount ? `${autoCount} of ${holdings.length} auto-priced` : "All values entered by hand"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {actions}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Invested" value={formatMoney(data.totalInvestedAmount, { currency, decimals: 0 })} />
          <StatTile
            label="Total returns"
            value={<Delta value={data.totalProfitLossAmount} percent={data.totalProfitLossPct} currency={currency} className="font-semibold" />}
          />
          <StatTile
            label="XIRR"
            value={
              data.xirr == null ? (
                <span className="text-sm font-normal text-ink-3">after 1 yr</span>
              ) : (
                <span className={data.xirr >= 0 ? "text-gain" : "text-loss"}>{formatPercent(data.xirr, { sign: true, decimals: 1 })}</span>
              )
            }
            caption="Annualised"
          />
          <StatTile
            label="vs last month"
            value={<Delta value={data.monthOverMonthChangeAmount} percent={data.monthOverMonthChangePct} compact currency={currency} className="font-semibold" />}
          />
        </dl>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Value history"
            subtitle="Total gold value from daily valuations"
            action={
              <Segmented ariaLabel="Time range" size="xs" value={range} onChange={setRange} options={RANGES.map((value) => ({ value, label: value }))} />
            }
          />
          {rangeHistory.length >= 2 ? (
            <>
              <TrendChart
                data={rangeHistory}
                xKey="date"
                height={240}
                currency={currency}
                series={[
                  { key: "totalValue", label: "Current value", color: ASSET_COLORS.gold },
                  { key: "totalInvested", label: "Invested", color: "var(--wc-asset-stocks)" },
                ]}
              />
              {rangeChange ? (
                <p className="mt-2 text-xs text-ink-3">
                  {range === "ALL" ? "Since tracking began" : `Over ${range}`}:{" "}
                  <Delta value={rangeChange.value} percent={rangeChange.percent} currency={currency} size="xs" />
                </p>
              ) : null}
            </>
          ) : (
            <p className="py-12 text-center text-sm text-ink-3">The chart fills in as daily valuations are recorded.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Gold types" subtitle="Where your gold is held" />
          {split.length > 1 ? (
            <AllocationBar
              currency={currency}
              items={split.map((item, index) => ({
                key: item.investmentOption,
                label: item.investmentOptionLabel,
                value: item.currentValue,
                color: `var(--chart-${(index % 5) + 1})`,
              }))}
            />
          ) : split[0] ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-ink">{split[0].investmentOptionLabel}</p>
              <p className="text-sm text-ink-3">
                100% of your gold is in {split[0].investmentOptionLabel}
                {holdings.length > 1 ? ` across ${holdings.length} holdings` : ""}. Add another type (ETF, digital) to diversify.
              </p>
              <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
                {holdings.map((holding) => (
                  <div key={holding.id} className="flex justify-between gap-3">
                    <dt className="min-w-0 truncate text-ink-3">{holding.schemeName}</dt>
                    <dd className="tabular font-medium text-ink">{formatPercent(data.totalCurrentValue ? (holding.currentValue / data.totalCurrentValue) * 100 : 0, { decimals: 0 })}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Holdings"
          subtitle={autoCount === holdings.length ? "All holdings are priced automatically every morning" : "Turn on auto-pricing so values update themselves every morning"}
        />
        <DataTable
          rows={holdings}
          columns={holdingColumns}
          getRowKey={(row) => row.id}
          initialSort={{ key: "value", direction: "desc" }}
        />
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Activity"
          subtitle={activityTab === "transactions" ? "Your buys and sells" : "Daily price updates, newest first"}
          action={
            <Segmented
              ariaLabel="Activity type"
              size="xs"
              value={activityTab}
              onChange={setActivityTab}
              options={[
                { value: "transactions", label: `Transactions (${transactions.length})` },
                { value: "valuations", label: `Price updates (${valuations.length})` },
              ]}
            />
          }
        />
        <DataTable
          key={activityTab}
          rows={activityTab === "transactions" ? transactions : valuations}
          columns={activityColumns}
          getRowKey={(row) => row.id}
          pageSize={activityTab === "transactions" ? 10 : 12}
          empty={<p className="py-8 text-center text-sm text-ink-3">{activityTab === "transactions" ? "No buys or sells yet." : "No price updates yet."}</p>}
        />
      </Card>

      {sheets}
    </Page>
  );
}
