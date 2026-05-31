"use client";

import type { ComponentType, FormEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flag,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

import type {
  GoalsPageData,
  GoalSummary,
} from "@/lib/goals.types";

type GoalsViewProps = {
  currencyCode: string;
  initialData: GoalsPageData;
};

type CreateGoalFormState = {
  name: string;
  targetAmount: string;
  targetDate: string;
  assetType: string;
  investmentId: string;
  note: string;
};

const DEFAULT_FORM_STATE: CreateGoalFormState = {
  name: "",
  targetAmount: "",
  targetDate: "",
  assetType: "cash",
  investmentId: "",
  note: "",
};

export function GoalsView({ currencyCode, initialData }: GoalsViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formState, setFormState] = useState<CreateGoalFormState>(DEFAULT_FORM_STATE);
  const formatter = useMemo(() => createCurrencyFormatter(currencyCode), [currencyCode]);
  const availableGroups = useMemo(
    () => initialData.assetGroups.filter((group) => group.available),
    [initialData.assetGroups]
  );
  const effectiveAssetType = useMemo(() => {
    const selectedAssetExists = initialData.assetGroups.some(
      (group) => group.assetType === formState.assetType && group.available
    );

    return selectedAssetExists
      ? formState.assetType
      : availableGroups[0]?.assetType || initialData.assetGroups[0]?.assetType || "cash";
  }, [availableGroups, formState.assetType, initialData.assetGroups]);
  const selectedGroup = useMemo(() => {
    return (
      initialData.assetGroups.find((group) => group.assetType === effectiveAssetType) ||
      availableGroups[0] ||
      initialData.assetGroups[0]
    );
  }, [availableGroups, effectiveAssetType, initialData.assetGroups]);
  const effectiveInvestmentId = useMemo(() => {
    const hasCurrentOption = selectedGroup?.options.some(
      (option) => option.investmentId === formState.investmentId
    );

    return hasCurrentOption
      ? formState.investmentId
      : selectedGroup?.options[0]?.investmentId || "";
  }, [formState.investmentId, selectedGroup]);
  const selectedInvestment = useMemo(() => {
    return selectedGroup?.options.find((option) => option.investmentId === effectiveInvestmentId) || null;
  }, [effectiveInvestmentId, selectedGroup]);
  const completionRate = initialData.overview.totalGoals
    ? Math.round(
        (initialData.overview.completedGoals / initialData.overview.totalGoals) * 100
      )
    : 0;

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formState.name,
          targetAmount: Number(formState.targetAmount),
          targetDate: formState.targetDate,
          assetType: effectiveAssetType,
          investmentId: effectiveInvestmentId,
          note: formState.note,
        }),
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to create goal.");
      }

      toast.success(result?.message || "Goal created.");
      setFormState({
        ...DEFAULT_FORM_STATE,
        assetType: availableGroups[0]?.assetType || DEFAULT_FORM_STATE.assetType,
        investmentId: availableGroups[0]?.options[0]?.investmentId || "",
      });
      setIsCreateModalOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create goal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteGoal(goal: GoalSummary) {
    const shouldDelete = window.confirm(`Delete the "${goal.name}" goal?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingGoalId(goal.id);

    try {
      const response = await fetch(`/api/goals?goalId=${encodeURIComponent(goal.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(result?.message || "Unable to delete goal.");
      }

      toast.success(result?.message || "Goal deleted.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete goal.");
    } finally {
      setDeletingGoalId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f7fb] p-4 sm:p-6">
      <div className="mx-auto flex max-w-[96rem] flex-col gap-6">
        <section className="grid gap-4 md:grid-cols-3">
          <TopStat
            icon={Target}
            label="Active Goals"
            value={String(initialData.overview.totalGoals)}
          />
          <TopStat
            icon={CheckCircle2}
            label="Completed Goals"
            value={String(initialData.overview.completedGoals)}
          />
          <TopStat
            icon={Flag}
            label="Completion Rate"
            value={`${completionRate}%`}
          />
        </section>

        <section className="rounded-[2rem] border border-[#e6ebf2] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Goals</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">
                Track progress from linked assets
              </h2>
            </div>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#111111] px-5 text-sm font-semibold text-white transition hover:opacity-95"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <Plus className="size-4" />
              Add new goal
            </button>
          </div>
        </section>

        <section className="space-y-4">
            {initialData.goals.length ? (
              initialData.goals.map((goal) => (
                <GoalCard
                  formatter={formatter}
                  goal={goal}
                  isDeleting={deletingGoalId === goal.id}
                  key={goal.id}
                  onDelete={() => void handleDeleteGoal(goal)}
                />
              ))
            ) : (
              <div className="flex min-h-[24rem] items-center justify-center rounded-[2rem] border border-dashed border-[#d8deea] bg-white p-8 text-center shadow-sm">
                <div className="max-w-md">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f4f7fb] text-neutral-700">
                    <Target className="size-6" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-neutral-950">
                    No goals yet
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-500">
                    Start with a real-life target like a car, home down payment, or emergency corpus. Once linked, progress will flow from the underlying asset automatically.
                  </p>
                </div>
              </div>
            )}
        </section>

        {isCreateModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
            <button
              aria-label="Close create goal modal"
              className="absolute inset-0"
              onClick={() => setIsCreateModalOpen(false)}
              type="button"
            />
            <section className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[#e6ebf2] bg-white p-6 shadow-[0_32px_120px_rgba(15,23,42,0.28)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-neutral-500">Create New Goal</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                    Link a live asset
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

              <form className="mt-6 space-y-4" onSubmit={handleCreateGoal}>
                <Field label="Goal name">
                  <input
                    className="h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                    onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Buy a car"
                    required
                    value={formState.name}
                  />
                </Field>

                <Field label="Target amount">
                  <input
                    className="h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                    inputMode="decimal"
                    min="0.01"
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, targetAmount: event.target.value }))
                    }
                    placeholder="1200000"
                    required
                    step="0.01"
                    value={formState.targetAmount}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Asset">
                    <select
                      className="h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          assetType: event.target.value,
                          investmentId: "",
                        }))
                      }
                      value={effectiveAssetType}
                    >
                      {initialData.assetGroups.map((group) => (
                        <option
                          disabled={!group.available}
                          key={group.assetType}
                          value={group.assetType}
                        >
                          {group.label}
                          {!group.available ? " (Coming soon)" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Investment">
                    <select
                      className="h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950 disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-neutral-400"
                      disabled={!selectedGroup?.available || !selectedGroup.options.length}
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, investmentId: event.target.value }))
                      }
                      required
                      value={effectiveInvestmentId}
                    >
                      {!selectedGroup?.options.length ? (
                        <option value="">No options available</option>
                      ) : null}
                      {selectedGroup?.options.map((option) => (
                        <option key={option.investmentId} value={option.investmentId}>
                          {option.investmentLabel}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                {selectedInvestment ? (
                  <div className="rounded-[1.4rem] border border-[#e6ebf2] bg-[#f7f9fc] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-neutral-950">
                          {selectedInvestment.investmentLabel}
                        </p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {selectedInvestment.investmentDetail}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
                        {formatter.format(selectedInvestment.currentValue)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.4rem] border border-dashed border-[#dbe2ee] bg-[#fafbfc] px-4 py-3 text-sm text-neutral-500">
                    {selectedGroup?.emptyMessage || "Choose an asset to see linkable investments."}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Target date">
                    <input
                      className="h-12 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                      onChange={(event) =>
                        setFormState((current) => ({ ...current, targetDate: event.target.value }))
                      }
                      type="date"
                      value={formState.targetDate}
                    />
                  </Field>

                  <Field label="Auto progress">
                    <div className="flex h-12 items-center rounded-2xl border border-[#dbe2ee] bg-[#f7f9fc] px-4 text-sm font-medium text-neutral-600">
                      Syncs from linked asset
                    </div>
                  </Field>
                </div>

                <Field label="Note">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-[#dbe2ee] bg-white px-4 py-3 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
                    maxLength={300}
                    onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Optional context like preferred model, trip date, or funding strategy."
                    value={formState.note}
                  />
                </Field>

                <div className="flex gap-3">
                  <button
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111111] text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      isSubmitting ||
                      isPending ||
                      !selectedGroup?.available ||
                      !effectiveInvestmentId
                    }
                    type="submit"
                  >
                    <span>{isSubmitting ? "Creating..." : "Create goal"}</span>
                    <ArrowRight className="size-4" />
                  </button>
                  <button
                    className="h-12 rounded-2xl border border-[#dbe2ee] px-5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
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
      <p className="mt-4 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">{value}</p>
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

function GoalCard({
  goal,
  formatter,
  isDeleting,
  onDelete,
}: {
  goal: GoalSummary;
  formatter: Intl.NumberFormat;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  const isHealthy = goal.progressPct >= 65;
  const toneClasses = goal.isCompleted
    ? "bg-[#e9f8ee] text-[#166534]"
    : isHealthy
      ? "bg-[#ecf5ff] text-[#1d4ed8]"
      : "bg-[#fff4e8] text-[#c2410c]";

  return (
    <article className="rounded-[2rem] border border-[#e6ebf2] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
              {goal.name}
            </h3>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses}`}>
              {goal.isCompleted ? "Funded" : `${goal.progressPct.toFixed(1)}% complete`}
            </span>
            {!goal.isLinkActive ? (
              <span className="rounded-full bg-[#fff1f2] px-3 py-1 text-xs font-semibold text-[#be123c]">
                Link missing
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <span className="rounded-full bg-[#f4f7fb] px-3 py-1 font-medium text-neutral-700">
              {goal.assetTypeLabel}
            </span>
            <span>{goal.investmentLabel}</span>
            {goal.investmentDetail ? <span>• {goal.investmentDetail}</span> : null}
            {goal.targetDate ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-4" />
                {formatDate(goal.targetDate)}
              </span>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Funded by linked asset</p>
                <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
                  {formatter.format(goal.currentValue)}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm font-medium text-neutral-500">Target</p>
                <p className="mt-2 break-words text-lg font-semibold text-neutral-950 sm:text-xl">
                  {formatter.format(goal.targetAmount)}
                </p>
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2f7]">
              <div
                className={`h-full rounded-full ${
                  goal.isCompleted
                    ? "bg-[linear-gradient(90deg,#15803d_0%,#22c55e_100%)]"
                    : "bg-[linear-gradient(90deg,#111827_0%,#475467_100%)]"
                }`}
                style={{ width: `${Math.max(goal.progressPct, 4)}%` }}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MetricPill
                label="Remaining"
                tone={goal.remainingAmount === 0 ? "success" : "default"}
                value={formatter.format(goal.remainingAmount)}
              />
              <MetricPill
                label="Counted toward target"
                tone="default"
                value={formatter.format(goal.fundedAmount)}
              />
              <MetricPill
                label="Progress"
                tone="default"
                value={`${goal.progressPct.toFixed(1)}%`}
              />
            </div>
          </div>

          {goal.note ? (
            <div className="mt-5 rounded-[1.4rem] border border-[#eef2f7] bg-[#fbfcfe] px-4 py-3 text-sm leading-6 text-neutral-600">
              {goal.note}
            </div>
          ) : null}

          {!goal.isLinkActive ? (
            <div className="mt-5 inline-flex items-start gap-2 rounded-[1.2rem] border border-[#ffe4e6] bg-[#fff7f8] px-4 py-3 text-sm text-[#9f1239]">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>This linked investment is not active anymore, so goal progress is currently shown as zero.</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 lg:pt-1">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#e5e7eb] px-4 text-sm font-medium text-neutral-600 transition hover:border-[#111111] hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            disabled={isDeleting}
            onClick={onDelete}
            type="button"
          >
            <Trash2 className="size-4" />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </article>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "success";
}) {
  return (
    <div
      className={`rounded-[1.4rem] border px-4 py-3 ${
        tone === "success"
          ? "border-[#d1fae5] bg-[#effcf5]"
          : "border-[#eef2f7] bg-[#fbfcfe]"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{value}</p>
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
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
