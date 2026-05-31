import "server-only";

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
  parseIstDateTime,
  roundCurrency,
} from "@/lib/expenses-calculations";
import type {
  ExpenseDashboardData,
  ExpenseEntrySummary,
  ExpenseHistoryPoint,
  SaveExpenseBudgetInput,
  SaveExpenseEntryInput,
} from "@/lib/expenses.types";
import { ExpenseBudget } from "@/lib/models/expense-budget";
import { ExpenseEntry } from "@/lib/models/expense-entry";

type ExpenseEntryRecord = {
  _id: { toString(): string } | string;
  userId: { toString(): string } | string;
  entryType: "expense" | "credit";
  amount: number;
  note?: string;
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

function normalizeNote(value?: string) {
  return String(value || "").trim();
}

function ensurePositiveNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
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
  return {
    id: String(record._id),
    entryType: record.entryType,
    amount: record.amount,
    note: record.note || "",
    occurredAt: record.occurredAt.toISOString(),
  };
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
    const dayEntries = entries.filter((entry) => isWithinRange(entry.occurredAt, dayStart, dayEnd));
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
    const weekEntries = entries.filter((entry) => isWithinRange(entry.occurredAt, weekStart, weekEnd));
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
    const cycleEntries = entries.filter((entry) =>
      isWithinRange(entry.occurredAt, new Date(cycle.startDate), new Date(cycle.endDate))
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
  const cycleBudget = await loadBudgetForCycle(userId, cycle.startYear, cycle.startMonth);
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
  const todayEntries = entries.filter((entry) => isWithinRange(entry.occurredAt, todayStart, todayEnd));
  const weekEntries = entries.filter((entry) =>
    isWithinRange(entry.occurredAt, weekRange.startDate, weekRange.endDate)
  );
  const cycleEntries = entries.filter((entry) => isWithinRange(entry.occurredAt, cycleStart, cycleEnd));
  const cycleSummary = computeWindowSummary("Current Cycle", cycleEntries);
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
    health: computeHealthSummary(cycleBudget?.amount ?? null, cycleSummary.expenseTotal, cycle),
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
  };
}

export async function saveExpenseEntry(userId: string, input: SaveExpenseEntryInput) {
  ensurePositiveNumber(input.amount, "Amount");

  if (input.entryType !== "expense" && input.entryType !== "credit") {
    throw new Error("Entry type must be either expense or credit.");
  }

  const occurredAt = parseIstDateTime(input.occurredAt);

  if (!occurredAt) {
    throw new Error("Please provide a valid IST date and time.");
  }

  if (normalizeNote(input.note).length > 500) {
    throw new Error("Note must be 500 characters or fewer.");
  }

  const now = new Date();

  if (occurredAt.getTime() > now.getTime()) {
    throw new Error("Future-dated entries are not allowed.");
  }

  const currentCycle = getExpenseCycleForDate(now);
  const currentCycleBudget = await loadBudgetForCycle(
    userId,
    currentCycle.startYear,
    currentCycle.startMonth
  );

  if (!currentCycleBudget) {
    throw new Error("Set the current cycle budget before adding a new entry.");
  }

  await connectToDatabase();

  await ExpenseEntry.create({
    userId,
    entryType: input.entryType,
    amount: roundCurrency(input.amount),
    note: normalizeNote(input.note),
    occurredAt,
  });

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
