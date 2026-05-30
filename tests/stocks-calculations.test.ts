import { describe, expect, it } from "vitest";

import {
  calculateAverageStockPrice,
  calculateBuyCashFlow,
  calculateHoldingMetrics,
  calculateNextBuyLifecycleState,
  calculateNextSellLifecycleState,
  calculateSellSnapshot,
  calculateTodayPnL,
  calculateTodayPnLPercent,
} from "../lib/stocks-calculations";

describe("calculateAverageStockPrice", () => {
  it("returns the weighted average for multiple buy lots", () => {
    expect(
      calculateAverageStockPrice([
        { quantity: 10, price: 100 },
        { quantity: 20, price: 130 },
      ])
    ).toBe(120);
  });

  it("returns 0 for an empty list", () => {
    expect(calculateAverageStockPrice([])).toBe(0);
  });

  it("rejects zero quantity", () => {
    expect(() =>
      calculateAverageStockPrice([{ quantity: 0, price: 100 }])
    ).toThrow("BUY quantity must be a positive integer.");
  });

  it("rejects negative quantity", () => {
    expect(() =>
      calculateAverageStockPrice([{ quantity: -2, price: 100 }])
    ).toThrow("BUY quantity must be a positive integer.");
  });

  it("rejects negative price", () => {
    expect(() =>
      calculateAverageStockPrice([{ quantity: 2, price: -100 }])
    ).toThrow("Buy price must be greater than 0.");
  });
});

describe("cash flow calculations", () => {
  it("computes BUY gross, charges, and net amounts", () => {
    expect(
      calculateBuyCashFlow({
        quantity: 5,
        price: 210.5,
        brokerage: 10,
        taxes: 4.25,
        charges: 1.75,
      })
    ).toEqual({
      buyGrossAmount: 1052.5,
      buyCharges: 16,
      buyNetAmount: 1068.5,
    });
  });

  it("computes SELL snapshot values with realized profit frozen", () => {
    expect(
      calculateSellSnapshot({
        quantity: 4,
        price: 150,
        averagePriceAtSellTime: 120,
        brokerage: 5,
        taxes: 2,
        charges: 1,
      })
    ).toEqual({
      averagePriceAtSellTime: 120,
      costBasis: 480,
      sellGrossAmount: 600,
      sellCharges: 8,
      sellNetAmount: 592,
      realizedProfitForSell: 112,
    });
  });
});

describe("holding lifecycle calculations", () => {
  it("recalculates active lifecycle average on additional buy", () => {
    expect(
      calculateNextBuyLifecycleState({
        currentQuantity: 10,
        currentAveragePrice: 100,
        buyQuantity: 5,
        buyPrice: 160,
      })
    ).toEqual({
      quantity: 15,
      averagePrice: 120,
      investedAmount: 1800,
    });
  });

  it("preserves average price and reduces invested amount on partial sell", () => {
    expect(
      calculateNextSellLifecycleState({
        currentQuantity: 10,
        currentAveragePrice: 125,
        sellQuantity: 4,
      })
    ).toEqual({
      remainingQuantity: 6,
      averagePrice: 125,
      investedAmount: 750,
    });
  });

  it("zeroes out the lifecycle state on full exit", () => {
    expect(
      calculateNextSellLifecycleState({
        currentQuantity: 10,
        currentAveragePrice: 125,
        sellQuantity: 10,
      })
    ).toEqual({
      remainingQuantity: 0,
      averagePrice: 0,
      investedAmount: 0,
    });
  });
});

describe("mark-to-market calculations", () => {
  it("computes invested, value, and unrealized P&L", () => {
    expect(
      calculateHoldingMetrics({
        quantity: 8,
        averagePrice: 100,
        currentPrice: 125,
      })
    ).toEqual({
      investedAmount: 800,
      currentValue: 1000,
      unrealizedProfit: 200,
      unrealizedProfitPercent: 25,
    });
  });

  it("uses regular market change for today's P&L when available", () => {
    expect(
      calculateTodayPnL({
        quantity: 10,
        regularMarketChange: 3.45,
        currentPrice: 120,
        regularMarketPreviousClose: 116.55,
      })
    ).toBe(34.5);
  });

  it("falls back to previous close delta when live change is missing", () => {
    expect(
      calculateTodayPnL({
        quantity: 10,
        regularMarketChange: null,
        currentPrice: 120,
        regularMarketPreviousClose: 116,
      })
    ).toBe(40);
  });

  it("returns null for today's P&L when both change sources are unavailable", () => {
    expect(
      calculateTodayPnL({
        quantity: 10,
        regularMarketChange: null,
        currentPrice: null,
        regularMarketPreviousClose: 116,
      })
    ).toBeNull();
  });

  it("computes today's P&L percent from today's P&L and current value", () => {
    expect(calculateTodayPnLPercent(40, 1200)).toBe(3.45);
  });

  it("returns null for today's P&L percent when previous value would be invalid", () => {
    expect(calculateTodayPnLPercent(1200, 1200)).toBeNull();
  });
});
