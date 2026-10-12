"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Target,
  Trash2,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";

import { buildSuggestions, ExpenseEntrySheet } from "@/components/expenses-entry-sheet";
import { ColumnChart, RankedBars } from "@/components/ui/charts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  IconButton,
  Page,
  ProgressBar,
  Segmented,
  StatTile,
} from "@/components/ui/kit";
import { Field, Input, Select, Sheet } from "@/components/ui/sheet";
import { EXPENSE_CATEGORIES, CREDIT_CATEGORIES } from "@/lib/expense-categories";
import type {
  ExpenseDashboardData,
  ExpenseEntrySummary,
  ExpenseHistoryGranularity,
} from "@/lib/expenses.types";
import { formatCompactMoney, formatDateTime, formatMoney, formatPercent, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const IST = "Asia/Kolkata";
const PAGE_STEP = 25;
const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...CREDIT_CATEGORIES];

function istDayKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date(value));
}

function dayHeading(key: string, todayKey: string, yesterdayKey: string) {
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: IST }).format(
    new Date(`${key}T12:00:00+05:30`)
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST }).format(new Date(value));
}

/** Spending change: arrow follows the direction of spend, colour is inverted (less spend = good). */
function SpendDelta({ current, previous, suffix }: { current: number; previous: number; suffix?: string }) {
  if (previous <= 0) return <span className="text-xs text-ink-3">No earlier data</span>;
  const diff = current - previous;
  const percent = (diff / previous) * 100;
  const flat = Math.abs(percent) < 0.5;
  const Icon = diff > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span className={cn("tabular inline-flex items-center gap-0.5 text-sm font-medium", flat ? "text-ink-3" : diff > 0 ? "text-loss" : "text-gain")}>
      {flat ? null : <Icon className="size-3.5" aria-hidden />}
      {flat ? "Same" : formatPercent(Math.abs(percent), { decimals: 0 })}
      {suffix ? <span className="ml-1 font-normal text-ink-3">{suffix}</span> : null}
    </span>
  );
}

export function ExpensesView({ initialData, currencyCode }: { initialData: ExpenseDashboardData; currencyCode: string }) {
  const currency = currencyCode || "INR";
  const [data, setData] = useState(initialData);
  const [seen, setSeen] = useState(initialData);

  if (seen !== initialData) {
    setSeen(initialData);
    setData(initialData);
  }

  const [sheet, setSheet] = useState<{ open: boolean; entry: ExpenseEntrySummary | null }>({ open: false, entry: null });
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [deleting, setDeleting] = useState<ExpenseEntrySummary | null>(null);
  const [granularity, setGranularity] = useState<ExpenseHistoryGranularity>("daily");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "credit">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visible, setVisible] = useState(PAGE_STEP);

  const { cycle, budget, health, cycleSummary, previousCycleSummary } = data;
  const budgetAmount = budget.amount ?? 0;
  const spent = cycleSummary.expenseTotal;
  const usedPct = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;
  const barTone = !budget.hasBudget ? "brand" : health.status === "over_budget" && usedPct >= 100 ? "loss" : health.status === "on_track" ? "brand" : "warn";
  const remaining = health.remainingBudget;
  const safeDaily = health.expectedDailyExpense != null ? Math.max(health.expectedDailyExpense, 0) : null;
  const suggestions = useMemo(() => buildSuggestions(data.recentEntries), [data.recentEntries]);
  const statusBadge =
    health.status === "on_track"
      ? { tone: "gain" as const, label: "On track", Icon: CheckCircle2 }
      : health.status === "over_pace"
        ? { tone: "warn" as const, label: "Spending fast", Icon: AlertTriangle }
        : health.status === "over_budget"
          ? { tone: "loss" as const, label: "Heading over budget", Icon: AlertTriangle }
          : { tone: "neutral" as const, label: "Set a budget", Icon: Target };

  const history = useMemo(
    () =>
      data.history[granularity].map((point) => ({
        label: granularity === "weekly" ? formatShortDate(point.key) : point.label,
        spend: point.expenseTotal,
      })),
    [data.history, granularity]
  );
  const historyAvg = history.length ? history.reduce((sum, point) => sum + point.spend, 0) / history.length : 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return data.recentEntries.filter(
      (entry) =>
        (typeFilter === "all" || entry.entryType === typeFilter) &&
        (categoryFilter === "all" || entry.category === categoryFilter) &&
        (!needle || `${entry.note} ${entry.categoryLabel} ${entry.amount}`.toLowerCase().includes(needle))
    );
  }, [data.recentEntries, query, typeFilter, categoryFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, ExpenseEntrySummary[]>();

    for (const entry of filtered.slice(0, visible)) {
      const key = istDayKey(entry.occurredAt);
      map.set(key, [...(map.get(key) || []), entry]);
    }

    return [...map.entries()];
  }, [filtered, visible]);

  const todayKey = istDayKey(new Date());
  const yesterdayKey = istDayKey(new Date(new Date(`${todayKey}T12:00:00+05:30`).getTime() - 86400000));
  const filtersActive = Boolean(query) || typeFilter !== "all" || categoryFilter !== "all";

  function openAdd() {
    setSheet({ open: true, entry: null });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;

    try {
      const response = await fetch(`/api/expenses/${target.id}`, { method: "DELETE" });
      const result = (await response.json().catch(() => ({}))) as { message?: string; dashboard?: ExpenseDashboardData };

      if (!response.ok || !result.dashboard) throw new Error(result.message || "Unable to delete entry.");
      setData(result.dashboard);
      toast.success("Entry deleted.");
      setDeleting(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete entry.");
    }
  }

  return (
    <Page>
      {/* Hero */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-3">Spent this cycle · {cycle.label}</p>
            <p className="tabular mt-1 text-[2.1rem] leading-tight font-semibold tracking-tight text-ink sm:text-[2.6rem]">
              {formatMoney(spent, { currency, decimals: 0 })}
              {budget.hasBudget ? (
                <span className="ml-2 text-base font-medium text-ink-3 sm:text-lg">of {formatMoney(budgetAmount, { currency, decimals: 0 })}</span>
              ) : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={statusBadge.tone}>
              <statusBadge.Icon className="size-3" aria-hidden />
              {statusBadge.label}
            </Badge>
            <Button size="sm" icon={Target} onClick={() => setBudgetOpen(true)}>{budget.hasBudget ? "Edit budget" : "Set budget"}</Button>
            <Button size="sm" variant="primary" icon={Plus} onClick={openAdd} className="hidden sm:inline-flex">Add expense</Button>
          </div>
        </div>

        {budget.hasBudget ? (
          <>
            <ProgressBar value={usedPct} tone={barTone} className="mt-4 h-2.5" label="Budget used" />
            <div className="mt-1.5 flex justify-between text-xs text-ink-3">
              <span>{formatPercent(usedPct, { decimals: 0 })} used</span>
              <span>{cycle.elapsedDays}/{cycle.totalDays} days elapsed</span>
            </div>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">Set a budget for this cycle to see your safe daily spend and projection.</p>
        )}

        <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <HeroStat
            label={remaining != null && remaining < 0 ? "Over budget by" : "Left to spend"}
            value={remaining == null ? "—" : formatMoney(Math.abs(remaining), { currency, decimals: 0 })}
            tone={remaining != null && remaining < 0 ? "loss" : "ink"}
          />
          <HeroStat
            label="Safe to spend / day"
            value={safeDaily == null ? "—" : formatMoney(safeDaily, { currency, decimals: 0 })}
            caption={`for ${cycle.remainingDaysIncludingToday} days left`}
          />
          <HeroStat
            label="Projected by cycle end"
            value={budget.hasBudget ? formatMoney(health.projectedCycleSpend, { currency, decimals: 0 }) : "—"}
            caption={budget.hasBudget && health.overshootAmount > 0 ? `${formatCompactMoney(health.overshootAmount, { currency })} over budget` : budget.hasBudget ? "within budget" : undefined}
            tone={health.overshootAmount > 0 ? "loss" : "ink"}
          />
          <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-xs text-ink-3">Vs last cycle</dt>
            <dd className="mt-1"><SpendDelta current={budget.hasBudget ? health.projectedCycleSpend : spent} previous={previousCycleSummary.expenseTotal} /></dd>
            <p className="tabular mt-0.5 truncate text-xs text-ink-3">last: {formatMoney(previousCycleSummary.expenseTotal, { currency, decimals: 0 })}</p>
          </div>
        </dl>
      </Card>

      {/* KPI tiles */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Wallet} label="Today" value={formatMoney(data.todaySummary.expenseTotal, { currency, decimals: 0 })} caption={`${data.todaySummary.entryCount} entries`} />
        <StatTile icon={CalendarClock} label="This week" value={formatMoney(data.weekSummary.expenseTotal, { currency, decimals: 0 })} caption={`${data.weekSummary.entryCount} entries`} />
        <StatTile icon={ReceiptText} label="Avg per day" value={formatMoney(health.averageDailyExpense, { currency, decimals: 0 })} caption="this cycle" />
        <StatTile
          icon={Plus}
          label="Credits this cycle"
          value={formatMoney(cycleSummary.creditTotal, { currency, decimals: 0 })}
          caption={cycleSummary.creditTotal > 0 ? `net ${formatMoney(cycleSummary.netTotal, { currency, decimals: 0 })}` : "refunds, cashback…"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Spend history"
            subtitle={`Average ${formatCompactMoney(historyAvg, { currency })} per ${granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "cycle"}`}
            action={
              <Segmented
                ariaLabel="History range"
                value={granularity}
                onChange={setGranularity}
                options={[
                  { value: "daily", label: "14 days" },
                  { value: "weekly", label: "Weeks" },
                  { value: "monthly", label: "Cycles" },
                ]}
              />
            }
          />
          <ColumnChart
            data={history}
            xKey="label"
            series={[{ key: "spend", label: "Spent", color: "var(--wc-asset-stocks)" }]}
            currency={currency}
            highlightIndex={history.length - 1}
            height={230}
          />
          <p className="mt-2 text-xs text-ink-3">The current {granularity === "daily" ? "day" : granularity === "weekly" ? "week" : "cycle"} is highlighted.</p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Where it went" subtitle="This cycle, vs last cycle" />
          {data.categoryBreakdown.length ? (
            <RankedBars
              currency={currency}
              items={data.categoryBreakdown.slice(0, 8).map((item) => {
                const change = item.previousAmount > 0 ? ((item.amount - item.previousAmount) / item.previousAmount) * 100 : null;

                return {
                  key: item.key,
                  label: item.label,
                  value: item.amount,
                  caption: (
                    <>
                      {formatPercent(item.percentage, { decimals: 0 })}
                      {change != null && Math.abs(change) >= 1 ? (
                        <span className={cn("ml-1", change > 0 ? "text-loss" : "text-gain")}>
                          {change > 0 ? "▲" : "▼"}{Math.abs(Math.round(change))}%
                        </span>
                      ) : null}
                    </>
                  ),
                };
              })}
            />
          ) : (
            <EmptyState icon={ReceiptText} title="No spending yet" message="Categories appear as you add expenses." />
          )}
        </Card>
      </div>

      {/* Entries */}
      <Card className="mt-4" padded={false}>
        <div className="p-4 pb-0 sm:p-5 sm:pb-0">
          <CardHeader
            title="Entries"
            subtitle={`${filtered.length}${filtersActive ? " matching" : ""} of ${data.entriesPage.totalCount}`}
            action={<Button size="sm" icon={Plus} onClick={openAdd}>Add</Button>}
          />
          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisible(PAGE_STEP); }}
                placeholder="Search notes, e.g. cng"
                aria-label="Search entries"
                className="pl-9"
              />
            </div>
            <Select
              aria-label="Category filter"
              value={categoryFilter}
              onChange={(event) => { setCategoryFilter(event.target.value); setVisible(PAGE_STEP); }}
              className="sm:w-48"
            >
              <option value="all">All categories</option>
              {ALL_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>{category.label}</option>
              ))}
            </Select>
            <Segmented
              ariaLabel="Entry type"
              value={typeFilter}
              onChange={(value) => { setTypeFilter(value); setVisible(PAGE_STEP); }}
              options={[
                { value: "all", label: "All" },
                { value: "expense", label: "Expenses" },
                { value: "credit", label: "Credits" },
              ]}
            />
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={filtersActive ? "Nothing matches" : "No entries yet"}
            message={filtersActive ? "Try a different search or clear the filters." : "Log your first expense in a few taps."}
            action={filtersActive ? <Button onClick={() => { setQuery(""); setTypeFilter("all"); setCategoryFilter("all"); }}>Clear filters</Button> : <Button variant="primary" icon={Plus} onClick={openAdd}>Add expense</Button>}
          />
        ) : (
          <div>
            {groups.map(([key, entries]) => {
              const dayTotal = entries.reduce((sum, entry) => sum + (entry.entryType === "expense" ? entry.amount : 0), 0);

              return (
                <section key={key}>
                  <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-1.5 text-xs font-medium text-ink-3 sm:px-5">
                    <span>{dayHeading(key, todayKey, yesterdayKey)}</span>
                    {dayTotal > 0 ? <span className="tabular">{formatMoney(dayTotal, { currency, decimals: 0 })} spent</span> : null}
                  </div>
                  <ul className="divide-y divide-line">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{entry.note || entry.categoryLabel}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                            <Badge tone={entry.entryType === "credit" ? "gain" : "neutral"}>{entry.categoryLabel}</Badge>
                            <span>{formatTime(entry.occurredAt)}</span>
                          </p>
                        </div>
                        <p className={cn("tabular shrink-0 text-sm font-semibold", entry.entryType === "credit" ? "text-gain" : "text-ink")}>
                          {entry.entryType === "credit" ? "+" : "−"}{formatMoney(entry.amount, { currency })}
                        </p>
                        <div className="flex shrink-0">
                          <IconButton icon={Pencil} label="Edit entry" className="size-9" onClick={() => setSheet({ open: true, entry })} />
                          <IconButton icon={Trash2} label="Delete entry" className="size-9 hover:text-loss" onClick={() => setDeleting(entry)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
            <div className="flex flex-col items-center gap-2 border-t border-line p-4">
              {filtered.length > visible ? (
                <Button onClick={() => setVisible((count) => count + PAGE_STEP)}>Show more ({filtered.length - visible} left)</Button>
              ) : null}
              {data.recentEntriesTruncated && filtered.length <= visible ? (
                <p className="text-xs text-ink-3">Showing your most recent {data.recentEntries.length} entries.</p>
              ) : null}
            </div>
          </div>
        )}
      </Card>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={openAdd}
        aria-label="Add expense"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-2 rounded-full bg-cta px-5 text-sm font-semibold text-cta-ink shadow-lg transition active:scale-95 sm:hidden"
      >
        <Plus className="size-5" aria-hidden /> Add
      </button>

      <ExpenseEntrySheet
        open={sheet.open}
        entry={sheet.entry}
        suggestions={suggestions}
        currency={currency}
        onClose={() => setSheet((current) => ({ ...current, open: false }))}
        onSaved={setData}
      />

      <BudgetSheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        data={data}
        currency={currency}
        onSaved={setData}
      />

      <Sheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this entry?"
        description={deleting ? `${deleting.note || deleting.categoryLabel} · ${formatMoney(deleting.amount, { currency })} · ${formatDateTime(deleting.occurredAt)}` : undefined}
        size="sm"
        footer={
          <>
            <Button onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" icon={Trash2} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">This removes it from your totals and cannot be undone.</p>
      </Sheet>
    </Page>
  );
}

function HeroStat({ label, value, caption, tone = "ink" }: { label: string; value: string; caption?: string; tone?: "ink" | "loss" }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className={cn("tabular mt-1 truncate text-lg font-semibold", tone === "loss" ? "text-loss" : "text-ink")}>{value}</dd>
      {caption ? <p className="mt-0.5 truncate text-xs text-ink-3">{caption}</p> : null}
    </div>
  );
}

function BudgetSheet({
  open,
  onClose,
  data,
  currency,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  data: ExpenseDashboardData;
  currency: string;
  onSaved: (dashboard: ExpenseDashboardData) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Cycle budget" description={`${data.cycle.label} · 5th to 4th`} size="sm">
      <BudgetForm key={String(data.budget.amount)} data={data} currency={currency} onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}

function BudgetForm({ data, currency, onClose, onSaved }: { data: ExpenseDashboardData; currency: string; onClose: () => void; onSaved: (dashboard: ExpenseDashboardData) => void }) {
  const [amount, setAmount] = useState(data.budget.amount ? String(data.budget.amount) : "");
  const [saving, setSaving] = useState(false);
  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function save() {
    setSaving(true);

    try {
      const response = await fetch("/api/expenses/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed }),
      });
      const result = (await response.json().catch(() => ({}))) as { message?: string; dashboard?: ExpenseDashboardData };

      if (!response.ok || !result.dashboard) throw new Error(result.message || "Unable to save budget.");
      toast.success("Budget saved.");
      onSaved(result.dashboard);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save budget.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); if (valid && !saving) void save(); }} className="space-y-4">
      <Field label={`Budget for this cycle (${currency})`}>
        <Input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="13000" className="h-12 text-lg" />
      </Field>
      <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-3">
        Your budget carries over automatically: every new cycle starts with the latest amount, so you only edit it when it changes.
      </p>
      <div className="flex gap-2">
        <Button type="button" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" className="flex-[2]" loading={saving} disabled={!valid}>Save budget</Button>
      </div>
    </form>
  );
}
