import { describe, expect, it } from "vitest";

import { computeAdvisorMetrics, scoreFromBreakpoints, type AdvisorMetricInput } from "@/lib/advisor-metrics";

function baseInput(overrides: Partial<AdvisorMetricInput> = {}): AdvisorMetricInput {
  return {
    asOf: new Date("2026-10-14T00:00:00Z"),
    profile: { monthlyIncome: 100000, riskProfile: "moderate", age: 30 },
    summary: { netWorth: 1000000, totalAssets: 1600000, totalLiabilities: 600000, totalInvested: 1300000, totalGainLossPercent: 20, xirr: null },
    allocation: [
      { key: "mutualFunds", label: "Mutual Funds", value: 800000, percentage: 50 },
      { key: "stocks", label: "Stocks", value: 400000, percentage: 25 },
      { key: "cash", label: "Cash", value: 400000, percentage: 25 },
    ],
    cashBalance: 400000,
    stocks: [
      { name: "ITC", value: 300000, returnsPercent: 10 },
      { name: "HDFCBANK", value: 100000, returnsPercent: -5 },
    ],
    stocksReturnsPercent: 6,
    funds: [
      { name: "Index", value: 500000, category: "Index fund" },
      { name: "Small", value: 300000, category: "Small cap" },
    ],
    fundsReturnsPercent: 15,
    spending: { cycleSpent: 10000, budget: 30000, projected: 30000, status: "on_track", previousCycleSpent: 30000, topCategories: [] },
    loans: [{ name: "Car", annualRate: 9, outstanding: 600000, emi: 10000, monthsLeft: 70 }],
    goals: [{ name: "Trip", progressPct: 50, status: "on_track", requiredMonthly: 5000, targetDate: "2027-01-01" }],
    ...overrides,
  };
}

describe("advisor metrics", () => {
  it("interpolates scores between breakpoints and clamps outside them", () => {
    expect(scoreFromBreakpoints(-5, [[0, 0], [6, 100]])).toBe(0);
    expect(scoreFromBreakpoints(3, [[0, 0], [6, 100]])).toBe(50);
    expect(scoreFromBreakpoints(10, [[0, 0], [6, 100]])).toBe(100);
  });

  it("derives cash-flow ratios from income, spending and EMIs", () => {
    const metrics = computeAdvisorMetrics(baseInput());

    expect(metrics.monthlyEmi).toBe(10000);
    expect(metrics.monthlySpend).toBe(30000);
    expect(metrics.monthlySurplus).toBe(60000);
    expect(metrics.savingsRate).toBe(60);
    expect(metrics.emergencyMonths).toBe(10);
    expect(metrics.emiToIncome).toBe(10);
    expect(metrics.equityPercent).toBe(75);
    expect(metrics.funds.smallCapPercent).toBe(37.5);
    expect(metrics.stocks.topHolding).toEqual({ name: "ITC", percent: 75 });
    expect(metrics.stocks.worst).toEqual([{ name: "HDFCBANK", returnsPercent: -5 }]);
  });

  it("skips income-based scores when income is unknown", () => {
    const metrics = computeAdvisorMetrics(baseInput({ profile: { monthlyIncome: null, riskProfile: "moderate", age: null } }));

    expect(metrics.savingsRate).toBeNull();
    expect(metrics.scores.some((score) => score.key === "savings")).toBe(false);
    // Falls back to debt-to-assets (37.5%).
    expect(metrics.scores.find((score) => score.key === "debt")?.detail).toContain("37.5%");
    expect(metrics.healthScore).toBeGreaterThan(0);
  });
});
