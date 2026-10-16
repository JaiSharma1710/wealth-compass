import { describe, expect, it } from "vitest";

import { availableAnnual, curve, piotroskiScore, ratingFor, scoreStock } from "@/lib/stock-model/score";
import type { FinancialPeriod, StockFundamentals } from "@/lib/stock-model/types";

function period(date: string, scale: number, extra: Partial<FinancialPeriod> = {}): FinancialPeriod {
  return {
    date,
    totalRevenue: 1000 * scale,
    grossProfit: 450 * scale,
    operatingIncome: 220 * scale,
    EBIT: 220 * scale,
    netIncome: 160 * scale,
    dilutedEPS: 16 * scale,
    interestExpense: 5,
    totalAssets: 1000 * scale,
    currentAssets: 500 * scale,
    currentLiabilities: 200 * scale,
    stockholdersEquity: 700 * scale,
    totalDebt: 50,
    cashAndCashEquivalents: 100,
    operatingCashFlow: 190 * scale,
    capitalExpenditure: -40 * scale,
    ordinarySharesNumber: 10,
    ...extra,
  };
}

const prices = Array.from({ length: 60 }, (_, index) => {
  const date = new Date(Date.UTC(2022, index, 28));
  const close = 300 * 1.015 ** index;
  return { date: date.toISOString().slice(0, 10), close, adjClose: close };
});

const compounder: StockFundamentals = {
  symbol: "GOOD.NS",
  name: "Good Co",
  sector: "Consumer Defensive",
  industry: "Household & Personal Products",
  annual: [period("2023-03-31", 1), period("2024-03-31", 1.15), period("2025-03-31", 1.32), period("2026-03-31", 1.52)],
  quarterly: [],
  prices,
};

describe("stock model", () => {
  it("scores along piecewise-linear benchmarks", () => {
    expect(curve(0.15, [[0, 0], [0.1, 50], [0.2, 100]])).toBe(75);
    expect(curve(-1, [[0, 0], [1, 100]])).toBe(0);
    expect(curve(null, [[0, 0], [1, 100]])).toBeNull();
    expect(ratingFor(80)).toBe("strong");
    expect(ratingFor(20)).toBe("avoid");
  });

  it("only uses results published 90 days after year end (no look-ahead)", () => {
    expect(availableAnnual(compounder.annual, new Date("2025-06-01")).map((p) => p.date)).toEqual(["2023-03-31", "2024-03-31"]);
    expect(availableAnnual(compounder.annual, new Date("2025-07-01")).length).toBe(3);
  });

  it("computes a Piotroski score from two years", () => {
    const score = piotroskiScore(compounder.annual[3], compounder.annual[2]);
    expect(score).toBeGreaterThanOrEqual(4);
    expect(score).toBeLessThanOrEqual(9);
  });

  it("rates a consistent high-ROCE grower highly and passes Coffee Can", () => {
    const card = scoreStock(compounder, { asOf: new Date("2026-08-01") })!;

    expect(card.isFinancial).toBe(false);
    expect(card.pillars.find((p) => p.pillar === "quality")?.score).toBeGreaterThanOrEqual(80);
    expect(card.pillars.find((p) => p.pillar === "growth")?.score).toBeGreaterThanOrEqual(75);
    expect(card.coffeeCan.passed).toBe(true);
    expect(["strong", "good"]).toContain(card.rating);
  });

  it("penalises a shrinking, indebted business", () => {
    const weak: StockFundamentals = {
      ...compounder,
      symbol: "WEAK.NS",
      annual: [
        period("2023-03-31", 1, { totalDebt: 2000, interestExpense: 150 }),
        period("2024-03-31", 0.85, { totalDebt: 2200, interestExpense: 170, netIncome: 20 }),
        period("2025-03-31", 0.7, { totalDebt: 2400, interestExpense: 190, netIncome: -30, operatingCashFlow: -10 }),
      ],
    };
    const card = scoreStock(weak, { asOf: new Date("2025-08-01") })!;

    expect(card.score).toBeLessThan(scoreStock(compounder, { asOf: new Date("2025-08-01") })!.score);
    expect(card.coffeeCan.passed).toBe(false);
    expect(card.concerns.length).toBeGreaterThan(0);
  });

  it("uses the lender branch for banks", () => {
    const bank = { ...compounder, symbol: "BANK.NS", sector: "Financial Services", industry: "Banks - Regional" };
    const card = scoreStock(bank, { asOf: new Date("2026-08-01") })!;

    expect(card.isFinancial).toBe(true);
    expect(card.pillars.find((p) => p.pillar === "earningsQuality")?.score).toBeNull();
    expect(card.pillars.find((p) => p.pillar === "quality")?.metrics.map((m) => m.key)).toContain("roa");
  });
});
