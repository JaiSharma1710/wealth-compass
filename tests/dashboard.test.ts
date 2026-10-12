import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/mongodb", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/stocks", () => ({
  getStockDashboard: vi.fn(),
}));

vi.mock("@/lib/mutual-funds", () => ({
  getMutualFundDashboard: vi.fn(),
}));

vi.mock("@/lib/gold", () => ({
  getGoldDashboard: vi.fn(),
}));

vi.mock("@/lib/cash-reserves", () => ({
  getCashReserveDashboard: vi.fn(),
}));

vi.mock("@/lib/goals", () => ({
  getGoalsPageData: vi.fn(),
}));

vi.mock("@/lib/debt", () => ({
  getDebtPageData: vi.fn(),
}));

vi.mock("@/lib/accounts", () => ({
  getAccountsDashboard: vi.fn().mockResolvedValue({
    assets: [],
    liabilities: [],
    totalAssets: 0,
    totalAssetsInvested: 0,
    totalLiabilities: 0,
    totalMonthlyPayments: 0,
    netValue: 0,
  }),
}));

vi.mock("@/lib/expenses", () => ({
  getExpenseDashboard: vi.fn().mockRejectedValue(new Error("no expenses")),
}));

vi.mock("@/lib/market-sync-status", () => ({
  getMarketSyncStatus: vi.fn().mockResolvedValue({
    lastSyncedAt: null,
    syncedToday: false,
    failedCount: 0,
    failedItems: [],
  }),
}));

vi.mock("@/lib/daily-values", () => ({
  getPortfolioHistoryFromDailyValues: vi.fn(),
  getTodayDateKey: vi.fn(() => "2026-05-30"),
  getTotalAssetKey: vi.fn(() => "total"),
  upsertDailyValues: vi.fn(),
}));

import { getDashboard, getPortfolioHistory, saveDailyPortfolioValuesForUser } from "@/lib/dashboard";
import { getCashReserveDashboard } from "@/lib/cash-reserves";
import { getDebtPageData } from "@/lib/debt";
import { getPortfolioHistoryFromDailyValues, upsertDailyValues } from "@/lib/daily-values";
import { getGoldDashboard } from "@/lib/gold";
import { getGoalsPageData } from "@/lib/goals";
import { getMutualFundDashboard } from "@/lib/mutual-funds";
import { getStockDashboard } from "@/lib/stocks";

const mockUser = {
  id: "507f1f77bcf86cd799439011",
  fullName: "Wealth User",
  email: "wealth@example.com",
  role: "user",
  profile: {
    username: "wealth.user",
    currency: "INR",
    timezone: "Asia/Kolkata",
    dateOfBirth: "",
    presentAddress: "",
    permanentAddress: "",
    city: "",
    postalCode: "",
    country: "",
    banks: ["HDFC"],
  },
  createdAt: new Date().toISOString(),
  lastLoginAt: null,
};

function createStockDashboard() {
  return {
    totalInvestedAmount: 80,
    totalCurrentValue: 100,
    totalUnrealizedProfit: 20,
    totalUnrealizedProfitPercent: 25,
    totalRealizedProfit: 11,
    totalTodayPnL: 5,
    totalTodayPnLPercent: 5.26,
    totalDividends: 0,
    holdingCount: 1,
    profitableHoldingsCount: 1,
    lossHoldingsCount: 0,
    hasStaleQuotes: true,
    lastUpdatedAt: "2026-05-30T10:00:00.000Z",
    holdings: [],
    stockAllocation: [],
    sectorAllocation: [],
    topGainers: [],
    topLosers: [],
    xirr: null,
    cashFlows: [],
    transactions: [
      {
        id: "s1",
        holdingId: "h1",
        symbol: "RELIANCE.NS",
        exchange: "NSE",
        companyName: "Reliance Industries",
        type: "BUY" as const,
        quantity: 1,
        price: 100,
        brokerage: 0,
        taxes: 0,
        charges: 0,
        transactionDate: "2026-05-24T00:00:00.000Z",
        note: "",
        buyGrossAmount: 100,
        buyCharges: 0,
        buyNetAmount: 100,
        averagePriceAtSellTime: null,
        costBasis: null,
        sellGrossAmount: null,
        sellCharges: null,
        sellNetAmount: null,
        realizedProfitForSell: null,
      },
    ],
  };
}

function createMutualFundDashboard() {
  return {
    totalPortfolioValue: 200,
    totalInvestedAmount: 150,
    totalRealizedProfitAmount: 0,
    totalRealizedProfitPct: 0,
    totalProfitLossAmount: 50,
    totalProfitLossPct: 33.33,
    monthOverMonthChangeAmount: 10,
    monthOverMonthChangePct: 5,
    xirr: null,
    cashFlows: [],
    totalDayChange: null,
    totalDayChangePct: null,
    lastUpdatedAt: null,
    months: [],
    distribution: [],
    topHoldings: [],
    holdings: [
      {
        schemeCode: 1,
        schemeName: "Fund A",
        units: 10,
        investedAmount: 150,
        averageNav: 15,
        currentNav: 20,
        currentValue: 200,
        profitLossAmount: 50,
        profitLossPct: 33.33,
        allocationPct: 100,
      },
    ],
    previousFunds: [],
    recentTransactions: [
      {
        id: "mf1",
        schemeCode: 1,
        schemeName: "Fund A",
        transactionType: "buy" as const,
        units: 10,
        nav: 15,
        amount: 150,
        averageBuyNav: null,
        realizedProfitAmount: null,
        realizedProfitPct: null,
        date: "2026-05-25T00:00:00.000Z",
      },
    ],
  };
}

function createGoldDashboard() {
  return {
    totalCurrentValue: 50,
    totalInvestedAmount: 40,
    totalProfitLossAmount: 10,
    totalProfitLossPct: 25,
    monthOverMonthChangeAmount: 2,
    monthOverMonthChangePct: 4,
    xirr: null,
    cashFlows: [],
    months: [],
    holdings: [
      {
        id: "g1",
        investmentOption: "digital_gold" as const,
        investmentOptionLabel: "Digital Gold",
        schemeName: "24K Gold",
        units: null,
        investedAmount: 40,
        currentValue: 50,
        profitLossAmount: 10,
        profitLossPct: 25,
      },
    ],
    optionDistribution: [],
    recentActivity: {
      entries: [
        {
          id: "gact1",
          date: "2026-05-26T00:00:00.000Z",
          transactionType: "buy" as const,
          investmentOption: "digital_gold" as const,
          investmentOptionLabel: "Digital Gold",
          schemeName: "24K Gold",
          units: null,
          investedAmount: 40,
          currentValue: 50,
          sellAmount: null,
          realizedProfitAmount: null,
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
    },
  };
}

function createCashDashboard() {
  return {
    totalBalance: 70,
    monthOverMonthChangePct: 0,
    monthOverMonthChangeAmount: 0,
    bankDistribution: [{ bank: "HDFC", balance: 70, percentage: 100 }],
    months: [],
    recentActivity: {
      entries: [
        {
          id: "c1",
          date: "2026-05-27T00:00:00.000Z",
          amount: 70,
          entryType: "credit" as const,
          bank: "HDFC",
          dateKey: "2026-05-27",
          note: "Emergency fund",
        },
      ],
      page: 1,
      pageSize: 10,
      totalCount: 1,
      totalPages: 1,
      filters: {
        month: null,
        year: null,
        date: null,
        entryType: "all" as const,
      },
      availableYears: [2026],
    },
  };
}

function createGoalsPageData() {
  return {
    overview: {
      totalGoals: 1,
      completedGoals: 0,
      totalTargetAmount: 1000,
      averageProgressPct: 30,
      totalRemainingAmount: 700,
      totalSavedAmount: 0,
      overallProgressPct: 0,
      totalRequiredMonthly: 0,
      behindGoals: 0,
    },
    goals: [
      {
        id: "goal1",
        name: "House Fund",
        note: "",
        targetAmount: 1000,
        targetDate: "2026-12-31T00:00:00.000Z",
        links: [],
        currentValue: 300,
        fundedAmount: 300,
        remainingAmount: 700,
        progressPct: 30,
        isCompleted: false,
        status: "on_track" as const,
        monthsLeft: 7,
        requiredMonthly: 100,
        expectedPct: 30,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-29T00:00:00.000Z",
      },
    ],
    assetGroups: [],
  };
}

function createDebtPageData() {
  return {
    overview: {
      totalLoans: 1,
      activeLoans: 1,
      closedLoans: 0,
      totalOriginalPrincipal: 1000,
      totalOutstandingPrincipal: 700,
      totalPaidAmount: 360,
      totalPaidPrincipal: 300,
      totalPaidInterest: 60,
      totalRemainingAmount: 760,
      totalInterestPayable: 120,
      nextEmiDate: "2026-06-05T00:00:00.000Z",
      nextEmiAmount: 120,
    },
    loans: [],
  };
}

describe("dashboard domain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T12:00:00.000Z"));

    vi.mocked(getStockDashboard).mockResolvedValue(createStockDashboard());
    vi.mocked(getMutualFundDashboard).mockResolvedValue(createMutualFundDashboard());
    vi.mocked(getGoldDashboard).mockResolvedValue(createGoldDashboard());
    vi.mocked(getCashReserveDashboard).mockResolvedValue(createCashDashboard());
    vi.mocked(getGoalsPageData).mockResolvedValue(createGoalsPageData());
    vi.mocked(getDebtPageData).mockResolvedValue(createDebtPageData());
    vi.mocked(upsertDailyValues).mockResolvedValue(undefined);
    vi.mocked(getPortfolioHistoryFromDailyValues).mockResolvedValue([
      {
        date: "2026-05-30",
        totalValue: 420,
        stocksValue: 100,
        mutualFundsValue: 200,
        goldValue: 50,
        cashValue: 70,
        otherAssetsValue: 0,
        liabilitiesValue: 0,
      },
    ]);
  });

  it("calculates total current worth, invested amount, gain/loss, and avoids goal double counting", async () => {
    const dashboard = await getDashboard(mockUser);

    expect(dashboard.summary.totalCurrentWorth).toBe(420);
    expect(dashboard.summary.totalInvested).toBe(340);
    expect(dashboard.summary.totalGainLoss).toBe(80);
    expect(dashboard.summary.totalGainLossPercent).toBe(23.53);
    expect(dashboard.goalsSummary.totalSavedAmount).toBe(300);
    expect(dashboard.debtSummary.totalOutstandingPrincipal).toBe(700);
    expect(dashboard.summary.totalCurrentWorth).not.toBe(720);
  });

  it("calculates asset allocation percentages", async () => {
    const dashboard = await getDashboard(mockUser);

    expect(dashboard.allocation.map((entry) => [entry.key, entry.percentage])).toEqual([
      ["mutualFunds", 47.62],
      ["stocks", 23.81],
      ["cash", 16.67],
      ["gold", 11.9],
    ]);
  });

  it("aggregates today's movement only from available asset classes", async () => {
    const dashboard = await getDashboard(mockUser);

    expect(dashboard.summary.todayGainLoss).toBe(5);
    expect(dashboard.summary.todayMovementAvailableAssetKeys).toEqual(["stocks"]);
    expect(dashboard.summary.todayMovementUnavailableAssetKeys).toEqual([
      "mutualFunds",
      "gold",
      "cash",
      "otherAssets",
    ]);
  });

  it("propagates stale data when any asset class is stale", async () => {
    const dashboard = await getDashboard(mockUser);

    expect(dashboard.summary.hasStaleData).toBe(true);
    expect(dashboard.assetClasses.find((assetClass) => assetClass.key === "stocks")?.stale).toBe(
      true
    );
  });

  it("merges and sorts recent activity across modules", async () => {
    const dashboard = await getDashboard(mockUser);

    expect(dashboard.recentActivity.map((entry) => entry.assetClassKey)).toEqual([
      "cash",
      "gold",
      "mutualFunds",
      "stocks",
    ]);
  });

  it("returns an empty dashboard payload when all asset classes are zero", async () => {
    vi.mocked(getStockDashboard).mockResolvedValue({
      ...createStockDashboard(),
      totalInvestedAmount: 0,
      totalCurrentValue: 0,
      totalUnrealizedProfit: 0,
      totalUnrealizedProfitPercent: 0,
      totalRealizedProfit: 0,
      totalTodayPnL: null,
      totalTodayPnLPercent: null,
      holdingCount: 0,
      hasStaleQuotes: false,
      transactions: [],
    });
    vi.mocked(getMutualFundDashboard).mockResolvedValue({
      ...createMutualFundDashboard(),
      totalPortfolioValue: 0,
      totalInvestedAmount: 0,
      totalProfitLossAmount: 0,
      totalProfitLossPct: 0,
      holdings: [],
      recentTransactions: [],
    });
    vi.mocked(getGoldDashboard).mockResolvedValue({
      ...createGoldDashboard(),
      totalCurrentValue: 0,
      totalInvestedAmount: 0,
      totalProfitLossAmount: 0,
      totalProfitLossPct: 0,
      holdings: [],
      recentActivity: { ...createGoldDashboard().recentActivity, entries: [], totalCount: 0 },
    });
    vi.mocked(getCashReserveDashboard).mockResolvedValue({
      ...createCashDashboard(),
      totalBalance: 0,
      bankDistribution: [],
      recentActivity: { ...createCashDashboard().recentActivity, entries: [], totalCount: 0 },
    });
    vi.mocked(getGoalsPageData).mockResolvedValue({
      overview: {
        totalGoals: 0,
        completedGoals: 0,
        totalTargetAmount: 0,
        totalSavedAmount: 0,
        averageProgressPct: 0,
        overallProgressPct: 0,
        totalRemainingAmount: 0,
        totalRequiredMonthly: 0,
        behindGoals: 0,
      },
      goals: [],
      assetGroups: [],
    });

    const dashboard = await getDashboard(mockUser);

    expect(dashboard.empty).toBe(true);
    expect(dashboard.summary.totalCurrentWorth).toBe(0);
    expect(dashboard.recentActivity).toEqual([]);
  });

  it("saves today's snapshot with net worth as the portfolio value", async () => {
    await saveDailyPortfolioValuesForUser(mockUser.id);

    expect(upsertDailyValues).toHaveBeenCalledTimes(1);
    const [inputs] = vi.mocked(upsertDailyValues).mock.calls[0];
    expect(inputs).toHaveLength(7);
    // Assets 420 minus the 700 outstanding on the EMI loan.
    expect(inputs.find((input) => input.scope === "portfolio")?.currentValue).toBe(-280);
    expect(inputs.find((input) => input.assetType === "stock")?.currentValue).toBe(100);
    expect(inputs.find((input) => input.assetType === "liability")?.currentValue).toBe(700);
  });

  it("filters history by range", async () => {
    vi.mocked(getPortfolioHistoryFromDailyValues).mockResolvedValue([
      {
        date: "2026-05-25",
        totalValue: 410,
        stocksValue: 100,
        mutualFundsValue: 190,
        goldValue: 50,
        cashValue: 70,
        otherAssetsValue: 0,
        liabilitiesValue: 0,
      },
      {
        date: "2026-05-30",
        totalValue: 420,
        stocksValue: 100,
        mutualFundsValue: 200,
        goldValue: 50,
        cashValue: 70,
        otherAssetsValue: 0,
        liabilitiesValue: 0,
      },
    ]);

    const history = await getPortfolioHistory(mockUser.id, "1W");

    expect(history).toHaveLength(2);
    expect(history.map((entry) => entry.date)).toEqual(["2026-05-25", "2026-05-30"]);
  });

  it("exposes only meaningful wealth movement ranges for the saved history span", async () => {
    vi.mocked(getPortfolioHistoryFromDailyValues).mockResolvedValue([
      {
        date: "2026-02-20",
        totalValue: 380,
        stocksValue: 90,
        mutualFundsValue: 180,
        goldValue: 45,
        cashValue: 65,
        otherAssetsValue: 0,
        liabilitiesValue: 0,
      },
      {
        date: "2026-05-30",
        totalValue: 420,
        stocksValue: 100,
        mutualFundsValue: 200,
        goldValue: 50,
        cashValue: 70,
        otherAssetsValue: 0,
        liabilitiesValue: 0,
      },
    ]);

    const dashboard = await getDashboard(mockUser);

    expect(dashboard.historyAvailableRanges).toEqual(["1W", "1M", "3M", "ALL"]);
    expect(dashboard.historyRange).toBe("ALL");
    expect(dashboard.history.map((entry) => entry.date)).toEqual(["2026-02-20", "2026-05-30"]);
  });

  it("keeps history queries isolated by userId", async () => {
    await getPortfolioHistory(mockUser.id, "ALL");

    expect(getPortfolioHistoryFromDailyValues).toHaveBeenCalledWith(mockUser.id, "ALL");
  });
});
