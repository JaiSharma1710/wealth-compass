import { describe, expect, it } from "vitest";

import {
  computeHealthSummary,
  getExpenseCycleForDate,
  parseIstDateTime,
  validateExpenseEntryInput,
} from "@/lib/expenses-calculations";

describe("expense cycle calculations", () => {
  it("keeps May 4th in the April cycle", () => {
    const cycle = getExpenseCycleForDate(new Date("2026-05-04T18:29:00.000Z"));

    expect(cycle.startYear).toBe(2026);
    expect(cycle.startMonth).toBe(4);
    expect(cycle.startDate).toBe("2026-04-04T18:30:00.000Z");
    expect(cycle.endDate).toBe("2026-05-04T18:29:59.999Z");
  });

  it("moves May 5th into the May cycle at IST midnight", () => {
    const cycle = getExpenseCycleForDate(new Date("2026-05-04T18:30:00.000Z"));

    expect(cycle.startYear).toBe(2026);
    expect(cycle.startMonth).toBe(5);
    expect(cycle.startDate).toBe("2026-05-04T18:30:00.000Z");
    expect(cycle.endDate).toBe("2026-06-04T18:29:59.999Z");
  });

  it("parses datetime-local values as IST", () => {
    expect(parseIstDateTime("2026-06-05T00:00")?.toISOString()).toBe(
      "2026-06-04T18:30:00.000Z"
    );
  });
});

describe("expense health summary", () => {
  it("reports over pace before the budget is projected to be exceeded", () => {
    const health = computeHealthSummary(10000, 3000, {
      key: "2026-06",
      label: "Jun 2026",
      startDate: "2026-06-04T18:30:00.000Z",
      endDate: "2026-07-04T18:29:59.999Z",
      startYear: 2026,
      startMonth: 6,
      totalDays: 30,
      elapsedDays: 5,
      remainingDaysIncludingToday: 26,
    });

    expect(health.averageDailyExpense).toBe(600);
    expect(health.expectedDailyExpense).toBe(269.23);
    expect(health.status).toBe("over_budget");
  });

  it("reports on track when the current pace fits within the cycle budget", () => {
    const health = computeHealthSummary(15000, 3000, {
      key: "2026-06",
      label: "Jun 2026",
      startDate: "2026-06-04T18:30:00.000Z",
      endDate: "2026-07-04T18:29:59.999Z",
      startYear: 2026,
      startMonth: 6,
      totalDays: 30,
      elapsedDays: 10,
      remainingDaysIncludingToday: 21,
    });

    expect(health.averageDailyExpense).toBe(300);
    expect(health.expectedDailyExpense).toBe(571.43);
    expect(health.status).toBe("on_track");
  });

  it("does not extrapolate a few early large purchases across the whole cycle", () => {
    const cycle = {
      key: "2026-10",
      label: "Oct 2026",
      startDate: "2026-10-04T18:30:00.000Z",
      endDate: "2026-11-04T18:29:59.999Z",
      startYear: 2026,
      startMonth: 10,
      totalDays: 31,
      elapsedDays: 3,
      remainingDaysIncludingToday: 29,
    };
    const health = computeHealthSummary(13000, 3371, cycle, { expenseTotal: 4130, totalDays: 31 });

    expect(health.projectedCycleSpend).toBeLessThan(13000);
    expect(health.status).not.toBe("over_budget");
  });
});

describe("validateExpenseEntryInput", () => {
  const now = new Date("2026-10-07T06:00:00.000Z");
  const base = { entryType: "expense", amount: 120, note: " cng ", occurredAt: "2026-10-07T10:00" };

  it("normalises and infers the category", () => {
    const valid = validateExpenseEntryInput(base, now);
    expect(valid.note).toBe("cng");
    expect(valid.category).toBe("transport");
    expect(valid.amount).toBe(120);
  });

  it("rejects bad amounts, future dates and mismatched categories", () => {
    expect(() => validateExpenseEntryInput({ ...base, amount: 0 }, now)).toThrow(/greater than zero/);
    expect(() => validateExpenseEntryInput({ ...base, amount: Number.NaN }, now)).toThrow();
    expect(() => validateExpenseEntryInput({ ...base, occurredAt: "2026-10-08T10:00" }, now)).toThrow(/Future/);
    expect(() => validateExpenseEntryInput({ ...base, occurredAt: "nope" }, now)).toThrow(/valid/);
    expect(() => validateExpenseEntryInput({ ...base, category: "income" }, now)).toThrow(/Category/);
    expect(() => validateExpenseEntryInput({ ...base, entryType: "transfer" }, now)).toThrow(/Entry type/);
  });

  it("accepts a valid credit category", () => {
    expect(validateExpenseEntryInput({ ...base, entryType: "credit", category: "refund" }, now).category).toBe("refund");
  });
});
