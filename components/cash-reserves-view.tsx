"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Landmark, Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";

import { CashEntrySheet, type CashEntrySubmit } from "@/components/cash-entry-sheet";
import { AllocationBar, ColumnChart, SERIES_COLORS, TrendChart } from "@/components/ui/charts";
import { type DataColumn, DataTable } from "@/components/ui/data-table";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Delta,
  EmptyState,
  Page,
  Segmented,
} from "@/components/ui/kit";
import { Select } from "@/components/ui/sheet";
import type {
  CashReserveDashboardData,
  CashReserveEntrySummary,
  CashReserveMonthSummary,
} from "@/lib/cash-reserves.types";
import { formatCompactMoney, formatDate, formatMoney, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  banks: string[];
  currencyCode: string;
  initialData: CashReserveDashboardData;
};

function monthLabelOf(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function CashReservesView({ banks, currencyCode, initialData }: Props) {
  const router = useRouter();
  const currency = currencyCode;
  const [data, setData] = useState(initialData);
  const [syncedFrom, setSyncedFrom] = useState(initialData);
  const [sheet, setSheet] = useState<{ open: boolean; entry: CashReserveEntrySummary | null; nonce: number }>({
    open: false,
    entry: null,
    nonce: 0,
  });
  const [saving, setSaving] = useState(false);
  const [bankFilter, setBankFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [monthFilter, setMonthFilter] = useState("all");

  // Re-sync when the server hands us fresh props (router.refresh()).
  if (syncedFrom !== initialData) {
    setSyncedFrom(initialData);
    setData(initialData);
  }

  const history: CashReserveMonthSummary[] = data.history ?? data.months;
  const entries = useMemo(() => data.allEntries ?? data.recentActivity.entries, [data]);
  const current = history[history.length - 1];
  const sixMonths = history.slice(-6);
  const average = sixMonths.length
    ? sixMonths.reduce((sum, month) => sum + month.closingBalance, 0) / sixMonths.length
    : 0;
  const previousClosing = history.length > 1 ? history[history.length - 2].closingBalance : 0;
  const changePercent = previousClosing > 0 ? (data.monthOverMonthChangeAmount / previousClosing) * 100 : null;

  const bankRows = useMemo(() => {
    const known = new Map(data.bankDistribution.map((entry) => [entry.bank, entry]));
    const names = [...banks, ...data.bankDistribution.map((entry) => entry.bank).filter((name) => !banks.includes(name))];

    return names.map((bank, index) => ({
      bank,
      balance: known.get(bank)?.balance ?? 0,
      percentage: known.get(bank)?.percentage ?? 0,
      lastDate: known.get(bank)?.lastMovementDate ?? null,
      lastAmount: known.get(bank)?.lastMovementAmount ?? null,
      lastType: known.get(bank)?.lastMovementType ?? null,
      color: SERIES_COLORS[index % SERIES_COLORS.length],
    }));
  }, [banks, data.bankDistribution]);

  const monthOptions = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.dateKey.slice(0, 7)))).sort().reverse(),
    [entries]
  );
  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (bankFilter === "all" || entry.bank === bankFilter) &&
          (typeFilter === "all" || entry.entryType === typeFilter) &&
          (monthFilter === "all" || entry.dateKey.startsWith(monthFilter))
      ),
    [entries, bankFilter, typeFilter, monthFilter]
  );
  const filteredNet = filtered.reduce((sum, entry) => sum + (entry.entryType === "credit" ? entry.amount : -entry.amount), 0);

  function openSheet(entry: CashReserveEntrySummary | null) {
    setSheet((state) => ({ open: true, entry, nonce: state.nonce + 1 }));
  }

  async function request(url: string, method: string, body?: unknown, success?: string) {
    setSaving(true);

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        dashboard?: CashReserveDashboardData;
      } | null;

      if (!response.ok) {
        toast.error(payload?.message || "Something went wrong.");
        return;
      }

      if (payload?.dashboard) setData(payload.dashboard);
      toast.success(success || payload?.message || "Saved.");
      setSheet((state) => ({ ...state, open: false }));
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(values: CashEntrySubmit) {
    const editing = sheet.entry;

    if (editing) {
      void request(`/api/cash-reserves/${editing.id}`, "PATCH", values, "Entry updated.");
    } else {
      void request("/api/cash-reserves", "POST", values, values.entryType === "transfer" ? "Transfer recorded." : "Entry added.");
    }
  }

  function handleDelete() {
    const editing = sheet.entry;

    if (!editing || !window.confirm("Delete this entry? This cannot be undone.")) return;
    void request(`/api/cash-reserves/${editing.id}`, "DELETE", undefined, "Entry deleted.");
  }

  const addButton = (
    <Button variant="primary" icon={Plus} onClick={() => openSheet(null)} disabled={!banks.length}>
      Add entry
    </Button>
  );

  const sheetNode = (
    <CashEntrySheet
      key={sheet.nonce}
      open={sheet.open}
      onClose={() => setSheet((state) => ({ ...state, open: false }))}
      banks={banks}
      entry={sheet.entry}
      saving={saving}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
    />
  );

  if (!banks.length && !entries.length) {
    return (
      <Page>
        <Card>
          <EmptyState
            icon={Landmark}
            title="Add your banks to start"
            message="Add the banks you hold savings in from Settings, then record credits and debits here."
          />
        </Card>
      </Page>
    );
  }

  const activityColumns: DataColumn<CashReserveEntrySummary>[] = [
    {
      key: "date",
      header: "Date",
      cell: (row) => <span className="whitespace-nowrap">{formatDate(row.dateKey)}</span>,
      sortValue: (row) => row.dateKey,
      mobile: "subtitle",
    },
    {
      key: "bank",
      header: "Bank",
      cell: (row) => row.bank,
      sortValue: (row) => row.bank,
      mobile: "title",
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <Badge tone={row.entryType === "credit" ? "gain" : "loss"}>
          {row.entryType === "credit" ? "Credit" : "Debit"}
        </Badge>
      ),
      mobile: "hidden",
    },
    {
      key: "note",
      header: "Note",
      cell: (row) => <span className="line-clamp-1 text-ink-2">{row.note || "—"}</span>,
      className: "max-w-[18rem]",
      mobile: "detail",
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (row) => (
        <span className={cn("font-semibold", row.entryType === "credit" ? "text-gain" : "text-loss")}>
          {row.entryType === "credit" ? "+" : "−"}
          {formatMoney(row.amount, { currency })}
        </span>
      ),
      sortValue: (row) => (row.entryType === "credit" ? row.amount : -row.amount),
      mobile: "value",
    },
    {
      key: "edit",
      header: <span className="sr-only">Edit</span>,
      align: "right",
      cell: () => <Pencil className="ml-auto size-3.5 text-ink-3" aria-hidden />,
      mobile: "hidden",
      className: "w-8",
    },
  ];

  const snapshotColumns: DataColumn<CashReserveMonthSummary>[] = [
    { key: "month", header: "Month", cell: (row) => row.longLabel ?? row.label, mobile: "title" },
    {
      key: "closing",
      header: "Closing balance",
      align: "right",
      cell: (row) => <span className="font-semibold">{formatMoney(row.closingBalance, { currency, decimals: 0 })}</span>,
      mobile: "value",
    },
    {
      key: "net",
      header: "Net",
      align: "right",
      cell: (row) => <Delta value={row.net} currency={currency} compact />,
      mobile: "valueSub",
    },
    {
      key: "credits",
      header: "Credits",
      align: "right",
      cell: (row) => formatMoney(row.credits, { currency, decimals: 0 }),
      mobile: "detail",
    },
    {
      key: "debits",
      header: "Debits",
      align: "right",
      cell: (row) => formatMoney(row.debits, { currency, decimals: 0 }),
      mobile: "detail",
    },
  ];

  const hasHistory = history.some((month) => month.credits || month.debits) || data.totalBalance !== 0;
  const snapshotRows = [...history].reverse().filter((month) => month.credits || month.debits).slice(0, 12);

  return (
    <Page>
      {/* Hero */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">Total cash &amp; savings</p>
            <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
              {formatMoney(data.totalBalance, { currency, decimals: 0 })}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Delta
                value={data.monthOverMonthChangeAmount}
                percent={changePercent}
                currency={currency}
                suffix="this month"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">{addButton}</div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Credits this month", value: formatMoney(current?.credits ?? 0, { currency, decimals: 0 }) },
            { label: "Debits this month", value: formatMoney(current?.debits ?? 0, { currency, decimals: 0 }) },
            { label: "6-month average", value: formatCompactMoney(average, { currency }) },
            {
              label: "Last activity",
              value: data.lastActivityDate ? formatRelativeTime(data.lastActivityDate) : "—",
              title: data.lastActivityDate ? formatDate(data.lastActivityDate) : undefined,
            },
          ].map((item) => (
            <div key={item.label} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2" title={item.title}>
              <dt className="truncate text-[0.7rem] font-medium text-ink-3">{item.label}</dt>
              <dd className="tabular mt-0.5 truncate text-sm font-semibold text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Banks */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Where it sits" subtitle="Share of total balance by bank" />
          {bankRows.some((row) => row.balance > 0) ? (
            <AllocationBar
              currency={currency}
              items={bankRows
                .filter((row) => row.balance > 0)
                .map((row) => ({ key: row.bank, label: row.bank, value: row.balance, color: row.color }))}
            />
          ) : (
            <p className="py-6 text-center text-sm text-ink-3">No balance in any bank yet.</p>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          {bankRows.map((row) => (
            <Card key={row.bank} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />
                  <p className="truncate text-sm font-medium text-ink">{row.bank}</p>
                </div>
                <Badge>{row.percentage.toFixed(0)}%</Badge>
              </div>
              <p className="tabular mt-2 text-lg font-semibold text-ink sm:text-xl">
                {formatMoney(row.balance, { currency, decimals: 0 })}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-xs text-ink-3">
                {row.lastDate && row.lastAmount != null ? (
                  <>
                    {row.lastType === "credit" ? (
                      <ArrowDownLeft className="size-3.5 text-gain" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-3.5 text-loss" aria-hidden />
                    )}
                    Last: {row.lastType === "credit" ? "+" : "−"}
                    {formatCompactMoney(row.lastAmount, { currency })} · {formatRelativeTime(row.lastDate)}
                  </>
                ) : (
                  "No movements yet"
                )}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Charts */}
      {hasHistory ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Balance history" subtitle="Month-end closing balance, last 12 months" />
            <TrendChart
              data={history}
              xKey="longLabel"
              xFormatter={(value) => String(value)}
              series={[{ key: "closingBalance", label: "Closing balance", color: "var(--wc-asset-cash)" }]}
              currency={currency}
              showLegend={false}
              includeZero
            />
          </Card>
          <Card>
            <CardHeader title="Monthly net flow" subtitle="Credits minus debits; savings added or spent" />
            <ColumnChart
              data={history}
              xKey="label"
              series={[{ key: "net", label: "Net flow", color: "var(--wc-asset-cash)" }]}
              currency={currency}
              colorFor={(row) => (Number(row.net) < 0 ? "var(--wc-loss)" : "var(--wc-gain)")}
            />
          </Card>
        </div>
      ) : null}

      {/* Snapshot */}
      {snapshotRows.length ? (
        <Card className="mt-4">
          <CardHeader title="Monthly snapshot" subtitle="Credits, debits and closing balance per month" />
          <DataTable rows={snapshotRows} columns={snapshotColumns} getRowKey={(row) => row.key} />
        </Card>
      ) : null}

      {/* Activity */}
      <Card className="mt-4">
        <CardHeader
          title="Activity"
          subtitle={`${filtered.length} entr${filtered.length === 1 ? "y" : "ies"} · net ${filteredNet < 0 ? "−" : "+"}${formatMoney(Math.abs(filteredNet), { currency, decimals: 0 })}`}
          action={
            <Button size="sm" icon={Plus} onClick={() => openSheet(null)} disabled={!banks.length}>
              Add
            </Button>
          }
        />
        <div className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select aria-label="Filter by bank" value={bankFilter} onChange={(event) => setBankFilter(event.target.value)} className="sm:w-44">
            <option value="all">All banks</option>
            {bankRows.map((row) => (
              <option key={row.bank} value={row.bank}>{row.bank}</option>
            ))}
          </Select>
          <Select aria-label="Filter by month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="sm:w-40">
            <option value="all">All months</option>
            {monthOptions.map((key) => (
              <option key={key} value={key}>{monthLabelOf(key)}</option>
            ))}
          </Select>
          <Segmented
            ariaLabel="Filter by type"
            value={typeFilter}
            onChange={setTypeFilter}
            className="col-span-2"
            options={[
              { value: "all", label: "All" },
              { value: "credit", label: "Credits" },
              { value: "debit", label: "Debits" },
            ]}
          />
        </div>
        <DataTable
          rows={filtered}
          columns={activityColumns}
          getRowKey={(row) => row.id}
          onRowClick={(row) => openSheet(row)}
          initialSort={{ key: "date", direction: "desc" }}
          pageSize={15}
          empty={
            <EmptyState
              icon={Landmark}
              title={entries.length ? "No entries match these filters" : "No entries yet"}
              message={entries.length ? "Try a different bank, type or month." : "Add your first credit or debit to start tracking."}
              action={entries.length ? undefined : addButton}
            />
          }
        />
        <p className="mt-3 text-xs text-ink-3">Tap an entry to edit or delete it.</p>
      </Card>

      {sheetNode}
    </Page>
  );
}
