"use client";

import type { ComponentType, FormEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeIndianRupee,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Gauge,
  Plus,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import type { DebtLoanSummary, DebtLoanType, DebtPageData } from "@/lib/debt.types";

type DebtFormState = {
  name: string;
  lender: string;
  loanType: DebtLoanType;
  principalAmount: string;
  annualInterestRate: string;
  durationMonths: string;
  startDate: string;
  emiPaymentDay: string;
  plannedPrepaymentAmount: string;
  note: string;
};

const DEFAULT_FORM_STATE: DebtFormState = {
  name: "",
  lender: "",
  loanType: "standard",
  principalAmount: "",
  annualInterestRate: "",
  durationMonths: "",
  startDate: "",
  emiPaymentDay: "5",
  plannedPrepaymentAmount: "0",
  note: "",
};

export function DebtView({
  currencyCode,
  initialData,
}: {
  currencyCode: string;
  initialData: DebtPageData;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);
  const [formState, setFormState] = useState<DebtFormState>(DEFAULT_FORM_STATE);
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const repaymentProgress = initialData.overview.totalOriginalPrincipal
    ? Math.min(
        100,
        (initialData.overview.totalPaidPrincipal /
          initialData.overview.totalOriginalPrincipal) *
          100
      )
    : 0;

  async function handleCreateLoan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/debt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formState.name,
          lender: formState.lender,
          loanType: formState.loanType,
          principalAmount: Number(formState.principalAmount),
          annualInterestRate: formState.loanType === "no_cost_emi" ? 0 : Number(formState.annualInterestRate),
          durationMonths: Number(formState.durationMonths),
          startDate: formState.startDate,
          emiPaymentDay: Number(formState.emiPaymentDay),
          plannedPrepaymentAmount: Number(formState.plannedPrepaymentAmount || "0"),
          note: formState.note,
        }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to create loan.");
      }

      toast.success(result?.message || "Loan created.");
      setFormState(DEFAULT_FORM_STATE);
      setIsCreateModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create loan.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteLoan(loan: DebtLoanSummary) {
    const shouldDelete = window.confirm(`Delete the "${loan.name}" loan?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingLoanId(loan.id);

    try {
      const response = await fetch(`/api/debt?loanId=${encodeURIComponent(loan.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to delete loan.");
      }

      toast.success(result?.message || "Loan deleted.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete loan.");
    } finally {
      setDeletingLoanId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-3 sm:p-6">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-[#dce4f0] bg-white shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7c8aa5]">
                    Debt
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#10203a] sm:text-3xl">
                    Loans and EMI plan
                  </h2>
                </div>
                <button
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 text-sm font-semibold text-white transition hover:opacity-95 sm:w-auto"
                  onClick={() => setIsCreateModalOpen(true)}
                  type="button"
                >
                  <Plus className="size-4" />
                  Add loan
                </button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <DebtMiniStat
                  label="Original principal"
                  value={formatter.format(initialData.overview.totalOriginalPrincipal)}
                />
                <DebtMiniStat
                  label="Outstanding"
                  tone="danger"
                  value={formatter.format(initialData.overview.totalOutstandingPrincipal)}
                />
                <DebtMiniStat
                  label="Principal paid"
                  tone="success"
                  value={formatter.format(initialData.overview.totalPaidPrincipal)}
                />
              </div>
            </div>

            <div className="border-t border-[#e6ebf2] bg-[#f8fbff] p-5 sm:p-6 lg:border-l lg:border-t-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#51627d]">Repayment progress</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-[#132842]">
                    {repaymentProgress.toFixed(1)}%
                  </p>
                </div>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#173d7a] shadow-sm">
                  <Gauge className="size-5" />
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#dfe8f5]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#15803d_0%,#22c55e_100%)]"
                  style={{ width: `${Math.max(repaymentProgress, initialData.overview.totalLoans ? 4 : 0)}%` }}
                />
              </div>
              <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm text-[#566883] shadow-sm">
                <p className="font-semibold text-[#17304f]">
                  {initialData.overview.nextEmiDate
                    ? `Next EMI on ${formatDate(initialData.overview.nextEmiDate)}`
                    : "No pending EMI"}
                </p>
                <p className="mt-1">
                  {initialData.overview.nextEmiDate
                    ? formatter.format(initialData.overview.nextEmiAmount)
                    : "All visible loans are fully paid."}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <TopStat
            icon={CreditCard}
            label="Active Loans"
            value={String(initialData.overview.activeLoans)}
          />
          <TopStat
            icon={WalletCards}
            label="Outstanding Principal"
            value={formatter.format(initialData.overview.totalOutstandingPrincipal)}
          />
          <TopStat
            icon={Banknote}
            label="Paid So Far"
            value={formatter.format(initialData.overview.totalPaidAmount)}
          />
          <TopStat
            icon={CalendarClock}
            label="Next EMI"
            value={
              initialData.overview.nextEmiDate
                ? `${formatDate(initialData.overview.nextEmiDate)} • ${formatter.format(
                    initialData.overview.nextEmiAmount
                  )}`
                : "No pending EMI"
            }
          />
        </section>

        {initialData.loans.length ? (
          <section className="grid gap-4">
            {initialData.loans.map((loan) => (
              <LoanCard
                formatter={formatter}
                isDeleting={deletingLoanId === loan.id}
                isExpanded={expandedLoanId === loan.id}
                key={loan.id}
                loan={loan}
                onDelete={() => void handleDeleteLoan(loan)}
                onToggleDetails={() =>
                  setExpandedLoanId((current) => (current === loan.id ? null : loan.id))
                }
              />
            ))}
          </section>
        ) : (
          <section className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-dashed border-[#d8deea] bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="max-w-md">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f4f7fb] text-neutral-700">
                <CreditCard className="size-6" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">
                No loans yet
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Add home loans, personal loans, or no-cost EMIs to see outstanding debt,
                paid principal, interest, and the full repayment schedule.
              </p>
            </div>
          </section>
        )}

        {isCreateModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
            <button
              aria-label="Close create loan modal"
              className="absolute inset-0"
              onClick={() => setIsCreateModalOpen(false)}
              type="button"
            />
            <section className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-[#e6ebf2] bg-white shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
              <div className="flex items-start justify-between gap-4 border-b border-[#edf2f7] px-5 py-5 sm:px-6">
                <div>
                  <p className="text-sm font-medium text-neutral-500">Create Loan</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                    Build the EMI and prepayment plan
                  </h3>
                </div>
                <button
                  className="flex size-10 items-center justify-center rounded-2xl border border-[#e5e7eb] text-neutral-600 transition hover:text-neutral-950"
                  onClick={() => setIsCreateModalOpen(false)}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              </div>

              <form className="overflow-y-auto px-5 py-5 sm:px-6" onSubmit={handleCreateLoan}>
                <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Loan name">
                    <input
                      className={fieldClassName}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, name: event.target.value }))
                      }
                      placeholder="Home loan"
                      required
                      value={formState.name}
                    />
                  </Field>
                  <Field label="Bank / lender">
                    <input
                      className={fieldClassName}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, lender: event.target.value }))
                      }
                      placeholder="HDFC Bank"
                      required
                      value={formState.lender}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Loan type">
                    <select
                      className={fieldClassName}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          loanType: event.target.value as DebtLoanType,
                          annualInterestRate:
                            event.target.value === "no_cost_emi" ? "0" : current.annualInterestRate,
                        }))
                      }
                      value={formState.loanType}
                    >
                      <option value="standard">Standard loan</option>
                      <option value="no_cost_emi">No-cost EMI</option>
                    </select>
                  </Field>
                  <Field label="Loan amount">
                    <input
                      className={fieldClassName}
                      inputMode="decimal"
                      min="0.01"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          principalAmount: event.target.value,
                        }))
                      }
                      placeholder="1500000"
                      required
                      step="0.01"
                      type="number"
                      value={formState.principalAmount}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Interest rate">
                    <input
                      className={`${fieldClassName} disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-neutral-400`}
                      disabled={formState.loanType === "no_cost_emi"}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          annualInterestRate: event.target.value,
                        }))
                      }
                      placeholder="8.5"
                      required={formState.loanType === "standard"}
                      step="0.01"
                      type="number"
                      value={formState.loanType === "no_cost_emi" ? "0" : formState.annualInterestRate}
                    />
                  </Field>
                  <Field label="Duration months">
                    <input
                      className={fieldClassName}
                      inputMode="numeric"
                      min="1"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, durationMonths: event.target.value }))
                      }
                      placeholder="240"
                      required
                      step="1"
                      type="number"
                      value={formState.durationMonths}
                    />
                  </Field>
                  <Field label="EMI payment date">
                    <input
                      className={fieldClassName}
                      inputMode="numeric"
                      max="31"
                      min="1"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, emiPaymentDay: event.target.value }))
                      }
                      required
                      step="1"
                      type="number"
                      value={formState.emiPaymentDay}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Start date">
                    <input
                      className={fieldClassName}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, startDate: event.target.value }))
                      }
                      required
                      type="date"
                      value={formState.startDate}
                    />
                  </Field>
                  <Field label="Monthly prepayment">
                    <input
                      className={fieldClassName}
                      inputMode="decimal"
                      min="0"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          plannedPrepaymentAmount: event.target.value,
                        }))
                      }
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={formState.plannedPrepaymentAmount}
                    />
                  </Field>
                </div>

                <Field label="Note">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                    maxLength={500}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, note: event.target.value }))
                    }
                    placeholder="Optional context like loan account, moratorium, or prepayment strategy."
                    value={formState.note}
                  />
                </Field>
                </div>

                <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col gap-3 border-t border-[#edf2f7] bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:flex-row sm:px-6">
                  <button
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111111] text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isSubmitting || isPending}
                    type="submit"
                  >
                    <span>{isSubmitting ? "Creating..." : "Create loan"}</span>
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    className="h-12 rounded-2xl border border-[#dbe2ee] px-5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950 sm:w-auto"
                    onClick={() => setIsCreateModalOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const fieldClassName =
  "h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950";

function TopStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.7rem] border border-[#e6ebf2] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-neutral-500">{label}</p>
        <Icon className="size-4 text-neutral-500" />
      </div>
      <p className="mt-4 break-words text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}

function DebtMiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const valueClass =
    tone === "success"
      ? "text-[#0f7a56]"
      : tone === "danger"
        ? "text-[#b23434]"
        : "text-[#132842]";

  return (
    <div className="rounded-2xl border border-[#edf2f7] bg-[#fbfcfe] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7c8aa5]">
        {label}
      </p>
      <p className={`mt-2 break-words text-base font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function LoanCard({
  formatter,
  isDeleting,
  isExpanded,
  loan,
  onDelete,
  onToggleDetails,
}: {
  formatter: Intl.NumberFormat;
  isDeleting: boolean;
  isExpanded: boolean;
  loan: DebtLoanSummary;
  onDelete: () => void;
  onToggleDetails: () => void;
}) {
  const isClosed = loan.remainingPrincipal <= 0.01;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#e6ebf2] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.04)]">
      <div className="p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
              {loan.name}
            </h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isClosed ? "bg-[#e9f8ee] text-[#166534]" : "bg-[#fff4e8] text-[#c2410c]"
              }`}
            >
              {isClosed ? "Closed" : `${loan.progressPct.toFixed(1)}% principal paid`}
            </span>
            <span className="rounded-full bg-[#f4f7fb] px-3 py-1 text-xs font-semibold text-neutral-700">
              {loan.loanType === "no_cost_emi" ? "No-cost EMI" : "Standard loan"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f7fb] px-3 py-1 font-medium text-neutral-700">
              <BadgeIndianRupee className="size-4" />
              {loan.lender}
            </span>
            <span>{loan.durationMonths} months</span>
            <span>EMI date: {loan.emiPaymentDay}</span>
            {loan.expectedClosureDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                Closes {formatDate(loan.expectedClosureDate)}
              </span>
            ) : null}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[1.6rem] border border-[#fed7aa] bg-[#fff7ed] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a3412]">
                Outstanding principal
              </p>
              <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-[#9a3412]">
                {formatter.format(loan.remainingPrincipal)}
              </p>
              <p className="mt-2 text-sm text-[#9a3412]/75">
                Left to pay: {formatter.format(loan.remainingAmount)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricPill label="EMI" tone="default" value={formatter.format(loan.emiAmount)} />
              <MetricPill
                label="Installments"
                tone="default"
                value={`${loan.paidInstallments}/${loan.schedule.length}`}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricPill label="Paid principal" tone="success" value={formatter.format(loan.paidPrincipal)} />
            <MetricPill label="Paid interest" tone="default" value={formatter.format(loan.paidInterest)} />
            <MetricPill label="Total interest" tone="default" value={formatter.format(loan.totalInterest)} />
            <MetricPill label="Prepayment" tone="success" value={formatter.format(loan.totalPrepayment)} />
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#edf2f7]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#15803d_0%,#22c55e_100%)]"
              style={{ width: `${Math.min(Math.max(loan.progressPct, isClosed ? 100 : 4), 100)}%` }}
            />
          </div>

          {loan.note ? (
            <div className="mt-5 rounded-[1.4rem] border border-[#eef2f7] bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-neutral-600">
              {loan.note}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col lg:pt-1">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111111] px-4 text-sm font-semibold text-white transition hover:opacity-95 sm:w-auto"
            onClick={onToggleDetails}
            type="button"
          >
            {isExpanded ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {isExpanded ? "Hide detail" : "See detail info"}
          </button>
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] px-4 text-sm font-medium text-neutral-600 transition hover:border-[#111111] hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            disabled={isDeleting}
            onClick={onDelete}
            type="button"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
      </div>

      {isExpanded ? <ScheduleTable formatter={formatter} loan={loan} /> : null}
    </article>
  );
}

function ScheduleTable({
  formatter,
  loan,
}: {
  formatter: Intl.NumberFormat;
  loan: DebtLoanSummary;
}) {
  return (
    <div className="border-t border-[#e6ebf2] bg-[#fbfcfe]">
      <div className="flex flex-col gap-1 border-b border-[#e6ebf2] px-5 py-4 sm:px-6">
        <p className="text-sm font-semibold text-[#17304f]">EMI and prepayment schedule</p>
        <p className="text-xs text-[#6d7d97]">
          Paid rows are highlighted in green based on the EMI due date.
        </p>
      </div>

      <div className="grid gap-3 p-4 sm:hidden">
        {loan.schedule.map((row) => (
          <div
            className={`rounded-[1.25rem] border p-4 ${
              row.isPaid
                ? "border-[#d1fae5] bg-[#effcf5] text-[#166534]"
                : "border-[#e6ebf2] bg-white text-[#233a5f]"
            }`}
            key={`${loan.id}-mobile-${row.installmentNumber}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">EMI #{row.installmentNumber}</p>
                <p className="mt-1 text-xs opacity-75">{formatDate(row.dueDate)}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  row.isPaid ? "bg-white text-[#166534]" : "bg-[#f4f7fb] text-[#566883]"
                }`}
              >
                {row.isPaid ? "Paid" : "Pending"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <ScheduleMiniValue label="EMI" value={formatter.format(row.emiAmount)} />
              <ScheduleMiniValue label="Principal" value={formatter.format(row.principalPaid)} />
              <ScheduleMiniValue label="Interest" value={formatter.format(row.interestPaid)} />
              <ScheduleMiniValue label="Closing" value={formatter.format(row.closingBalance)} />
            </div>
            {row.prepaymentAmount > 0 ? (
              <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold">
                Prepayment: {formatter.format(row.prepaymentAmount)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden max-h-[34rem] overflow-auto sm:block">
        <table className="min-w-[68rem] text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-[#e6edf7] bg-white text-left text-xs font-semibold uppercase tracking-[0.14em] text-[#7c8aa5] shadow-[0_1px_0_#e6edf7]">
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Due date</th>
              <th className="px-3 py-3">Opening</th>
              <th className="px-3 py-3">EMI</th>
              <th className="px-3 py-3">Principal</th>
              <th className="px-3 py-3">Interest</th>
              <th className="px-3 py-3">Prepayment</th>
              <th className="px-3 py-3">Total paid</th>
              <th className="px-3 py-3">Closing</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loan.schedule.map((row) => (
              <tr
                className={`border-b border-[#eef3fa] transition hover:bg-[#f8fbff] ${
                  row.isPaid ? "bg-[#effcf5] text-[#166534]" : "bg-white text-[#233a5f]"
                }`}
                key={`${loan.id}-${row.installmentNumber}`}
              >
                <td className="px-3 py-3">{row.installmentNumber}</td>
                <td className="px-3 py-3">{formatDate(row.dueDate)}</td>
                <td className="px-3 py-3">{formatter.format(row.openingBalance)}</td>
                <td className="px-3 py-3">{formatter.format(row.emiAmount)}</td>
                <td className="px-3 py-3">{formatter.format(row.principalPaid)}</td>
                <td className="px-3 py-3">{formatter.format(row.interestPaid)}</td>
                <td className="px-3 py-3">{formatter.format(row.prepaymentAmount)}</td>
                <td className="px-3 py-3">{formatter.format(row.totalPayment)}</td>
                <td className="px-3 py-3">{formatter.format(row.closingBalance)}</td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      row.isPaid ? "bg-white text-[#166534]" : "bg-[#f4f7fb] text-[#566883]"
                    }`}
                  >
                    {row.isPaid ? <CheckCircle2 className="size-3.5" /> : null}
                    {row.isPaid ? "Paid" : "Pending"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-[#d1fae5] bg-[#effcf5] text-[#166534]"
      : tone === "warning"
        ? "border-[#fed7aa] bg-[#fff7ed] text-[#9a3412]"
        : "border-[#eef2f7] bg-[#fbfcfe] text-neutral-900";

  return (
    <div className={`rounded-[1.4rem] border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-[0.08em] opacity-70">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}

function ScheduleMiniValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-60">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}

function createCurrencyFormatter(currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    });
  } catch {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    });
  }
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
