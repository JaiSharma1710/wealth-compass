"use client";

import { useMemo, useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Input } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Chip list of selected banks plus a searchable inline picker. */
export function BankPicker({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(values), [values]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((bank) => bank.toLowerCase().includes(q)) : options;
  }, [options, query]);

  function toggle(bank: string) {
    onChange(selected.has(bank) ? values.filter((value) => value !== bank) : [...values, bank]);
  }

  return (
    <div className="space-y-3">
      {values.length ? (
        <ul className="flex flex-wrap gap-2">
          {values.map((bank) => (
            <li
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-3 text-sm text-ink"
              key={bank}
            >
              {bank}
              <button
                aria-label={`Remove ${bank}`}
                className="flex size-6 items-center justify-center rounded-full text-ink-3 transition hover:bg-surface-3 hover:text-loss"
                onClick={() => toggle(bank)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-3">
          No banks added yet. Banks you add here appear in Cash and Goals.
        </p>
      )}

      <button
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink transition hover:bg-surface-2"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Plus className="size-4" /> {open ? "Hide bank list" : "Add banks"}
      </button>

      {open ? (
        <div className="rounded-xl border border-line bg-surface p-2">
          <Input
            autoFocus
            className="text-base sm:text-sm"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search banks"
            value={query}
          />
          <div className="mt-2 max-h-64 overflow-y-auto">
            {filtered.length ? (
              filtered.map((bank) => {
                const isSelected = selected.has(bank);
                return (
                  <button
                    aria-pressed={isSelected}
                    className={cn(
                      "flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-surface-2",
                      isSelected ? "text-ink" : "text-ink-2"
                    )}
                    key={bank}
                    onClick={() => toggle(bank)}
                    type="button"
                  >
                    <span>{bank}</span>
                    {isSelected ? <Check className="size-4 shrink-0 text-brand" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-2 text-sm text-ink-3">No banks found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
