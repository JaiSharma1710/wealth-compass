"use client";

import { useState } from "react";
import { CalendarClock, Layers, Pencil, Plus, Target, Trash2, TriangleAlert } from "lucide-react";
import toast from "react-hot-toast";

import { GoalFormSheet, type GoalFormValues } from "@/components/goals-form-sheet";
import { Sheet } from "@/components/ui/sheet";
import { Badge, Button, Card, EmptyState, IconButton, Page, ProgressBar, StatTile } from "@/components/ui/kit";
import type { GoalStatus, GoalSummary, GoalsPageData } from "@/lib/goals.types";
import { formatCompactMoney, formatDate, formatMoney, formatPercent } from "@/lib/format";

const STATUS: Record<GoalStatus, { label: string; tone: "gain" | "warn" | "loss" | "neutral" }> = {
  completed: { label: "Achieved", tone: "gain" },
  on_track: { label: "On track", tone: "gain" },
  behind: { label: "Behind", tone: "warn" },
  overdue: { label: "Overdue", tone: "loss" },
  no_date: { label: "No deadline", tone: "neutral" },
};

export function GoalsView({ data, currencyCode }: { data: GoalsPageData; currencyCode: string }) {
  const currency = currencyCode;
  const [state, setState] = useState(data);
  const [syncedProps, setSyncedProps] = useState(data);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalSummary | null>(null);
  const [deleting, setDeleting] = useState<GoalSummary | null>(null);
  const [busy, setBusy] = useState(false);

  if (data !== syncedProps) {
    setSyncedProps(data);
    setState(data);
  }

  const { overview, goals, assetGroups } = state;
  const hasSources = assetGroups.some((group) => group.options.length > 0);

  async function call(method: "POST" | "PATCH" | "DELETE", body: unknown, query = "") {
    setBusy(true);

    try {
      const response = await fetch(`/api/goals${query}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = (await response.json().catch(() => null)) as (GoalsPageData & { message?: string }) | null;

      if (!response.ok || !result?.goals) {
        throw new Error(result?.message || "Something went wrong. Please try again.");
      }

      setState({ overview: result.overview, goals: result.goals, assetGroups: result.assetGroups });
      toast.success(result.message || "Saved.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(values: GoalFormValues) {
    const ok = await call(editing ? "PATCH" : "POST", editing ? { ...values, id: editing.id } : values);

    if (ok) setFormOpen(false);
  }

  async function handleDelete() {
    if (deleting && (await call("DELETE", null, `?goalId=${encodeURIComponent(deleting.id)}`))) {
      setDeleting(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(goal: GoalSummary) {
    setEditing(goal);
    setFormOpen(true);
  }

  const newGoalButton = (
    <Button variant="primary" icon={Plus} onClick={openCreate} disabled={!hasSources}>
      New goal
    </Button>
  );

  return (
    <Page>
      {goals.length === 0 ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Give your money a purpose"
            message={
              hasSources
                ? "Set a target, link the stocks, funds, gold or cash that will fund it, and watch progress update with the market."
                : "Add a stock, mutual fund, gold holding or bank balance first, then link it to a goal."
            }
            action={newGoalButton}
          />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-3">Saved towards goals</p>
              <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
                {formatMoney(overview.totalSavedAmount, { currency, decimals: 0 })}
              </p>
              <p className="mt-1 text-sm text-ink-3">
                of {formatMoney(overview.totalTargetAmount, { currency, decimals: 0 })} across {overview.totalGoals}{" "}
                {overview.totalGoals === 1 ? "goal" : "goals"}
              </p>
            </div>
            {newGoalButton}
          </div>
          <div className="mt-4">
            <ProgressBar value={overview.overallProgressPct} tone="brand" label="Overall progress" />
            <p className="tabular mt-1.5 text-xs text-ink-3">{formatPercent(overview.overallProgressPct, { decimals: 0 })} of the combined target</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Remaining" value={formatCompactMoney(overview.totalRemainingAmount, { currency })} caption="To reach every target" />
            <StatTile
              label="Needed monthly"
              value={overview.totalRequiredMonthly > 0 ? formatCompactMoney(overview.totalRequiredMonthly, { currency }) : "—"}
              caption="For goals with a date"
            />
            <StatTile label="Achieved" value={`${overview.completedGoals} / ${overview.totalGoals}`} caption="Goals completed" />
            <StatTile
              label="Needs attention"
              value={String(overview.behindGoals)}
              caption={overview.behindGoals ? "Behind or overdue" : "Everything on pace"}
              valueClassName={overview.behindGoals ? "text-warn" : undefined}
            />
          </div>
        </Card>
      )}

      {goals.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} currency={currency} onEdit={openEdit} onDelete={setDeleting} />
          ))}
        </div>
      ) : null}

      {goals.length > 0 ? (
        <p className="px-1 text-xs text-ink-3">
          Estimates assume no investment growth: monthly need is the remaining amount divided by months left. A goal is
          on track when progress keeps pace with a straight line from the day it was created to its target date.
        </p>
      ) : null}

      <GoalFormSheet
        open={formOpen}
        goal={editing}
        assetGroups={assetGroups}
        currency={currency}
        busy={busy}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <Sheet
        open={deleting != null}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete this goal?"
        description={deleting ? `"${deleting.name}" will be removed. Your investments are not affected.` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDeleting(null)}>Keep</Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>Delete</Button>
          </div>
        }
      >
        <></>
      </Sheet>
    </Page>
  );
}

function GoalCard({
  goal,
  currency,
  onEdit,
  onDelete,
}: {
  goal: GoalSummary;
  currency: string;
  onEdit: (goal: GoalSummary) => void;
  onDelete: (goal: GoalSummary) => void;
}) {
  const status = STATUS[goal.status];
  const tone = goal.status === "behind" ? "warn" : goal.status === "overdue" ? "loss" : goal.status === "completed" ? "gain" : "brand";
  const hasBrokenLink = goal.links.some((link) => !link.isActive);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[0.95rem] font-semibold text-ink">{goal.name}</h3>
          {goal.note ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{goal.note}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge tone={status.tone}>{status.label}</Badge>
          <IconButton icon={Pencil} label={`Edit ${goal.name}`} onClick={() => onEdit(goal)} />
          <IconButton icon={Trash2} label={`Delete ${goal.name}`} onClick={() => onDelete(goal)} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="tabular text-2xl font-semibold text-ink">{formatMoney(goal.currentValue, { currency, decimals: 0 })}</p>
        <p className="tabular text-sm text-ink-3">of {formatMoney(goal.targetAmount, { currency, decimals: 0 })}</p>
      </div>
      <ProgressBar className="mt-2" value={goal.progressPct} tone={tone} label={`${goal.name} progress`} />
      <div className="tabular mt-1.5 flex justify-between text-xs text-ink-3">
        <span>{formatPercent(goal.progressPct, { decimals: 0 })} funded</span>
        <span>{goal.isCompleted ? "Target reached" : `${formatMoney(goal.remainingAmount, { currency, decimals: 0 })} to go`}</span>
      </div>

      <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 text-ink-2">
            {goal.targetDate ? (
              <>
                <p>
                  Target <span className="font-medium text-ink">{formatDate(goal.targetDate)}</span>
                  {goal.monthsLeft ? ` · ${goal.monthsLeft} ${goal.monthsLeft === 1 ? "month" : "months"} left` : ""}
                </p>
                {goal.requiredMonthly != null ? (
                  <p className="mt-0.5">
                    Save <span className="tabular font-semibold text-ink">{formatMoney(goal.requiredMonthly, { currency, decimals: 0 })}</span> a month to get there
                  </p>
                ) : goal.status === "overdue" ? (
                  <p className="mt-0.5 text-loss">Date passed with {formatMoney(goal.remainingAmount, { currency, decimals: 0 })} still to fund</p>
                ) : (
                  <p className="mt-0.5 text-gain">Funded ahead of the date</p>
                )}
              </>
            ) : (
              <p>No target date set. Add one to see the monthly saving needed.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {goal.links.map((link) => (
          <span
            key={`${link.assetType}-${link.investmentId}`}
            title={link.isCounted ? undefined : "Already included in the whole-class link"}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink-2"
          >
            {link.isActive ? <Layers className="size-3 shrink-0 text-ink-3" aria-hidden /> : <TriangleAlert className="size-3 shrink-0 text-warn" aria-hidden />}
            <span className="truncate">{link.label}</span>
            <span className="tabular shrink-0 font-medium text-ink">{formatCompactMoney(link.currentValue, { currency })}</span>
          </span>
        ))}
      </div>
      {hasBrokenLink ? (
        <p className="mt-2 text-xs text-warn">A linked holding no longer exists. Edit the goal to relink it.</p>
      ) : null}
    </Card>
  );
}
