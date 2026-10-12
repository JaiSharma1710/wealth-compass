import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
  expenseEntryLean: vi.fn(),
  expenseBudgetLean: vi.fn(),
}));

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: mocks.connectToDatabase,
}));

vi.mock("@/lib/models/expense-entry", () => ({
  ExpenseEntry: {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        lean: mocks.expenseEntryLean,
      })),
    })),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/models/expense-budget", () => ({
  ExpenseBudget: {
    findOne: vi.fn(() => ({
      lean: mocks.expenseBudgetLean,
    })),
  },
}));

import { getExpenseDashboard } from "@/lib/expenses";

describe("expense dashboard allocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connectToDatabase.mockResolvedValue(undefined);
    mocks.expenseBudgetLean.mockResolvedValue({
      _id: "budget-1",
      userId: "507f1f77bcf86cd799439011",
      cycleStartDate: new Date("2026-08-04T18:30:00.000Z"),
      cycleEndDate: new Date("2026-09-04T18:29:59.999Z"),
      startYear: 2026,
      startMonth: 8,
      amount: 30000,
    });
  });

  it("spreads expense totals across covered days", async () => {
    mocks.expenseEntryLean.mockResolvedValue([
      {
        _id: "expense-1",
        userId: "507f1f77bcf86cd799439011",
        entryType: "expense",
        amount: 5000,
        spreadDays: 10,
        note: "Groceries",
        occurredAt: new Date("2026-08-20T04:30:00.000Z"),
        createdAt: new Date("2026-08-20T04:30:00.000Z"),
      },
    ]);

    const dashboard = await getExpenseDashboard("507f1f77bcf86cd799439011", {
      now: new Date("2026-08-24T12:00:00.000Z"),
    });

    expect(dashboard.todaySummary.expenseTotal).toBe(500);
    expect(dashboard.weekSummary.expenseTotal).toBe(500);
    expect(dashboard.cycleSummary.expenseTotal).toBe(2500);
    expect(dashboard.entriesPage.entries[0]).toMatchObject({
      amount: 5000,
      spreadDays: 10,
      dailyAllocatedAmount: 500,
      spreadStartAt: "2026-08-19T18:30:00.000Z",
      spreadEndAt: "2026-08-29T18:29:59.999Z",
    });
  });
});
