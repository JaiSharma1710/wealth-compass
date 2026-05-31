"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleAlert,
  Landmark,
  LoaderCircle,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import type {
  ExpenseDashboardData,
  ExpenseEntrySummary,
  ExpenseHistoryGranularity,
  ExpenseWindowSummary,
} from "@/lib/expenses.types";

type ExpensesViewProps = {
  currencyCode: string;
  initialData: ExpenseDashboardData;
};

type BudgetFormValues = {
  amount: string;
};

type EntryFormValues = {
  amount: string;
  note: string;
  occurredAt: string;
};

export function ExpensesView({ currencyCode, initialData }: ExpensesViewProps) {
  const [dashboardData, setDashboardData] = useState(initialData);
  const [historyGranularity, setHistoryGranularity] = useState<ExpenseHistoryGranularity>("daily");
  const [activeModal, setActiveModal] = useState<"budget" | "expense" | "credit" | null>(
    initialData.budget.isRequired ? "budget" : null
  );
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isBudgetSaving, setIsBudgetSaving] = useState(false);
  const [isEntrySaving, setIsEntrySaving] = useState(false);
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const historyData = dashboardData.history[historyGranularity];
  const budgetRequired = dashboardData.budget.isRequired;
  const {
    register: registerBudget,
    handleSubmit: handleBudgetSubmit,
    reset: resetBudget,
    formState: { errors: budgetErrors },
  } = useForm<BudgetFormValues>({
    defaultValues: {
      amount: dashboardData.budget.amount != null ? String(dashboardData.budget.amount) : "",
    },
  });
  const {
    register: registerEntry,
    handleSubmit: handleEntrySubmit,
    reset: resetEntry,
    formState: { errors: entryErrors },
  } = useForm<EntryFormValues>({
    defaultValues: {
      amount: "",
      note: "",
      occurredAt: dashboardData.defaultOccurredAt,
    },
  });

  useEffect(() => {
    resetBudget({
      amount: dashboardData.budget.amount != null ? String(dashboardData.budget.amount) : "",
    });
  }, [dashboardData.budget.amount, resetBudget]);

  async function loadDashboard(page: number) {
    setIsDashboardLoading(true);

    try {
      const response = await fetch(`/api/expenses?page=${page}`, {
        cache: "no-store",
      });
      const result = (await response.json().catch(() => null)) as
        | { dashboard?: ExpenseDashboardData; message?: string }
        | null;

      if (!response.ok || !result?.dashboard) {
        throw new Error(result?.message || "Unable to load expense tracker data.");
      }

      const dashboard = result.dashboard;

      setDashboardData(dashboard);
      setActiveModal((current) =>
        dashboard.budget.isRequired ? "budget" : current === "budget" ? null : current
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to load expense tracker data."
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }

  async function onSaveBudget(values: BudgetFormValues) {
    setIsBudgetSaving(true);

    try {
      const response = await fetch("/api/expenses/budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(values.amount),
          startYear: dashboardData.cycle.startYear,
          startMonth: dashboardData.cycle.startMonth,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { dashboard?: ExpenseDashboardData; message?: string }
        | null;

      if (!response.ok || !result?.dashboard) {
        throw new Error(result?.message || "Unable to save budget.");
      }

      setDashboardData(result.dashboard);
      setActiveModal(null);
      toast.success(result.message || "Budget saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save budget.");
    } finally {
      setIsBudgetSaving(false);
    }
  }

  async function onSaveEntry(values: EntryFormValues) {
    if (activeModal !== "expense" && activeModal !== "credit") {
      return;
    }

    setIsEntrySaving(true);

    try {
      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryType: activeModal,
          amount: Number(values.amount),
          note: values.note,
          occurredAt: values.occurredAt,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { dashboard?: ExpenseDashboardData; message?: string }
        | null;

      if (!response.ok || !result?.dashboard) {
        if (response.status === 400 && /budget/i.test(result?.message || "")) {
          setActiveModal("budget");
        }

        throw new Error(result?.message || "Unable to save entry.");
      }

      setDashboardData(result.dashboard);
      setActiveModal(null);
      resetEntry({
        amount: "",
        note: "",
        occurredAt: result.dashboard.defaultOccurredAt,
      });
      toast.success(result.message || "Entry saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save entry.");
    } finally {
      setIsEntrySaving(false);
    }
  }

  function openEntryModal(type: "expense" | "credit") {
    if (dashboardData.budget.isRequired) {
      setActiveModal("budget");
      return;
    }

    resetEntry({
      amount: "",
      note: "",
      occurredAt: dashboardData.defaultOccurredAt,
    });
    setActiveModal(type);
  }

  function closeModal() {
    setActiveModal(null);
  }

  const rangeStart = dashboardData.entriesPage.totalCount
    ? (dashboardData.entriesPage.page - 1) * dashboardData.entriesPage.pageSize + 1
    : 0;
  const rangeEnd = dashboardData.entriesPage.totalCount
    ? rangeStart + dashboardData.entriesPage.entries.length - 1
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[90rem] flex-col gap-6">
        {budgetRequired ? (
          <section className="rounded-[1.75rem] border border-[#f4d6a0] bg-[#fff8eb] p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#8a6120]" />
                <div>
                  <h2 className="text-base font-semibold text-[#7f5618]">
                    Budget required for this cycle
                  </h2>
                  <p className="mt-1 text-sm text-[#8a6120]">
                    Set the budget for {dashboardData.cycle.label} before adding any new expense or
                    credit. This cycle runs from {formatDateOnly(dashboardData.cycle.startDate)} to{" "}
                    {formatDateOnly(dashboardData.cycle.endDate)}.
                  </p>
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                onClick={() => setActiveModal("budget")}
                type="button"
              >
                Set cycle budget
              </button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Current Cycle Budget</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-[2.35rem]">
                  {dashboardData.budget.amount != null
                    ? formatter.format(dashboardData.budget.amount)
                    : "Not set"}
                </h2>
                <p className="mt-2 text-sm text-neutral-500">
                  {dashboardData.cycle.label} cycle • {formatDateOnly(dashboardData.cycle.startDate)} to{" "}
                  {formatDateOnly(dashboardData.cycle.endDate)}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#eef6ff] px-3 py-1 text-sm font-medium text-[#23569a]">
                  <Wallet className="size-4" />
                  <span>{dashboardData.cycle.elapsedDays}</span>
                  <span className="text-current/75">days elapsed in this cycle</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={budgetRequired}
                  onClick={() => openEntryModal("expense")}
                  type="button"
                >
                  <Plus className="size-4" />
                  <span>Add Expense</span>
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={budgetRequired}
                  onClick={() => openEntryModal("credit")}
                  type="button"
                >
                  <Plus className="size-4" />
                  <span>Add Credit</span>
                </button>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#dbe2ee] bg-white px-4 py-2.5 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50"
                  onClick={() => setActiveModal("budget")}
                  type="button"
                >
                  <Landmark className="size-4" />
                  <span>{dashboardData.budget.hasBudget ? "Update Budget" : "Set Budget"}</span>
                </button>
              </div>
            </div>
          </section>

          <MetricCard
            accent={dashboardData.cycleSummary.expenseTotal > 0 ? "negative" : "neutral"}
            label="Cycle Spend"
            value={formatter.format(dashboardData.cycleSummary.expenseTotal)}
          />
          <MetricCard
            accent={
              dashboardData.health.remainingBudget != null && dashboardData.health.remainingBudget < 0
                ? "negative"
                : "positive"
            }
            label="Remaining Budget"
            value={
              dashboardData.health.remainingBudget != null
                ? formatSignedCurrency(dashboardData.health.remainingBudget, formatter)
                : "Set budget"
            }
          />
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Budget Health
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Based on the remaining cycle budget and your current daily burn pace.
              </p>
            </div>
            <HealthPill dashboardData={dashboardData} formatter={formatter} />
          </div>

          {dashboardData.health.status === "needs_budget" ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#d9e3f0] bg-[#f8fbff] p-6 text-center">
              <p className="text-sm font-semibold text-[#203553]">Set this cycle budget first</p>
              <p className="mt-2 text-sm text-[#70819a]">
                Once the budget is saved, we&apos;ll calculate your projected cycle spend, expected
                daily allowance, and whether you&apos;re pacing above or below it.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                accent="neutral"
                label="Avg Daily Expense"
                value={formatter.format(dashboardData.health.averageDailyExpense)}
              />
              <MetricCard
                accent="neutral"
                label="Expected Daily Expense"
                value={
                  dashboardData.health.expectedDailyExpense != null
                    ? formatter.format(dashboardData.health.expectedDailyExpense)
                    : "Unavailable"
                }
              />
              <MetricCard
                accent={
                  dashboardData.health.status === "over_budget" ? "negative" : "positive"
                }
                label="Projected Cycle Spend"
                value={formatter.format(dashboardData.health.projectedCycleSpend)}
              />
              <MetricCard
                accent={
                  dashboardData.health.status === "over_budget" ||
                  dashboardData.health.isOverExpectedDaily
                    ? "negative"
                    : "positive"
                }
                label="Pace Check"
                value={
                  dashboardData.health.status === "over_budget"
                    ? `Over by ${formatter.format(dashboardData.health.overshootAmount)}`
                    : dashboardData.health.isOverExpectedDaily
                      ? "Above target"
                      : "Below target"
                }
              />
            </div>
          )}
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <WindowSummaryCard formatter={formatter} summary={dashboardData.todaySummary} />
          <WindowSummaryCard formatter={formatter} summary={dashboardData.weekSummary} />
          <WindowSummaryCard formatter={formatter} summary={dashboardData.cycleSummary} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                  Spend History
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Toggle daily, weekly, and cycle-month views.
                </p>
              </div>

              <div className="inline-flex rounded-2xl border border-[#dbe2ee] bg-[#f7f9fc] p-1">
                {(["daily", "weekly", "monthly"] as ExpenseHistoryGranularity[]).map((value) => (
                  <button
                    key={value}
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      historyGranularity === value
                        ? "bg-white text-neutral-950 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                    onClick={() => setHistoryGranularity(value)}
                    type="button"
                  >
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {historyData.length ? (
              <div className="mt-6 h-[18rem]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#e7edf5" strokeDasharray="4 4" vertical={false} />
                    <XAxis
                      axisLine={false}
                      dataKey="label"
                      tick={{ fill: "#8693a8", fontSize: 12 }}
                      tickLine={false}
                    />
                    <YAxis
                      axisLine={false}
                      tick={{ fill: "#8693a8", fontSize: 12 }}
                      tickFormatter={(value: number) => compactCurrency(value)}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => (
                        <ExpenseHistoryTooltip {...props} currencyFormatter={formatter} />
                      )}
                    />
                    <Bar dataKey="expenseTotal" fill="#ef4444" name="expenseTotal" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="creditTotal" fill="#16a34a" name="creditTotal" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#d9e3f0] bg-[#f8fbff] p-6 text-center text-sm text-[#70819a]">
                Add your first entry to start building spend history.
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950">Cycle Snapshot</h3>
            <p className="mt-1 text-sm text-neutral-500">
              Quick signals for how the current 5th-to-4th cycle is tracking.
            </p>

            <div className="mt-6 space-y-4">
              <InsightRow
                label="Cycle expenses"
                value={formatter.format(dashboardData.cycleSummary.expenseTotal)}
                tone="negative"
              />
              <InsightRow
                label="Cycle credits"
                value={formatter.format(dashboardData.cycleSummary.creditTotal)}
                tone="positive"
              />
              <InsightRow
                label="Net cash movement"
                value={formatSignedCurrency(dashboardData.cycleSummary.netTotal, formatter)}
                tone={dashboardData.cycleSummary.netTotal >= 0 ? "positive" : "negative"}
              />
              <InsightRow
                label="Days left in cycle"
                value={String(dashboardData.cycle.remainingDaysIncludingToday)}
                tone="neutral"
              />
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-neutral-950">
                Recent Entries
              </h3>
              <p className="mt-1 text-sm text-neutral-500">
                Showing {rangeStart}-{rangeEnd} of {dashboardData.entriesPage.totalCount} entries.
              </p>
            </div>
            {isDashboardLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
                <LoaderCircle className="size-4 animate-spin" />
                Loading
              </div>
            ) : null}
          </div>

          {dashboardData.entriesPage.entries.length ? (
            <>
              <div className="mt-6 grid gap-3 md:hidden">
                {dashboardData.entriesPage.entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} formatter={formatter} />
                ))}
              </div>

              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e6ebf2] text-left text-[#70819a]">
                      <th className="pb-3 pr-4 font-medium">Type</th>
                      <th className="pb-3 pr-4 font-medium">Amount</th>
                      <th className="pb-3 pr-4 font-medium">Date & Time</th>
                      <th className="pb-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.entriesPage.entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-[#edf2f8] align-top last:border-b-0">
                        <td className="py-4 pr-4">
                          <EntryTypePill entryType={entry.entryType} />
                        </td>
                        <td className="py-4 pr-4 font-semibold text-neutral-950">
                          {formatter.format(entry.amount)}
                        </td>
                        <td className="py-4 pr-4 text-neutral-600">{formatDateTime(entry.occurredAt)}</td>
                        <td className="py-4 text-neutral-600">
                          {entry.note ? entry.note : <span className="text-neutral-400">No note</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dashboardData.entriesPage.totalPages > 1 ? (
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-neutral-500">
                    Page {dashboardData.entriesPage.page} of {dashboardData.entriesPage.totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-2xl border border-[#dbe2ee] px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={dashboardData.entriesPage.page === 1 || isDashboardLoading}
                      onClick={() => void loadDashboard(dashboardData.entriesPage.page - 1)}
                      type="button"
                    >
                      Previous
                    </button>
                    <button
                      className="rounded-2xl border border-[#dbe2ee] px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        dashboardData.entriesPage.page === dashboardData.entriesPage.totalPages ||
                        isDashboardLoading
                      }
                      onClick={() => void loadDashboard(dashboardData.entriesPage.page + 1)}
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-[#d9e3f0] bg-[#f8fbff] p-6 text-center text-sm text-[#70819a]">
              No expense or credit entries yet.
            </div>
          )}
        </section>
      </div>

      {activeModal === "budget" ? (
        <ModalFrame
          title={`Set Budget • ${dashboardData.cycle.label}`}
          onClose={budgetRequired ? undefined : closeModal}
        >
          <form className="space-y-5" onSubmit={handleBudgetSubmit(onSaveBudget)}>
            <div className="rounded-2xl border border-[#e6ebf2] bg-[#f8fbff] px-4 py-3 text-sm text-[#607089]">
              This budget will cover {formatDateOnly(dashboardData.cycle.startDate)} to{" "}
              {formatDateOnly(dashboardData.cycle.endDate)}.
            </div>
            <Field error={budgetErrors.amount?.message} label="Cycle Budget">
              <input
                {...registerBudget("amount", {
                  required: "Budget amount is required.",
                  validate: (value) =>
                    Number(value) > 0 || "Budget amount must be greater than zero.",
                })}
                className={inputClassName}
                inputMode="decimal"
                placeholder="0.00"
                type="number"
              />
            </Field>
            <ModalActions
              isSubmitting={isBudgetSaving}
              onCancel={budgetRequired ? undefined : closeModal}
              submitLabel="Save Budget"
            />
          </form>
        </ModalFrame>
      ) : null}

      {activeModal === "expense" || activeModal === "credit" ? (
        <ModalFrame
          title={activeModal === "expense" ? "Add Expense" : "Add Credit"}
          onClose={closeModal}
        >
          <form className="space-y-5" onSubmit={handleEntrySubmit(onSaveEntry)}>
            <Field error={entryErrors.amount?.message} label="Amount">
              <input
                {...registerEntry("amount", {
                  required: "Amount is required.",
                  validate: (value) => Number(value) > 0 || "Amount must be greater than zero.",
                })}
                className={inputClassName}
                inputMode="decimal"
                placeholder="0.00"
                type="number"
              />
            </Field>
            <Field error={entryErrors.occurredAt?.message} label="Date & Time (IST)">
              <input
                {...registerEntry("occurredAt", {
                  required: "Date and time are required.",
                })}
                className={inputClassName}
                type="datetime-local"
              />
            </Field>
            <Field error={entryErrors.note?.message} label="Note">
              <textarea
                {...registerEntry("note", {
                  maxLength: {
                    value: 500,
                    message: "Note must be 500 characters or fewer.",
                  },
                })}
                className={`${inputClassName} min-h-28 resize-none`}
                placeholder="Optional note"
              />
            </Field>
            <ModalActions
              isSubmitting={isEntrySaving}
              onCancel={closeModal}
              submitLabel={activeModal === "expense" ? "Save Expense" : "Save Credit"}
            />
          </form>
        </ModalFrame>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "positive" | "negative" | "neutral";
}) {
  const accentClass =
    accent === "positive"
      ? "text-[#15803d] bg-[#edf9f0]"
      : accent === "negative"
        ? "text-[#b91c1c] bg-[#fff1f2]"
        : "text-[#1f3b63] bg-[#eff5ff]";

  return (
    <div className="rounded-[1.75rem] border border-[#e6ebf2] bg-white p-5 shadow-sm">
      <div className={`inline-flex rounded-2xl px-3 py-2 text-sm font-semibold ${accentClass}`}>
        {label}
      </div>
      <p
        className={`mt-4 text-3xl font-semibold tracking-tight ${
          accent === "positive"
            ? "text-[#15803d]"
            : accent === "negative"
              ? "text-[#b91c1c]"
              : "text-neutral-950"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function WindowSummaryCard({
  summary,
  formatter,
}: {
  summary: ExpenseWindowSummary;
  formatter: Intl.NumberFormat;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[#e6ebf2] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold tracking-tight text-neutral-950">{summary.label}</h3>
      <div className="mt-5 grid gap-3">
        <SummaryLine label="Expenses" tone="negative" value={formatter.format(summary.expenseTotal)} />
        <SummaryLine label="Credits" tone="positive" value={formatter.format(summary.creditTotal)} />
        <SummaryLine
          label="Net"
          tone={summary.netTotal >= 0 ? "positive" : "negative"}
          value={formatSignedCurrency(summary.netTotal, formatter)}
        />
        <SummaryLine label="Entries" tone="neutral" value={String(summary.entryCount)} />
      </div>
    </section>
  );
}

function SummaryLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-4 py-3">
      <span className="text-sm text-neutral-500">{label}</span>
      <span
        className={`text-sm font-semibold ${
          tone === "positive"
            ? "text-[#15803d]"
            : tone === "negative"
              ? "text-[#b91c1c]"
              : "text-neutral-950"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InsightRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[1.35rem] border border-[#eef2f7] bg-[#fafcff] px-4 py-3">
      <span className="text-sm text-neutral-500">{label}</span>
      <span
        className={`text-sm font-semibold ${
          tone === "positive"
            ? "text-[#15803d]"
            : tone === "negative"
              ? "text-[#b91c1c]"
              : "text-neutral-950"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function HealthPill({
  dashboardData,
  formatter,
}: {
  dashboardData: ExpenseDashboardData;
  formatter: Intl.NumberFormat;
}) {
  if (dashboardData.health.status === "needs_budget") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-[#fff8eb] px-3 py-1.5 text-sm font-medium text-[#8a6120]">
        <CircleAlert className="size-4" />
        <span>Budget needed to calculate health</span>
      </div>
    );
  }

  if (dashboardData.health.status === "over_budget") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-[#fff1f2] px-3 py-1.5 text-sm font-medium text-[#b91c1c]">
        <ArrowDownRight className="size-4" />
        <span>Projected overshoot: {formatter.format(dashboardData.health.overshootAmount)}</span>
      </div>
    );
  }

  if (dashboardData.health.status === "over_pace") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-[#fff8eb] px-3 py-1.5 text-sm font-medium text-[#8a6120]">
        <ArrowUpRight className="size-4" />
        <span>Daily spend is above target pace</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[#edf9f0] px-3 py-1.5 text-sm font-medium text-[#15803d]">
      <ArrowUpRight className="size-4" />
      <span>On track to stay within budget</span>
    </div>
  );
}

function EntryTypePill({ entryType }: { entryType: ExpenseEntrySummary["entryType"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
        entryType === "credit"
          ? "bg-[#edf9f0] text-[#15803d]"
          : "bg-[#fff1f2] text-[#b91c1c]"
      }`}
    >
      {entryType}
    </span>
  );
}

function ExpenseHistoryTooltip({
  active,
  payload,
  label,
  currencyFormatter,
}: TooltipContentProps<ValueType, NameType> & { currencyFormatter: Intl.NumberFormat }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#e6ebf2] bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-semibold text-neutral-950">{String(label || "")}</p>
      <div className="mt-2 space-y-1.5 text-sm">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
            <span className="text-neutral-500">
              {item.dataKey === "expenseTotal" ? "Expenses" : "Credits"}
            </span>
            <span className="font-semibold text-neutral-950">
              {currencyFormatter.format(Number(item.value || 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntryCard({
  entry,
  formatter,
}: {
  entry: ExpenseEntrySummary;
  formatter: Intl.NumberFormat;
}) {
  return (
    <div className="rounded-[1.5rem] border border-[#e6ebf2] bg-[#fcfdff] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <EntryTypePill entryType={entry.entryType} />
        <div
          className={`text-right text-base font-semibold ${
            entry.entryType === "credit" ? "text-[#15803d]" : "text-[#b91c1c]"
          }`}
        >
          {formatter.format(entry.amount)}
        </div>
      </div>
      <p className="mt-3 text-sm text-neutral-500">{formatDateTime(entry.occurredAt)}</p>
      <p className="mt-2 text-sm text-neutral-700">{entry.note || "No note"}</p>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-800">{label}</span>
      {children}
      {error ? <span className="mt-2 block text-xs text-[#b91c1c]">{error}</span> : null}
    </label>
  );
}

function ModalActions({
  onCancel,
  isSubmitting,
  submitLabel,
}: {
  onCancel?: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      {onCancel ? (
        <button
          className="rounded-2xl border border-[#dbe2ee] px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      ) : null}
      <button
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
        <span>{submitLabel}</span>
      </button>
    </div>
  );
}

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="w-full rounded-t-[2rem] border border-[#e6ebf2] bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.18)] sm:max-w-lg sm:rounded-[2rem]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-950">{title}</h2>
          {onClose ? (
            <button
              aria-label="Close modal"
              className="rounded-2xl border border-[#e6ebf2] p-2 text-neutral-500 transition hover:bg-neutral-50"
              onClick={onClose}
              type="button"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function createCurrencyFormatter(currencyCode: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  });
}

function formatSignedCurrency(value: number, formatter: Intl.NumberFormat) {
  return value >= 0 ? formatter.format(value) : `(${formatter.format(Math.abs(value))})`;
}

function compactCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

const inputClassName =
  "w-full rounded-2xl border border-[#d7e1f0] bg-white px-4 py-3 text-sm text-[#17304f] outline-none transition placeholder:text-[#96a1b5] focus:border-[#7fa7df] focus:ring-4 focus:ring-[#d9e9ff]";
