"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Eye, Landmark, Plus, Wallet, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";

import type {
  CashReserveDashboardData,
  CashReserveEntrySummary,
  CashReserveEntryType,
  CashReserveRecentActivityPage,
} from "@/lib/cash-reserves.types";

type CashReservesViewProps = {
  banks: string[];
  currencyCode: string;
  initialData: CashReserveDashboardData;
};

type AddEntryValues = {
  date: string;
  amount: string;
  bank: string;
  entryType: CashReserveEntryType;
  note: string;
};

type ActivityQueryState = {
  page: number;
  month: string;
  year: string;
  date: string;
  entryType: CashReserveEntryType | "all";
};

const MONTH_FILTER_OPTIONS = [
  { label: "Jan", value: "1" },
  { label: "Feb", value: "2" },
  { label: "Mar", value: "3" },
  { label: "Apr", value: "4" },
  { label: "May", value: "5" },
  { label: "Jun", value: "6" },
  { label: "Jul", value: "7" },
  { label: "Aug", value: "8" },
  { label: "Sep", value: "9" },
  { label: "Oct", value: "10" },
  { label: "Nov", value: "11" },
  { label: "Dec", value: "12" },
] as const;

export function CashReservesView({ banks, currencyCode, initialData }: CashReservesViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [noteEntry, setNoteEntry] = useState<CashReserveEntrySummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const bankOptions = useMemo(() => Array.from(new Set(banks.filter(Boolean))), [banks]);
  const defaultBank = bankOptions[0] || "";
  const [activityState, setActivityState] = useState<{
    activity: CashReserveRecentActivityPage;
    query: ActivityQueryState;
  } | null>(null);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<AddEntryValues>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      bank: defaultBank,
      entryType: "credit",
      note: "",
    },
  });

  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const snapshotMonths = useMemo(() => [...initialData.months].reverse(), [initialData.months]);
  const trendMonths = useMemo(
    () =>
      initialData.months.map((month) => ({
        ...month,
        debits: -month.debits,
      })),
    [initialData.months]
  );
  const trendAxisExtent = useMemo(() => {
    const maxMovement = initialData.months.reduce((max, month) => {
      return Math.max(max, month.credits, month.debits);
    }, 0);

    return maxMovement > 0 ? maxMovement : 1;
  }, [initialData.months]);
  const selectedEntryType = useWatch({
    control,
    name: "entryType",
  });
  const trendUp = initialData.monthOverMonthChangeAmount >= 0;
  const trendPctLabel = `${trendUp ? "+" : ""}${initialData.monthOverMonthChangePct.toFixed(1)}%`;
  const trendAmountLabel = `${trendUp ? "+" : "-"}${formatter.format(
    Math.abs(initialData.monthOverMonthChangeAmount)
  )}`;
  const activity = activityState?.activity ?? initialData.recentActivity;
  const activityQuery = activityState?.query ?? createActivityQueryState(initialData.recentActivity);
  const hasActivityInteraction = activityState !== null;
  const hasActivityFilters = Boolean(
    activityQuery.month || activityQuery.year || activityQuery.date || activityQuery.entryType !== "all"
  );
  const activityRangeStart = activity.totalCount ? (activity.page - 1) * activity.pageSize + 1 : 0;
  const activityRangeEnd = activity.totalCount ? activityRangeStart + activity.entries.length - 1 : 0;

  useEffect(() => {
    if (!hasActivityInteraction) {
      return;
    }

    const controller = new AbortController();

    async function loadActivity() {
      const params = new URLSearchParams({
        page: String(activityQuery.page),
        pageSize: "10",
      });

      if (activityQuery.month) {
        params.set("month", activityQuery.month);
      }

      if (activityQuery.year) {
        params.set("year", activityQuery.year);
      }

      if (activityQuery.date) {
        params.set("date", activityQuery.date);
      }

      if (activityQuery.entryType !== "all") {
        params.set("entryType", activityQuery.entryType);
      }

      setIsActivityLoading(true);

      try {
        const response = await fetch(`/api/cash-reserves?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => null)) as
          | { activity?: CashReserveRecentActivityPage; message?: string }
          | null;

        if (!response.ok || !result?.activity) {
          throw new Error(result?.message || "Unable to load recent activity.");
        }

        const nextActivity = result.activity;

        setActivityState((current) => ({
          activity: nextActivity,
          query: current?.query ?? activityQuery,
        }));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        toast.error(error instanceof Error ? error.message : "Unable to load recent activity.");
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
  }, [
    hasActivityInteraction,
    activityQuery,
  ]);

  async function onSubmit(values: AddEntryValues) {
    const response = await fetch("/api/cash-reserves", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: values.date,
        amount: Number(values.amount),
        bank: values.bank,
        entryType: values.entryType,
        note: values.note,
      }),
    });

    const result = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      toast.error(result?.message || "Unable to save cash reserve entry.");
      return;
    }

    toast.success(result?.message || "Cash reserve entry added.");
    reset({
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      bank: defaultBank,
      entryType: "credit",
      note: "",
    });
    setIsModalOpen(false);
    setActivityState(null);
    setIsActivityLoading(false);

    startTransition(() => {
      router.refresh();
    });
  }

  function updateActivityQuery(updater: (current: ActivityQueryState) => ActivityQueryState) {
    setActivityState((current) => ({
      activity: current?.activity ?? initialData.recentActivity,
      query: updater(current?.query ?? createActivityQueryState(initialData.recentActivity)),
    }));
  }

  function resetActivityFilters() {
    updateActivityQuery(() => ({
      page: 1,
      month: "",
      year: "",
      date: "",
      entryType: "all",
    }));
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
          <section className="min-w-0 rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-500">Total Cash Reserve</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.35rem]">
                  {formatter.format(initialData.totalBalance)}
                </h2>
                <div
                  className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
                    trendUp
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {trendUp ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                  <span>{trendPctLabel}</span>
                  <span className="text-current/70">vs last month</span>
                </div>
              </div>

              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() => setIsModalOpen(true)}
                type="button"
              >
                <Plus className="size-4" />
                <span>Add Entry</span>
              </button>
            </div>
          </section>

          <SummaryCard
            icon={<Wallet className="size-5 text-neutral-950" />}
            subtitle="Movement This Month"
            title={trendAmountLabel}
            tone={trendUp ? "positive" : "negative"}
          />

          <SummaryCard
            icon={<Landmark className="size-5 text-neutral-950" />}
            subtitle="6-Month Average"
            title={formatter.format(getAverageBalance(initialData.months))}
            tone="neutral"
          />
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Money Distribution by Bank</h3>
              <p className="mt-1 text-sm text-neutral-500">Current reserve balance split across selected banks.</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-500">Total Money in Reserves</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                {formatter.format(initialData.totalBalance)}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {initialData.bankDistribution.length ? (
              initialData.bankDistribution.map((entry) => (
                <div
                  className="rounded-[1.25rem] border border-[#eef2f7] bg-[#fafaf8] p-4"
                  key={entry.bank}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-semibold text-neutral-950">{entry.bank}</p>
                    <p
                      className={`shrink-0 text-sm font-semibold ${
                        entry.balance >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {formatter.format(entry.balance)}
                    </p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf3]">
                    <div
                      className={entry.balance >= 0 ? "h-full rounded-full bg-[#111111]" : "h-full rounded-full bg-rose-500"}
                      style={{ width: `${Math.min(entry.percentage, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">{entry.percentage.toFixed(1)}% of reserve total</p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#d9dfeb] bg-[#fafaf8] px-5 py-8 text-center text-sm text-neutral-500 md:col-span-2 xl:col-span-3">
                No bank distribution yet. Add a cash reserve entry with a bank to see the split.
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Monthly Snapshot</h3>
                <p className="mt-1 text-sm text-neutral-500">Credits, debits, and closing balance.</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#eef2f7]">
              <table className="min-w-full text-left">
                <thead className="bg-[#fafaf8] text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Credit</th>
                    <th className="px-4 py-3">Debit</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef2f7] bg-white">
                  {snapshotMonths.map((month) => (
                    <tr key={month.key} className="text-sm text-neutral-700">
                      <td className="px-4 py-3 font-medium text-neutral-950">{month.label}</td>
                      <td className="px-4 py-3 text-emerald-600">{formatter.format(month.credits)}</td>
                      <td className="px-4 py-3 text-rose-600">{formatter.format(month.debits)}</td>
                      <td className="px-4 py-3 font-medium text-neutral-950">
                        {formatter.format(month.closingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Reserve Trend</h3>
                <p className="mt-1 text-sm text-neutral-500">Monthly credit and debit totals for the last 6 months.</p>
              </div>
            </div>

            <div className="mt-6 h-[21rem] min-h-[21rem] min-w-0">
              <ResponsiveContainer minHeight={336} minWidth={0} width="100%" height="100%">
                <BarChart data={trendMonths} barCategoryGap={18} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                    domain={[-trendAxisExtent, trendAxisExtent]}
                    tickFormatter={(value) => compactCurrency(Math.abs(Number(value) || 0), formatter)}
                    tickLine={false}
                    width={64}
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
                      formatter.format(Math.abs(Number(value) || 0)),
                      name === "credits" ? "Credit" : "Debit",
                    ]}
                    labelStyle={{ color: "var(--wc-tooltip-text)", fontWeight: 600 }}
                  />
                  <Bar dataKey="credits" fill="#16a34a" name="credits" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="debits" fill="#dc2626" name="debits" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Recent Activity</h3>
              <p className="mt-1 text-sm text-neutral-500">Filter and review cash reserve activity in pages of 10.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[0.9fr_0.9fr_1.1fr_0.9fr_auto]">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Month</span>
              <select
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                onChange={(event) => {
                  const value = event.target.value;

                  updateActivityQuery((current) => ({
                    ...current,
                    page: 1,
                    month: value,
                    date: "",
                  }));
                }}
                value={activityQuery.month}
              >
                <option value="">All months</option>
                {MONTH_FILTER_OPTIONS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Year</span>
              <select
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                onChange={(event) => {
                  const value = event.target.value;

                  updateActivityQuery((current) => ({
                    ...current,
                    page: 1,
                    year: value,
                    date: "",
                  }));
                }}
                value={activityQuery.year}
              >
                <option value="">All years</option>
                {activity.availableYears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Date</span>
              <input
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => {
                  const value = event.target.value;

                  updateActivityQuery((current) => ({
                    ...current,
                    page: 1,
                    date: value,
                    month: value ? "" : current.month,
                    year: value ? "" : current.year,
                  }));
                }}
                type="date"
                value={activityQuery.date}
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Type</span>
              <select
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                onChange={(event) => {
                  const value = event.target.value as ActivityQueryState["entryType"];

                  updateActivityQuery((current) => ({
                    ...current,
                    page: 1,
                    entryType: value,
                  }));
                }}
                value={activityQuery.entryType}
              >
                <option value="all">All types</option>
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!hasActivityFilters && activity.page === 1}
                onClick={resetActivityFilters}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500">
            <p>
              {activity.totalCount
                ? `Showing ${activityRangeStart}-${activityRangeEnd} of ${activity.totalCount} entries`
                : "No entries to show"}
            </p>
            {isActivityLoading ? <p>Loading activity...</p> : null}
          </div>

          <div className="mt-5 grid gap-3">
            {activity.entries.length ? (
              activity.entries.map((entry) => {
                const positive = entry.entryType === "credit";

                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-[1.4rem] border border-[#eef2f7] bg-[#fafaf8] px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-neutral-950">
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(entry.date))}
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {positive ? "Credit entry added to reserve" : "Debit entry recorded from reserve"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="rounded-full bg-white px-2.5 py-1 font-medium text-neutral-600">
                          {entry.bank}
                        </span>
                        <button
                          className="inline-flex items-center gap-1 rounded-full border border-[#dbe2ee] bg-white px-2.5 py-1 font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!entry.note}
                          onClick={() => setNoteEntry(entry)}
                          type="button"
                        >
                          <Eye className="size-3.5" />
                          <span>{entry.note ? "View note" : "No note"}</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={`text-base font-semibold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                        {positive ? "+" : "-"}
                        {formatter.format(entry.amount)}
                      </p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-neutral-400">
                        {entry.entryType}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-[#d9dfeb] bg-[#fafaf8] px-5 py-10 text-center text-sm text-neutral-500">
                {hasActivityFilters
                  ? "No cash reserve entries match the selected filters."
                  : "No cash reserve entries yet. Add your first credit or debit to start tracking."}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              className="rounded-[1rem] border border-[#dbe2ee] px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={activity.page <= 1 || isActivityLoading}
              onClick={() => {
                updateActivityQuery((current) => ({
                  ...current,
                  page: Math.max(1, current.page - 1),
                }));
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
                updateActivityQuery((current) => ({
                  ...current,
                  page: Math.min(activity.totalPages, current.page + 1),
                }));
              }}
              type="button"
            >
              Next
            </button>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
          <div className="max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Add Cash Entry</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Save a credit or debit entry against your reserve balance.
                </p>
              </div>
              <button
                className="rounded-full px-3 py-1 text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => {
                  setIsModalOpen(false);
                  reset();
                }}
                type="button"
              >
                Close
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Date</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  max={new Date().toISOString().slice(0, 10)}
                  type="date"
                  {...register("date", {
                    required: "Date is required.",
                  })}
                />
                {errors.date ? <span className="text-sm text-destructive">{errors.date.message}</span> : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Bank</span>
                <select
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition focus:border-[#111111] focus:ring-3 focus:ring-black/5 disabled:bg-[#f7f7f5] disabled:text-neutral-400"
                  disabled={!bankOptions.length}
                  {...register("bank", {
                    required: "Bank is required.",
                  })}
                >
                  {bankOptions.length ? (
                    bankOptions.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))
                  ) : (
                    <option value="">Add banks in Settings first</option>
                  )}
                </select>
                {errors.bank ? <span className="text-sm text-destructive">{errors.bank.message}</span> : null}
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Amount</span>
                <input
                  className="h-[3rem] w-full rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="25000"
                  step="0.01"
                  type="number"
                  {...register("amount", {
                    required: "Amount is required.",
                    validate: (value) =>
                      Number(value) > 0 || "Amount must be greater than zero.",
                  })}
                />
                {errors.amount ? <span className="text-sm text-destructive">{errors.amount.message}</span> : null}
              </label>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-neutral-800">Entry Type</legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="cursor-pointer">
                    <input
                      className="sr-only"
                      type="radio"
                      value="credit"
                      {...register("entryType", {
                        required: "Entry type is required.",
                      })}
                    />
                    <div
                      className={`rounded-[1rem] border px-4 py-3 text-sm font-semibold transition ${
                        selectedEntryType === "credit"
                          ? "border-emerald-400 bg-emerald-100 text-emerald-800 shadow-sm"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      Credit
                    </div>
                  </label>

                  <label className="cursor-pointer">
                    <input
                      className="sr-only"
                      type="radio"
                      value="debit"
                      {...register("entryType", {
                        required: "Entry type is required.",
                      })}
                    />
                    <div
                      className={`rounded-[1rem] border px-4 py-3 text-sm font-semibold transition ${
                        selectedEntryType === "debit"
                          ? "border-rose-400 bg-rose-100 text-rose-800 shadow-sm"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      }`}
                    >
                      Debit
                    </div>
                  </label>
                </div>
                {errors.entryType ? (
                  <span className="text-sm text-destructive">{errors.entryType.message}</span>
                ) : null}
              </fieldset>

              <label className="block space-y-2">
                <span className="text-sm font-medium text-neutral-800">Note</span>
                <textarea
                  className="min-h-24 w-full resize-none rounded-[1rem] border border-[#dbe2ee] bg-white px-3.5 py-3 text-[0.95rem] text-neutral-900 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-[#111111] focus:ring-3 focus:ring-black/5"
                  placeholder="Add a short note for this transaction"
                  {...register("note", {
                    maxLength: {
                      value: 500,
                      message: "Note must be 500 characters or fewer.",
                    },
                  })}
                />
                {errors.note ? <span className="text-sm text-destructive">{errors.note.message}</span> : null}
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  className="rounded-[1rem] border border-[#dbe2ee] px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                  onClick={() => {
                    setIsModalOpen(false);
                    reset();
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="rounded-[1rem] bg-[#111111] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting || isPending || !isDirty || !bankOptions.length}
                  type="submit"
                >
                  {isSubmitting || isPending ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {noteEntry ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setNoteEntry(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-[1.5rem] border border-[#e6ebf2] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#eef2f7] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-neutral-950">Transaction Note</h3>
                <p className="mt-1 text-sm text-neutral-500">{noteEntry.bank}</p>
              </div>
              <button
                aria-label="Close note"
                className="rounded-xl p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
                onClick={() => setNoteEntry(null)}
                type="button"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-[1rem] border border-[#eef2f7] bg-[#fafaf8] p-4 text-sm leading-6 text-neutral-700">
                {noteEntry.note}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "positive" | "negative" | "neutral";
}) {
  const accent =
    tone === "positive"
      ? "bg-emerald-50"
      : tone === "negative"
        ? "bg-rose-50"
        : "bg-[#f2f5ef]";

  return (
    <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`flex size-14 items-center justify-center rounded-2xl ${accent}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">{subtitle}</p>
          <p className="mt-2 text-[1.75rem] font-semibold tracking-tight text-neutral-950">{title}</p>
        </div>
      </div>
    </section>
  );
}

function createCurrencyFormatter(currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode || "USD",
      maximumFractionDigits: 0,
    });
  } catch {
    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
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

function getAverageBalance(months: CashReserveDashboardData["months"]) {
  if (!months.length) {
    return 0;
  }

  const total = months.reduce((sum, month) => sum + month.closingBalance, 0);
  return total / months.length;
}

function createActivityQueryState(activity: CashReserveRecentActivityPage): ActivityQueryState {
  return {
    page: activity.page,
    month: activity.filters.month ? String(activity.filters.month) : "",
    year: activity.filters.year ? String(activity.filters.year) : "",
    date: activity.filters.date || "",
    entryType: activity.filters.entryType,
  };
}
