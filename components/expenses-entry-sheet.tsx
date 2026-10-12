"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { Sheet, Field, Input } from "@/components/ui/sheet";
import { Button, Segmented } from "@/components/ui/kit";
import {
  CREDIT_CATEGORIES,
  EXPENSE_CATEGORIES,
  inferCategory,
} from "@/lib/expense-categories";
import { formatIstDateTimeForInput } from "@/lib/expenses-calculations";
import type {
  ExpenseDashboardData,
  ExpenseEntrySummary,
  ExpenseEntryType,
} from "@/lib/expenses.types";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type QuickSuggestion = { note: string; amount: number; category: string };

/** Most frequent distinct note + amount pairs from recent expenses, for one-tap re-logging. */
export function buildSuggestions(entries: ExpenseEntrySummary[], limit = 6): QuickSuggestion[] {
  const counts = new Map<string, QuickSuggestion & { count: number; latest: number }>();

  for (const entry of entries.slice(0, 200)) {
    const note = entry.note.trim();
    if (entry.entryType !== "expense" || !note) continue;
    const key = `${note.toLowerCase()}|${entry.amount}`;
    const found = counts.get(key);
    const time = new Date(entry.occurredAt).getTime();

    if (found) {
      found.count += 1;
    } else {
      counts.set(key, { note, amount: entry.amount, category: entry.category, count: 1, latest: time });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || b.latest - a.latest)
    .slice(0, limit)
    .map(({ note, amount, category }) => ({ note, amount, category }));
}

function EntryForm({
  entry,
  suggestions,
  currency,
  onClose,
  onSaved,
}: {
  entry: ExpenseEntrySummary | null;
  suggestions: QuickSuggestion[];
  currency: string;
  onClose: () => void;
  onSaved: (dashboard: ExpenseDashboardData) => void;
}) {
  const [now] = useState(() => formatIstDateTimeForInput(new Date()));
  const [entryType, setEntryType] = useState<ExpenseEntryType>(entry?.entryType ?? "expense");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [category, setCategory] = useState(entry?.category ?? "");
  const [touched, setTouched] = useState(Boolean(entry));
  const [occurredAt, setOccurredAt] = useState(entry ? formatIstDateTimeForInput(new Date(entry.occurredAt)) : now);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const categories = entryType === "expense" ? EXPENSE_CATEGORIES : CREDIT_CATEGORIES;
  const inferred = useMemo(() => inferCategory(entryType, note), [entryType, note]);
  const activeCategory = touched && category ? category : inferred;
  const parsedAmount = Number(amount);
  const canSave = Number.isFinite(parsedAmount) && parsedAmount > 0 && !saving;

  function changeType(next: ExpenseEntryType) {
    setEntryType(next);
    setTouched(false);
    setCategory("");
  }

  async function submit() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(entry ? `/api/expenses/${entry.id}` : "/api/expenses", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryType, amount: parsedAmount, note, category: activeCategory, occurredAt }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        dashboard?: ExpenseDashboardData;
      };

      if (!response.ok || !result.dashboard) {
        throw new Error(result.message || "Unable to save entry.");
      }

      toast.success(result.message || "Saved.");
      onSaved(result.dashboard);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save entry.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void submit();
      }}
      className="space-y-4"
    >
      <Segmented
        ariaLabel="Entry type"
        value={entryType}
        onChange={changeType}
        options={[
          { value: "expense", label: "Expense" },
          { value: "credit", label: "Credit" },
        ]}
        className="w-full"
      />

      <div className="rounded-2xl bg-surface-2 px-4 py-3">
        <label htmlFor="expense-amount" className="text-xs font-medium text-ink-3">Amount</label>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-ink-3">{formatMoney(0, { currency, decimals: 0 }).replace(/[\d.,\s]/g, "")}</span>
          <input
            id="expense-amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            className="tabular w-full min-w-0 bg-transparent text-4xl font-semibold text-ink outline-none placeholder:text-ink-3/50"
          />
        </div>
      </div>

      {!entry && entryType === "expense" && suggestions.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-3">Quick add</p>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.note}-${suggestion.amount}`}
                type="button"
                onClick={() => {
                  setAmount(String(suggestion.amount));
                  setNote(suggestion.note);
                  setCategory(suggestion.category);
                  setTouched(true);
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm text-ink transition hover:bg-surface-2"
              >
                <span className="max-w-28 truncate">{suggestion.note}</span>
                <span className="tabular text-ink-3">{formatMoney(suggestion.amount, { currency, decimals: 0 })}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="Note" hint={note.trim() ? undefined : "e.g. cng, parking, grocery, lunch"}>
        <Input
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What was it for?"
          autoComplete="off"
        />
      </Field>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-2">
          Category
          {!touched && note.trim() ? <span className="ml-1.5 font-normal text-ink-3">auto-detected, tap to change</span> : null}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={activeCategory === item.key}
              onClick={() => {
                setCategory(item.key);
                setTouched(true);
              }}
              className={cn(
                "h-9 rounded-full border px-3 text-[0.8rem] font-medium transition",
                activeCategory === item.key
                  ? "border-brand bg-brand-soft text-brand-ink"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-2"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <Field label="Date & time (IST)">
        <Input type="datetime-local" value={occurredAt} max={now} onChange={(event) => setOccurredAt(event.target.value)} />
      </Field>

      {error ? <p role="alert" className="rounded-xl bg-loss-soft px-3 py-2 text-sm text-loss">{error}</p> : null}

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" className="flex-[2]" loading={saving} disabled={!canSave}>
          {entry ? "Save changes" : entryType === "credit" ? "Add credit" : "Add expense"}
        </Button>
      </div>
    </form>
  );
}

export function ExpenseEntrySheet({
  open,
  entry,
  suggestions,
  currency,
  onClose,
  onSaved,
}: {
  open: boolean;
  entry: ExpenseEntrySummary | null;
  suggestions: QuickSuggestion[];
  currency: string;
  onClose: () => void;
  onSaved: (dashboard: ExpenseDashboardData) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={entry ? "Edit entry" : "Add expense"}>
      <EntryForm
        key={entry?.id ?? "new"}
        entry={entry}
        suggestions={suggestions}
        currency={currency}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Sheet>
  );
}
