import type { ExpenseCycleSummary, ExpenseHealthSummary, ExpenseWindowSummary } from "@/lib/expenses.types";

export const EXPENSE_TRACKER_TIMEZONE = "Asia/Kolkata";
export const EXPENSE_ENTRY_PAGE_SIZE = 10;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ExpenseCycleDescriptor = ExpenseCycleSummary;

type IstParts = {
  year: number;
  monthIndex: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
  weekday: number;
};

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toIstShiftedDate(date: Date) {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

export function getIstParts(date: Date): IstParts {
  const shifted = toIstShiftedDate(date);

  return {
    year: shifted.getUTCFullYear(),
    monthIndex: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    milliseconds: shifted.getUTCMilliseconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function createUtcDateFromIstParts(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0
) {
  return new Date(
    Date.UTC(year, monthIndex, day, hours, minutes, seconds, milliseconds) - IST_OFFSET_MS
  );
}

export function formatIstDate(date: Date) {
  const parts = getIstParts(date);

  return `${parts.year}-${String(parts.monthIndex + 1).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatIstDateTimeForInput(date: Date) {
  const parts = getIstParts(date);

  return `${formatIstDate(date)}T${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

export function parseIstDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes] = match;
  const parsed = createUtcDateFromIstParts(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMonthLabel(startYear: number, startMonth: number) {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: EXPENSE_TRACKER_TIMEZONE,
  }).format(createUtcDateFromIstParts(startYear, startMonth - 1, 5));
}

export function getExpenseCycleForDate(date: Date): ExpenseCycleDescriptor {
  const parts = getIstParts(date);
  const cycleStartMonthIndex = parts.day >= 5 ? parts.monthIndex : parts.monthIndex - 1;
  const cycleStartDate = createUtcDateFromIstParts(parts.year, cycleStartMonthIndex, 5);
  const cycleStartParts = getIstParts(cycleStartDate);
  const nextCycleStartDate = createUtcDateFromIstParts(
    cycleStartParts.year,
    cycleStartParts.monthIndex + 1,
    5
  );
  const cycleEndDate = new Date(nextCycleStartDate.getTime() - 1);
  const totalDays = Math.round((nextCycleStartDate.getTime() - cycleStartDate.getTime()) / DAY_MS);
  const currentIstDayStart = createUtcDateFromIstParts(parts.year, parts.monthIndex, parts.day);
  const elapsedDays = Math.max(
    1,
    Math.floor((currentIstDayStart.getTime() - cycleStartDate.getTime()) / DAY_MS) + 1
  );
  const currentIstDayEnd = createUtcDateFromIstParts(
    parts.year,
    parts.monthIndex,
    parts.day,
    23,
    59,
    59,
    999
  );
  const remainingDaysIncludingToday = Math.max(
    1,
    Math.ceil((cycleEndDate.getTime() - currentIstDayEnd.getTime() + 1) / DAY_MS)
  );

  return {
    key: `${cycleStartParts.year}-${String(cycleStartParts.monthIndex + 1).padStart(2, "0")}`,
    label: formatMonthLabel(cycleStartParts.year, cycleStartParts.monthIndex + 1),
    startDate: cycleStartDate.toISOString(),
    endDate: cycleEndDate.toISOString(),
    startYear: cycleStartParts.year,
    startMonth: cycleStartParts.monthIndex + 1,
    totalDays,
    elapsedDays,
    remainingDaysIncludingToday,
  };
}

export function getExpenseCycleFromStart(startYear: number, startMonth: number) {
  const cycleStartDate = createUtcDateFromIstParts(startYear, startMonth - 1, 5);
  const nextCycleStartDate = createUtcDateFromIstParts(startYear, startMonth, 5);
  const cycleEndDate = new Date(nextCycleStartDate.getTime() - 1);
  const totalDays = Math.round((nextCycleStartDate.getTime() - cycleStartDate.getTime()) / DAY_MS);

  return {
    key: `${startYear}-${String(startMonth).padStart(2, "0")}`,
    label: formatMonthLabel(startYear, startMonth),
    startDate: cycleStartDate.toISOString(),
    endDate: cycleEndDate.toISOString(),
    startYear,
    startMonth,
    totalDays,
    elapsedDays: totalDays,
    remainingDaysIncludingToday: 0,
  };
}

export function getCurrentIstWeekRange(date: Date) {
  const parts = getIstParts(date);
  const offsetToMonday = (parts.weekday + 6) % 7;
  const startDate = createUtcDateFromIstParts(parts.year, parts.monthIndex, parts.day - offsetToMonday);
  const endDate = createUtcDateFromIstParts(parts.year, parts.monthIndex, parts.day - offsetToMonday + 6, 23, 59, 59, 999);

  return { startDate, endDate };
}

export function computeWindowSummary(
  label: string,
  entries: { entryType: "expense" | "credit"; amount: number }[]
): ExpenseWindowSummary {
  const expenseTotal = roundCurrency(
    entries.reduce((sum, entry) => sum + (entry.entryType === "expense" ? entry.amount : 0), 0)
  );
  const creditTotal = roundCurrency(
    entries.reduce((sum, entry) => sum + (entry.entryType === "credit" ? entry.amount : 0), 0)
  );

  return {
    label,
    expenseTotal,
    creditTotal,
    netTotal: roundCurrency(creditTotal - expenseTotal),
    entryCount: entries.length,
  };
}

export function computeHealthSummary(
  budgetAmount: number | null,
  cycleExpenseTotal: number,
  cycle: ExpenseCycleDescriptor
): ExpenseHealthSummary {
  if (budgetAmount == null) {
    return {
      averageDailyExpense: 0,
      expectedDailyExpense: null,
      projectedCycleSpend: 0,
      remainingBudget: null,
      status: "needs_budget",
      overshootAmount: 0,
      isOverExpectedDaily: null,
    };
  }

  const averageDailyExpense = roundCurrency(
    cycle.elapsedDays > 0 ? cycleExpenseTotal / cycle.elapsedDays : 0
  );
  const remainingBudget = roundCurrency(budgetAmount - cycleExpenseTotal);
  const expectedDailyExpense = roundCurrency(
    cycle.remainingDaysIncludingToday > 0
      ? remainingBudget / cycle.remainingDaysIncludingToday
      : remainingBudget
  );
  const projectedCycleSpend = roundCurrency(averageDailyExpense * cycle.totalDays);
  const overshootAmount = roundCurrency(Math.max(projectedCycleSpend - budgetAmount, 0));
  const isOverExpectedDaily = averageDailyExpense > expectedDailyExpense;

  return {
    averageDailyExpense,
    expectedDailyExpense,
    projectedCycleSpend,
    remainingBudget,
    status:
      projectedCycleSpend > budgetAmount
        ? "over_budget"
        : isOverExpectedDaily
          ? "over_pace"
          : "on_track",
    overshootAmount,
    isOverExpectedDaily,
  };
}
