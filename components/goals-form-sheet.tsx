"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/kit";
import { Field, FieldGrid, Input, Sheet, Textarea } from "@/components/ui/sheet";
import { resolveGoalLinks } from "@/lib/goals-calculations";
import type { GoalAssetGroup, GoalLinkInput, GoalSummary } from "@/lib/goals.types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type GoalFormValues = {
  name: string;
  note: string;
  targetAmount: number;
  targetDate: string;
  links: GoalLinkInput[];
};

const linkKey = (link: GoalLinkInput) => `${link.assetType}::${link.investmentId}`;

export function GoalFormSheet({
  open,
  goal,
  assetGroups,
  currency,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  goal: GoalSummary | null;
  assetGroups: GoalAssetGroup[];
  currency: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: GoalFormValues) => void;
}) {
  // Re-mount the form body whenever the sheet opens for a different goal.
  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={goal ? "Edit goal" : "New goal"}
      description="Pick one or more investments to fund this goal. Progress follows their live value."
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="goal-form" variant="primary" loading={busy}>
            {goal ? "Save changes" : "Create goal"}
          </Button>
        </div>
      }
    >
      {open ? (
        <GoalForm key={goal?.id || "new"} goal={goal} assetGroups={assetGroups} currency={currency} onSubmit={onSubmit} />
      ) : null}
    </Sheet>
  );
}

function GoalForm({
  goal,
  assetGroups,
  currency,
  onSubmit,
}: {
  goal: GoalSummary | null;
  assetGroups: GoalAssetGroup[];
  currency: string;
  onSubmit: (values: GoalFormValues) => void;
}) {
  const [name, setName] = useState(goal?.name || "");
  const [note, setNote] = useState(goal?.note || "");
  const [target, setTarget] = useState(goal ? String(goal.targetAmount) : "");
  const [date, setDate] = useState(goal?.targetDate ? goal.targetDate.slice(0, 10) : "");
  const [selected, setSelected] = useState<GoalLinkInput[]>(
    goal?.links.filter((link) => link.isActive).map((link) => ({ assetType: link.assetType, investmentId: link.investmentId })) || []
  );
  const selectedKeys = useMemo(() => new Set(selected.map(linkKey)), [selected]);
  const preview = useMemo(() => resolveGoalLinks(selected, assetGroups), [selected, assetGroups]);
  const [error, setError] = useState("");

  function toggle(link: GoalLinkInput) {
    setSelected((current) =>
      current.some((entry) => linkKey(entry) === linkKey(link))
        ? current.filter((entry) => linkKey(entry) !== linkKey(link))
        : [...current, link]
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const targetAmount = Number(target);

    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError("Enter a target amount greater than zero.");
      return;
    }

    if (selected.length === 0) {
      setError("Choose at least one investment to link.");
      return;
    }

    setError("");
    onSubmit({ name: name.trim(), note: note.trim(), targetAmount, targetDate: date, links: selected });
  }

  return (
    <form id="goal-form" onSubmit={handleSubmit} className="space-y-5">
      <FieldGrid>
        <Field label="Goal name">
          <Input required minLength={2} maxLength={120} placeholder="e.g. Emergency fund" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Target amount">
          <Input required type="number" inputMode="decimal" min="1" step="any" value={target} onChange={(event) => setTarget(event.target.value)} />
        </Field>
        <Field label="Target date" hint="Optional. Unlocks the monthly saving estimate.">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Note" hint="Optional">
          <Textarea className="min-h-10" maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </FieldGrid>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ink-2">Linked investments</p>
          <p className="tabular text-xs text-ink-3">
            {selected.length} selected · {formatMoney(preview.currentValue, { currency, decimals: 0 })}
          </p>
        </div>
        <div className="space-y-4">
          {assetGroups.map((group) => (
            <div key={group.assetType}>
              <p className="text-xs font-semibold text-ink">{group.label}</p>
              {group.options.length === 0 ? (
                <p className="mt-1 text-xs text-ink-3">{group.emptyMessage}</p>
              ) : (
                <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                  {group.options.map((option) => {
                    const on = selectedKeys.has(linkKey(option));
                    const covered =
                      !option.isWholeClass && selectedKeys.has(`${option.assetType}::*`);

                    return (
                      <li key={option.investmentId}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle({ assetType: option.assetType, investmentId: option.investmentId })}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                            on ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2",
                            option.isWholeClass && !on && "border-dashed",
                            covered && "opacity-60"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border",
                              on ? "border-brand bg-brand text-cta-ink" : "border-line-strong bg-surface"
                            )}
                          >
                            {on ? <Check className="size-3.5" aria-hidden /> : null}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">{option.investmentLabel}</span>
                            <span className="block truncate text-xs text-ink-3">{option.investmentDetail}</span>
                          </span>
                          <span className="tabular shrink-0 text-xs font-medium text-ink-2">
                            {formatMoney(option.currentValue, { currency, decimals: 0 })}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          Linking a whole asset class already covers its individual holdings, so nothing is counted twice.
        </p>
      </div>

      {error ? <p className="text-sm text-loss">{error}</p> : null}
    </form>
  );
}
