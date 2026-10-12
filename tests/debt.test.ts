import { describe, expect, it } from "vitest";

import { calculateDebtSchedule } from "@/lib/debt-calculations";

describe("debt calculations", () => {
  it("creates zero-interest no-cost EMI schedules with paid rows from EMI date", () => {
    const schedule = calculateDebtSchedule({
      principalAmount: 12000,
      annualInterestRate: 0,
      durationMonths: 12,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      emiPaymentDay: 5,
      plannedPrepaymentAmount: 0,
      asOfDate: new Date("2026-03-05T00:00:00.000Z"),
    });

    expect(schedule).toHaveLength(12);
    expect(schedule[0].emiAmount).toBe(1000);
    expect(schedule[0].interestPaid).toBe(0);
    expect(schedule.filter((row) => row.isPaid)).toHaveLength(3);
    expect(schedule.at(-1)?.closingBalance).toBe(0);
  });

  it("shortens the plan when monthly prepayments are applied", () => {
    const withoutPrepayment = calculateDebtSchedule({
      principalAmount: 100000,
      annualInterestRate: 12,
      durationMonths: 24,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      emiPaymentDay: 10,
      plannedPrepaymentAmount: 0,
      asOfDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    const withPrepayment = calculateDebtSchedule({
      principalAmount: 100000,
      annualInterestRate: 12,
      durationMonths: 24,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      emiPaymentDay: 10,
      plannedPrepaymentAmount: 5000,
      asOfDate: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(withPrepayment.length).toBeLessThan(withoutPrepayment.length);
    expect(withPrepayment.at(-1)?.closingBalance).toBe(0);
  });
});
