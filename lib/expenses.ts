import "server-only";

import { isValidObjectId } from "mongoose";

import { getCategoryLabel, resolveCategory } from "@/lib/expense-categories";
import { connectToDatabase } from "@/lib/mongodb";
import {
  computeHealthSummary,
  computeWindowSummary,
  createUtcDateFromIstParts,
  EXPENSE_ENTRY_PAGE_SIZE,
  formatIstDate,
  formatIstDateTimeForInput,
  getCurrentIstWeekRange,
  getExpenseCycleForDate,
  getExpenseCycleFromStart,
  getIstParts,
  roundCurrency,
  validateExpenseEntryInput,
} from "@/lib/expenses-calculations";
import type {
  ExpenseCategoryBreakdown,
  ExpenseDashboardData,
  ExpenseEntrySummary,
  ExpenseHistoryPoint,
  SaveExpenseBudgetInput,
  SaveExpenseEntryInput,
  UpdateExpenseEntryInput,
} from "@/lib/expenses.types";
import { ExpenseBudget } from "@/lib/models/expense-budget";
import { ExpenseEntry } from "@/lib/models/expense-entry";

const RECENT_ENTRIES_LIMIT = 400;

type ExpenseEntryRecord = {
  _id: { toString(): string } | string;
  userId: { toString(): string } | string;
  entryType: "expense" | "credit";
  amount: number;
  spreadDays?: number;
  note?: string;
  category?: string;
  occurredAt: Date;
  createdAt?: Date;
};

type ExpenseBudgetRecord = {
  _id: { toString(): string } | string;
  userId: { toString(): string } | string;
  cycleStartDate: Date;
  cycleEndDate: Date;
  startYear: number;
  startMonth: number;
  amount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

function ensurePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function normalizeSpreadDays(value: number | undefined, entryType: "expense" | "credit") {
  if (entryType === "credit") {
    return 1;
  }

  const days = Number(value || 1);

  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("Days covered must be between 1 and 366.");
  }

  return days;
}

function ensureValidCycleTarget(startYear: number, startMonth: number) {
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > 9999) {
    throw new Error("Cycle year must be valid.");
  }

  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) {
    throw new Error("Cycle month must be between 1 and 12.");
  }
}

function normalizeEntry(record: ExpenseEntryRecord): ExpenseEntrySummary {
  const category = resolveCategory(record.entryType, record.category, record.note || "");
  const spreadDays = Math.max(1, record.spreadDays || 1);

  return {
    id: String(record._id),
    entryType: record.entryType,
    amount: record.amount,
    spreadDays,
    dailyAllocatedAmount: roundCurrency(record.amount / spreadDays),
    spreadStartAt: getSpreadStartDate(record).toISOString(),
    spreadEndAt: getSpreadEndDate(record).toISOString(),
    note: record.note || "",
    category,
    categoryLabel: getCategoryLabel(category),
    occurredAt: record.occurredAt.toISOString(),
  };
}

function buildCategoryBreakdown(
  cycleEntries: ExpenseEntryRecord[],
  previousCycleEntries: ExpenseEntryRecord[]
): ExpenseCategoryBreakdown[] {
  const sumByCategory = (entries: ExpenseEntryRecord[]) => {
    const totals = new Map<string, { amount: number; count: number }>();

    for (const entry of entries) {
      if (entry.entryType !== "expense") continue;
      const key = resolveCategory("expense", entry.category, entry.note || "");
      const current = totals.get(key) || { amount: 0, count: 0 };
      current.amount += entry.amount;
      current.count += 1;
      totals.set(key, current);
    }

    return totals;
  };
  const current = sumByCategory(cycleEntries);
  const previous = sumByCategory(previousCycleEntries);
  const total = [...current.values()].reduce((sum, entry) => sum + entry.amount, 0);

  return [...current.entries()]
    .map(([key, value]) => ({
      key,
      label: getCategoryLabel(key),
      amount: roundCurrency(value.amount),
      count: value.count,
      percentage: total > 0 ? roundCurrency((value.amount / total) * 100) : 0,
      previousAmount: roundCurrency(previous.get(key)?.amount || 0),
    }))
    .sort((left, right) => right.amount - left.amount);
}

// Budgets roll forward: a new cycle without its own budget inherits the latest one.
async function ensureCurrentCycleBudget(userId: string, now: Date) {
  const cycle = getExpenseCycleForDate(now);
  const existing = await loadBudgetForCycle(userId, cycle.startYear, cycle.startMonth);

  if (existing) {
    return existing;
  }

  await connectToDatabase();

  const latest = (await ExpenseBudget.findOne({ userId })
    .sort({ cycleStartDate: -1 })
    .lean()) as ExpenseBudgetRecord | null;

  if (!latest) {
    return null;
  }

  await ExpenseBudget.updateOne(
    { userId, startYear: cycle.startYear, startMonth: cycle.startMonth },
    {
      $setOnInsert: {
        userId,
        startYear: cycle.startYear,
        startMonth: cycle.startMonth,
        cycleStartDate: createUtcDateFromIstParts(cycle.startYear, cycle.startMonth - 1, 5),
        cycleEndDate: new Date(createUtcDateFromIstParts(cycle.startYear, cycle.startMonth, 5).getTime() - 1),
        amount: latest.amount,
      },
    },
    { upsert: true }
  );

  return loadBudgetForCycle(userId, cycle.startYear, cycle.startMonth);
}

function sortEntries(entries: ExpenseEntryRecord[]) {
  return [...entries].sort((left, right) => {
    const byOccurredAt = right.occurredAt.getTime() - left.occurredAt.getTime();

    if (byOccurredAt !== 0) {
      return byOccurredAt;
    }

    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
  });
}

function isWithinRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function getIstDayStart(date: Date) {
  const parts = getIstParts(date);
  return createUtcDateFromIstParts(parts.year, parts.monthIndex, parts.day);
}

function getIstDayEnd(date: Date) {
  const parts = getIstParts(date);
  return createUtcDateFromIstParts(parts.year, parts.monthIndex, parts.day, 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getSpreadStartDate(entry: ExpenseEntryRecord) {
  return getIstDayStart(entry.occurredAt);
}

function getSpreadEndDate(entry: ExpenseEntryRecord) {
  return getIstDayEnd(addDays(getSpreadStartDate(entry), Math.max(1, entry.spreadDays || 1) - 1));
}

function countSpreadDaysInRange(entry: ExpenseEntryRecord, start: Date, end: Date, now: Date) {
  const spreadStart = getSpreadStartDate(entry);
  const spreadEnd = getIstDayStart(getSpreadEndDate(entry));
  const windowStart = getIstDayStart(start);
  const windowEnd = getIstDayStart(end);
  const today = getIstDayStart(now);
  const firstDay = new Date(
    Math.max(spreadStart.getTime(), windowStart.getTime())
  );
  const lastDay = new Date(
    Math.min(spreadEnd.getTime(), windowEnd.getTime(), today.getTime())
  );

  if (lastDay < firstDay) {
    return 0;
  }

  return Math.floor((lastDay.getTime() - firstDay.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function getEntryAmountForWindow(entry: ExpenseEntryRecord, start: Date, end: Date, now: Date) {
  if (entry.entryType === "credit") {
    return isWithinRange(entry.occurredAt, start, end) ? roundCurrency(entry.amount) : 0;
  }

  const spreadDays = Math.max(1, entry.spreadDays || 1);

  if (spreadDays === 1) {
    return isWithinRange(entry.occurredAt, start, end) ? roundCurrency(entry.amount) : 0;
  }

  const overlappingDays = countSpreadDaysInRange(entry, start, end, now);
  return overlappingDays > 0 ? roundCurrency((entry.amount * overlappingDays) / spreadDays) : 0;
}

// Keeps every field (note, category...) and replaces amount with the share that falls
// inside the window, so multi-day expenses are spread across the days they cover.
function buildWindowEntries(
  entries: ExpenseEntryRecord[],
  start: Date,
  end: Date,
  now: Date
): ExpenseEntryRecord[] {
  return entries
    .map((entry) => ({ ...entry, amount: getEntryAmountForWindow(entry, start, end, now) }))
    .filter((entry) => entry.amount > 0);
}

function buildDailyHistory(entries: ExpenseEntryRecord[], now: Date) {
  const todayParts = getIstParts(now);

  return Array.from({ length: 14 }, (_, index) => {
    const dayStart = createUtcDateFromIstParts(
      todayParts.year,
      todayParts.monthIndex,
      todayParts.day - (13 - index)
    );
    const dayEnd = createUtcDateFromIstParts(
      todayParts.year,
      todayParts.monthIndex,
      todayParts.day - (13 - index),
      23,
      59,
      59,
      999
    );
    const dayEntries = buildWindowEntries(entries, dayStart, dayEnd, now);
    const summary = computeWindowSummary("Daily", dayEntries);

    return {
      key: formatIstDate(dayStart),
      label: new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }).format(dayStart),
      expenseTotal: summary.expenseTotal,
      creditTotal: summary.creditTotal,
      netTotal: summary.netTotal,
    } satisfies ExpenseHistoryPoint;
  });
}

function buildWeeklyHistory(entries: ExpenseEntryRecord[], now: Date) {
  const currentWeek = getCurrentIstWeekRange(now);

  return Array.from({ length: 8 }, (_, index) => {
    const offsetWeeks = 7 - index;
    const weekStart = new Date(currentWeek.startDate.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(currentWeek.endDate.getTime() - offsetWeeks * 7 * 24 * 60 * 60 * 1000);
    const weekEntries = buildWindowEntries(entries, weekStart, weekEnd, now);
    const summary = computeWindowSummary("Weekly", weekEntries);
    const startLabel = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    }).format(weekStart);
    const endLabel = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    }).format(weekEnd);

    return {
      key: formatIstDate(weekStart),
      label: `${startLabel} - ${endLabel}`,
      expenseTotal: summary.expenseTotal,
      creditTotal: summary.creditTotal,
      netTotal: summary.netTotal,
    } satisfies ExpenseHistoryPoint;
  });
}

function buildMonthlyHistory(entries: ExpenseEntryRecord[], now: Date) {
  const currentCycle = getExpenseCycleForDate(now);

  return Array.from({ length: 6 }, (_, index) => {
    const startMonthIndex = currentCycle.startMonth - 1 - (5 - index);
    const cycleStart = createUtcDateFromIstParts(currentCycle.startYear, startMonthIndex, 5);
    const cycleParts = getIstParts(cycleStart);
    const cycle = getExpenseCycleFromStart(cycleParts.year, cycleParts.monthIndex + 1);
    const cycleEntries = buildWindowEntries(
      entries,
      new Date(cycle.startDate),
      new Date(cycle.endDate),
      now
    );
    const summary = computeWindowSummary("Monthly", cycleEntries);

    return {
      key: cycle.key,
      label: cycle.label,
      expenseTotal: summary.expenseTotal,
      creditTotal: summary.creditTotal,
      netTotal: summary.netTotal,
    } satisfies ExpenseHistoryPoint;
  });
}

async function loadEntries(userId: string) {
  await connectToDatabase();

  return (await ExpenseEntry.find({ userId }).sort({ occurredAt: -1, createdAt: -1 }).lean()) as ExpenseEntryRecord[];
}

async function loadBudgetForCycle(userId: string, startYear: number, startMonth: number) {
  await connectToDatabase();

  return (await ExpenseBudget.findOne({
    userId,
    startYear,
    startMonth,
  }).lean()) as ExpenseBudgetRecord | null;
}

export async function getExpenseDashboard(
  userId: string,
  options?: { page?: number; now?: Date }
): Promise<ExpenseDashboardData> {
  const now = options?.now || new Date();
  const page = Math.max(1, options?.page || 1);
  const entries = sortEntries(await loadEntries(userId));
  const cycle = getExpenseCycleForDate(now);
  const cycleBudget = await ensureCurrentCycleBudget(userId, now);
  const todayParts = getIstParts(now);
  const todayStart = createUtcDateFromIstParts(todayParts.year, todayParts.monthIndex, todayParts.day);
  const todayEnd = createUtcDateFromIstParts(
    todayParts.year,
    todayParts.monthIndex,
    todayParts.day,
    23,
    59,
    59,
    999
  );
  const weekRange = getCurrentIstWeekRange(now);
  const cycleStart = new Date(cycle.startDate);
  const cycleEnd = new Date(cycle.endDate);
  const todayEntries = buildWindowEntries(entries, todayStart, todayEnd, now);
  const weekEntries = buildWindowEntries(entries, weekRange.startDate, weekRange.endDate, now);
  const cycleEntries = buildWindowEntries(entries, cycleStart, cycleEnd, now);
  const cycleSummary = computeWindowSummary("Current Cycle", cycleEntries);
  const previousCycleStartParts = getIstParts(new Date(cycleStart.getTime() - 24 * 60 * 60 * 1000));
  const previousCycle = getExpenseCycleForDate(
    createUtcDateFromIstParts(
      previousCycleStartParts.year,
      previousCycleStartParts.monthIndex,
      previousCycleStartParts.day,
      12
    )
  );
  const previousCycleEntries = buildWindowEntries(
    entries,
    new Date(previousCycle.startDate),
    new Date(previousCycle.endDate),
    now
  );
  const totalPages = Math.max(1, Math.ceil(entries.length / EXPENSE_ENTRY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * EXPENSE_ENTRY_PAGE_SIZE;

  return {
    defaultOccurredAt: formatIstDateTimeForInput(now),
    cycle,
    budget: {
      amount: cycleBudget?.amount ?? null,
      hasBudget: Boolean(cycleBudget),
      isRequired: !cycleBudget,
      cycle,
    },
    health: computeHealthSummary(cycleBudget?.amount ?? null, cycleSummary.expenseTotal, cycle, {
      expenseTotal: computeWindowSummary("Previous Cycle", previousCycleEntries).expenseTotal,
      totalDays: previousCycle.totalDays,
    }),
    todaySummary: computeWindowSummary("Today", todayEntries),
    weekSummary: computeWindowSummary("This Week", weekEntries),
    cycleSummary,
    history: {
      daily: buildDailyHistory(entries, now),
      weekly: buildWeeklyHistory(entries, now),
      monthly: buildMonthlyHistory(entries, now),
    },
    entriesPage: {
      entries: entries.slice(pageStart, pageStart + EXPENSE_ENTRY_PAGE_SIZE).map(normalizeEntry),
      page: currentPage,
      pageSize: EXPENSE_ENTRY_PAGE_SIZE,
      totalCount: entries.length,
      totalPages,
    },
    categoryBreakdown: buildCategoryBreakdown(cycleEntries, previousCycleEntries),
    previousCycleSummary: computeWindowSummary("Previous Cycle", previousCycleEntries),
    recentEntries: entries.slice(0, RECENT_ENTRIES_LIMIT).map(normalizeEntry),
    recentEntriesTruncated: entries.length > RECENT_ENTRIES_LIMIT,
  };
}

export async function saveExpenseEntry(userId: string, input: SaveExpenseEntryInput) {
  const valid = {
    ...validateExpenseEntryInput(input),
    spreadDays: normalizeSpreadDays(input.spreadDays, input.entryType),
  };
  const currentCycleBudget = await ensureCurrentCycleBudget(userId, new Date());

  if (!currentCycleBudget) {
    throw new Error("Set the current cycle budget before adding a new entry.");
  }

  await connectToDatabase();

  await ExpenseEntry.create({ userId, ...valid });

  return getExpenseDashboard(userId);
}

export async function updateExpenseEntry(userId: string, entryId: string, input: UpdateExpenseEntryInput) {
  if (!isValidObjectId(entryId)) {
    throw new Error("Entry not found.");
  }

  const valid = {
    ...validateExpenseEntryInput(input),
    spreadDays: normalizeSpreadDays(input.spreadDays, input.entryType),
  };

  await connectToDatabase();

  const result = await ExpenseEntry.updateOne({ _id: entryId, userId }, { $set: valid });

  if (result.matchedCount === 0) {
    throw new Error("Entry not found.");
  }

  return getExpenseDashboard(userId);
}

export async function deleteExpenseEntry(userId: string, entryId: string) {
  if (!isValidObjectId(entryId)) {
    throw new Error("Entry not found.");
  }

  await connectToDatabase();

  const result = await ExpenseEntry.deleteOne({ _id: entryId, userId });

  if (result.deletedCount === 0) {
    throw new Error("Entry not found.");
  }

  return getExpenseDashboard(userId);
}

export async function upsertExpenseBudget(userId: string, input: SaveExpenseBudgetInput) {
  ensurePositiveNumber(input.amount, "Budget amount");

  const now = new Date();
  const currentCycle = getExpenseCycleForDate(now);
  const startYear = input.startYear ?? currentCycle.startYear;
  const startMonth = input.startMonth ?? currentCycle.startMonth;

  ensureValidCycleTarget(startYear, startMonth);

  const cycleStartDate = createUtcDateFromIstParts(startYear, startMonth - 1, 5);
  const cycleEndDate = new Date(createUtcDateFromIstParts(startYear, startMonth, 5).getTime() - 1);

  await connectToDatabase();

  await ExpenseBudget.findOneAndUpdate(
    {
      userId,
      startYear,
      startMonth,
    },
    {
      $set: {
        cycleStartDate,
        cycleEndDate,
        amount: roundCurrency(input.amount),
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  return getExpenseDashboard(userId);
}

export async function getExpenseBudgetStatus(
  userId: string,
  options?: { startYear?: number; startMonth?: number; now?: Date }
) {
  const now = options?.now || new Date();
  const currentCycle = getExpenseCycleForDate(now);
  const startYear = options?.startYear ?? currentCycle.startYear;
  const startMonth = options?.startMonth ?? currentCycle.startMonth;

  ensureValidCycleTarget(startYear, startMonth);

  const budget = await loadBudgetForCycle(userId, startYear, startMonth);
  const cycle =
    startYear === currentCycle.startYear && startMonth === currentCycle.startMonth
      ? currentCycle
      : getExpenseCycleFromStart(startYear, startMonth);

  return {
    amount: budget?.amount ?? null,
    hasBudget: Boolean(budget),
    isRequired:
      startYear === currentCycle.startYear && startMonth === currentCycle.startMonth && !budget,
    cycle,
  };
}
