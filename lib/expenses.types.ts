export const EXPENSE_ENTRY_TYPES = ["expense", "credit"] as const;
export const EXPENSE_HISTORY_GRANULARITIES = ["daily", "weekly", "monthly"] as const;

export type ExpenseEntryType = (typeof EXPENSE_ENTRY_TYPES)[number];
export type ExpenseHistoryGranularity = (typeof EXPENSE_HISTORY_GRANULARITIES)[number];

export type ExpenseCycleSummary = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  startYear: number;
  startMonth: number;
  totalDays: number;
  elapsedDays: number;
  remainingDaysIncludingToday: number;
};

export type ExpenseBudgetSummary = {
  amount: number | null;
  hasBudget: boolean;
  isRequired: boolean;
  cycle: ExpenseCycleSummary;
};

export type ExpenseHealthStatus = "needs_budget" | "on_track" | "over_pace" | "over_budget";

export type ExpenseHealthSummary = {
  averageDailyExpense: number;
  expectedDailyExpense: number | null;
  projectedCycleSpend: number;
  remainingBudget: number | null;
  status: ExpenseHealthStatus;
  overshootAmount: number;
  isOverExpectedDaily: boolean | null;
};

export type ExpenseWindowSummary = {
  label: string;
  expenseTotal: number;
  creditTotal: number;
  netTotal: number;
  entryCount: number;
};

export type ExpenseHistoryPoint = {
  key: string;
  label: string;
  expenseTotal: number;
  creditTotal: number;
  netTotal: number;
};

export type ExpenseEntrySummary = {
  id: string;
  entryType: ExpenseEntryType;
  amount: number;
  note: string;
  occurredAt: string;
};

export type ExpenseEntriesPage = {
  entries: ExpenseEntrySummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type ExpenseDashboardData = {
  defaultOccurredAt: string;
  cycle: ExpenseCycleSummary;
  budget: ExpenseBudgetSummary;
  health: ExpenseHealthSummary;
  todaySummary: ExpenseWindowSummary;
  weekSummary: ExpenseWindowSummary;
  cycleSummary: ExpenseWindowSummary;
  history: Record<ExpenseHistoryGranularity, ExpenseHistoryPoint[]>;
  entriesPage: ExpenseEntriesPage;
};

export type SaveExpenseEntryInput = {
  entryType: ExpenseEntryType;
  amount: number;
  note?: string;
  occurredAt: string;
};

export type SaveExpenseBudgetInput = {
  amount: number;
  startYear?: number;
  startMonth?: number;
};
