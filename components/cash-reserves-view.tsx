"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Landmark, Plus, Wallet } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";

import type { CashReserveDashboardData, CashReserveEntryType } from "@/lib/cash-reserves.types";

type CashReservesViewProps = {
  currencyCode: string;
  initialData: CashReserveDashboardData;
};

type AddEntryValues = {
  date: string;
  amount: string;
  entryType: CashReserveEntryType;
};

export function CashReservesView({ currencyCode, initialData }: CashReservesViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
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
      entryType: "credit",
    },
  });

  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const selectedEntryType = useWatch({
    control,
    name: "entryType",
  });
  const trendUp = initialData.monthOverMonthChangeAmount >= 0;
  const trendPctLabel = `${trendUp ? "+" : ""}${initialData.monthOverMonthChangePct.toFixed(1)}%`;
  const trendAmountLabel = `${trendUp ? "+" : "-"}${formatter.format(
    Math.abs(initialData.monthOverMonthChangeAmount)
  )}`;

  async function onSubmit(values: AddEntryValues) {
    const response = await fetch("/api/cash-reserves", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        date: values.date,
        amount: Number(values.amount),
        entryType: values.entryType,
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
      entryType: "credit",
    });
    setIsModalOpen(false);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr_0.9fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
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
                  {initialData.months.map((month) => (
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
                <p className="mt-1 text-sm text-neutral-500">Closing balance for the last 6 months.</p>
              </div>
            </div>

            <div className="mt-6 h-[21rem]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={initialData.months} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashReserveFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#111111" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#111111" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e8edf4" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    tick={{ fill: "#8a95a5", fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "#8a95a5", fontSize: 12 }}
                    tickFormatter={(value: number) => compactCurrency(value, formatter)}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e6ebf2",
                      borderRadius: "16px",
                      boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
                    }}
                    formatter={(value: number) => formatter.format(value)}
                    labelStyle={{ color: "#111111", fontWeight: 600 }}
                  />
                  <Area
                    dataKey="closingBalance"
                    fill="url(#cashReserveFill)"
                    fillOpacity={1}
                    stroke="#111111"
                    strokeWidth={3}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Recent Activity</h3>
              <p className="mt-1 text-sm text-neutral-500">Most recent cash reserve entries.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {initialData.recentEntries.length ? (
              initialData.recentEntries.map((entry) => {
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
                No cash reserve entries yet. Add your first credit or debit to start tracking.
              </div>
            )}
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
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
                  disabled={isSubmitting || isPending || !isDirty}
                  type="submit"
                >
                  {isSubmitting || isPending ? "Saving..." : "Save Entry"}
                </button>
              </div>
            </form>
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
