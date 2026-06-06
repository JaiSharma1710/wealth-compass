import "server-only";

import type { SafeUser } from "@/lib/auth";
import { getCashReserveDashboard } from "@/lib/cash-reserves";
import {
  attachAllocationPercent,
  buildDashboardInsights,
  calculateAllocationPercent,
  calculateGainLossPercent,
  roundCurrency,
  roundPercent,
  sortRecentActivity,
} from "@/lib/dashboard-calculations";
import {
  getPortfolioHistoryFromDailyValues,
  getTodayDateKey,
  getTotalAssetKey,
  upsertDailyValues,
} from "@/lib/daily-values";
import type {
  DashboardAssetClassSummary,
  DashboardData,
  DashboardGoalsSummary,
  DashboardHistoryPoint,
  DashboardHistoryRange,
  DashboardRecentActivityItem,
  DashboardSummary,
} from "@/lib/dashboard.types";
import { getGoalsPageData } from "@/lib/goals";
import { getGoldDashboard } from "@/lib/gold";
import { getMutualFundDashboard } from "@/lib/mutual-funds";
import { getStockDashboard } from "@/lib/stocks";

const DEFAULT_HISTORY_RANGE: DashboardHistoryRange = "1M";

type DashboardSnapshotPayload = {
  totalCurrentWorth: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  stocksValue: number;
  mutualFundsValue: number;
  goldValue: number;
  cashValue: number;
  goalsSavedValue: number | null;
};

function buildGoalsSummary(goalsPageData: Awaited<ReturnType<typeof getGoalsPageData>>): DashboardGoalsSummary {
  const activeGoals = goalsPageData.goals.filter((goal) => !goal.isCompleted);
  const totalSavedAmount = roundCurrency(
    goalsPageData.goals.reduce((sum, goal) => sum + goal.currentValue, 0)
  );
  const overallCompletionPercent =
    goalsPageData.overview.totalTargetAmount > 0
      ? roundPercent((totalSavedAmount / goalsPageData.overview.totalTargetAmount) * 100)
      : 0;
  const nextGoalNeedingAttention =
    [...activeGoals].sort((left, right) => {
      if (left.progressPct !== right.progressPct) {
        return left.progressPct - right.progressPct;
      }

      return right.remainingAmount - left.remainingAmount;
    })[0] || null;

  return {
    activeGoalsCount: activeGoals.length,
    completedGoalsCount: goalsPageData.overview.completedGoals,
    totalTargetAmount: roundCurrency(goalsPageData.overview.totalTargetAmount),
    totalSavedAmount,
    overallCompletionPercent,
    nextGoalNeedingAttention: nextGoalNeedingAttention
      ? {
          id: nextGoalNeedingAttention.id,
          name: nextGoalNeedingAttention.name,
          remainingAmount: nextGoalNeedingAttention.remainingAmount,
          progressPct: nextGoalNeedingAttention.progressPct,
          targetDate: nextGoalNeedingAttention.targetDate,
        }
      : null,
    empty: goalsPageData.goals.length === 0,
  };
}

function buildStockActivity(
  dashboard: Awaited<ReturnType<typeof getStockDashboard>>
): DashboardRecentActivityItem[] {
  return dashboard.transactions.slice(0, 12).map((transaction) => ({
    id: `stock-${transaction.id}`,
    date: transaction.transactionDate,
    assetClassKey: "stocks",
    assetClassLabel: "Stocks",
    type: transaction.type === "BUY" ? "Stock Buy" : "Stock Sell",
    name: transaction.symbol,
    amount:
      transaction.type === "BUY"
        ? transaction.buyNetAmount || transaction.buyGrossAmount || 0
        : transaction.sellNetAmount || transaction.sellGrossAmount || 0,
    description: transaction.companyName,
    href: "/stocks",
  }));
}

function buildMutualFundActivity(
  dashboard: Awaited<ReturnType<typeof getMutualFundDashboard>>
): DashboardRecentActivityItem[] {
  return dashboard.recentTransactions.slice(0, 12).map((transaction) => ({
    id: `mf-${transaction.id}`,
    date: transaction.date,
    assetClassKey: "mutualFunds",
    assetClassLabel: "Mutual Funds",
    type: transaction.transactionType === "buy" ? "Mutual Fund Buy" : "Mutual Fund Sell",
    name: transaction.schemeName,
    amount: transaction.amount,
    description: `${transaction.units} units @ ${transaction.nav}`,
    href: "/mutual-funds",
  }));
}

function buildGoldActivity(
  dashboard: Awaited<ReturnType<typeof getGoldDashboard>>
): DashboardRecentActivityItem[] {
  return dashboard.recentActivity.entries.map((entry) => ({
    id: `gold-${entry.id}`,
    date: entry.date,
    assetClassKey: "gold",
    assetClassLabel: "Gold",
    type:
      entry.transactionType === "buy"
        ? "Gold Buy"
        : entry.transactionType === "sell"
          ? "Gold Sell"
          : "Gold Valuation",
    name: entry.schemeName,
    amount: roundCurrency(
      entry.investedAmount || entry.sellAmount || entry.currentValue || 0
    ),
    description: entry.investmentOptionLabel,
    href: "/gold",
  }));
}

function buildCashActivity(
  dashboard: Awaited<ReturnType<typeof getCashReserveDashboard>>
): DashboardRecentActivityItem[] {
  return dashboard.recentActivity.entries.map((entry) => ({
    id: `cash-${entry.id}`,
    date: entry.date,
    assetClassKey: "cash",
    assetClassLabel: "Cash and Reserves",
    type: entry.entryType === "credit" ? "Cash Deposit" : "Cash Withdrawal",
    name: entry.bank,
    amount: entry.amount,
    description: entry.note || "Cash reserve entry",
    href: "/cash-and-reserves",
  }));
}

function createAssetClassSummaries(input: {
  stocks: Awaited<ReturnType<typeof getStockDashboard>>;
  mutualFunds: Awaited<ReturnType<typeof getMutualFundDashboard>>;
  gold: Awaited<ReturnType<typeof getGoldDashboard>>;
  cash: Awaited<ReturnType<typeof getCashReserveDashboard>>;
}) {
  const stockValues = calculateGainLossPercent(
    input.stocks.totalCurrentValue,
    input.stocks.totalInvestedAmount
  );
  const mutualFundValues = calculateGainLossPercent(
    input.mutualFunds.totalPortfolioValue,
    input.mutualFunds.totalInvestedAmount
  );
  const goldValues = calculateGainLossPercent(
    input.gold.totalCurrentValue,
    input.gold.totalInvestedAmount
  );
  const cashValues = calculateGainLossPercent(input.cash.totalBalance, input.cash.totalBalance);

  const assetClasses: DashboardAssetClassSummary[] = [
    {
      key: "stocks",
      label: "Stocks",
      currentValue: input.stocks.totalCurrentValue,
      investedAmount: input.stocks.totalInvestedAmount,
      gainLoss: stockValues.gainLoss,
      gainLossPercent: stockValues.gainLossPercent,
      todayGainLoss: input.stocks.totalTodayPnL,
      todayGainLossPercent: input.stocks.totalTodayPnLPercent,
      allocationPercent: 0,
      count: input.stocks.holdingCount,
      stale: input.stocks.hasStaleQuotes,
      actionHref: "/stocks",
      detail: input.stocks.lastUpdatedAt,
      realizedProfit: input.stocks.totalRealizedProfit,
    },
    {
      key: "mutualFunds",
      label: "Mutual Funds",
      currentValue: input.mutualFunds.totalPortfolioValue,
      investedAmount: input.mutualFunds.totalInvestedAmount,
      gainLoss: mutualFundValues.gainLoss,
      gainLossPercent: mutualFundValues.gainLossPercent,
      todayGainLoss: null,
      todayGainLossPercent: null,
      allocationPercent: 0,
      count: input.mutualFunds.holdings.length,
      stale: false,
      actionHref: "/mutual-funds",
      detail: `${input.mutualFunds.holdings.length} funds`,
      realizedProfit: input.mutualFunds.totalRealizedProfitAmount,
    },
    {
      key: "gold",
      label: "Gold",
      currentValue: input.gold.totalCurrentValue,
      investedAmount: input.gold.totalInvestedAmount,
      gainLoss: goldValues.gainLoss,
      gainLossPercent: goldValues.gainLossPercent,
      todayGainLoss: null,
      todayGainLossPercent: null,
      allocationPercent: 0,
      count: input.gold.holdings.length,
      stale: false,
      actionHref: "/gold",
      detail: `${input.gold.holdings.length} holdings`,
      realizedProfit: null,
    },
    {
      key: "cash",
      label: "Cash and Reserves",
      currentValue: input.cash.totalBalance,
      investedAmount: input.cash.totalBalance,
      gainLoss: cashValues.gainLoss,
      gainLossPercent: cashValues.gainLossPercent,
      todayGainLoss: null,
      todayGainLossPercent: null,
      allocationPercent: 0,
      count: input.cash.bankDistribution.length,
      stale: false,
      actionHref: "/cash-and-reserves",
      detail: `${input.cash.bankDistribution.length} banks`,
      realizedProfit: null,
    },
  ];
  const totalCurrentWorth = assetClasses.reduce(
    (sum, assetClass) => sum + assetClass.currentValue,
    0
  );

  return assetClasses.map((assetClass) => ({
    ...assetClass,
    allocationPercent: calculateAllocationPercent(assetClass.currentValue, totalCurrentWorth),
  }));
}

function buildSummaryFromAssetClasses(assetClasses: DashboardAssetClassSummary[]): DashboardSummary {
  const totalCurrentWorth = roundCurrency(
    assetClasses.reduce((sum, assetClass) => sum + assetClass.currentValue, 0)
  );
  const totalInvested = roundCurrency(
    assetClasses.reduce((sum, assetClass) => sum + assetClass.investedAmount, 0)
  );
  const { gainLoss: totalGainLoss, gainLossPercent: totalGainLossPercent } =
    calculateGainLossPercent(totalCurrentWorth, totalInvested);
  const availableToday = assetClasses.filter((assetClass) => assetClass.todayGainLoss != null);
  const todayGainLoss =
    availableToday.length > 0
      ? roundCurrency(
          availableToday.reduce((sum, assetClass) => sum + (assetClass.todayGainLoss || 0), 0)
        )
      : null;
  const todayGainLossPercent =
    todayGainLoss != null && totalCurrentWorth - todayGainLoss > 0
      ? roundPercent((todayGainLoss / (totalCurrentWorth - todayGainLoss)) * 100)
      : null;
  const lastUpdatedAt =
    assetClasses
      .filter((assetClass) => assetClass.key === "stocks")
      .map((assetClass) => assetClass.detail)
      .find((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}T/.test(value))) ||
    null;

  return {
    totalCurrentWorth,
    totalInvested,
    totalGainLoss,
    totalGainLossPercent,
    todayGainLoss,
    todayGainLossPercent,
    todayMovementAvailableAssetKeys: availableToday.map((assetClass) => assetClass.key),
    todayMovementUnavailableAssetKeys: assetClasses
      .filter((assetClass) => assetClass.todayGainLoss == null)
      .map((assetClass) => assetClass.key),
    lastUpdatedAt,
    hasStaleData: assetClasses.some((assetClass) => assetClass.stale),
  };
}

export async function createOrUpdateTodayPortfolioSnapshot(
  userId: string,
  snapshot: DashboardSnapshotPayload
) {
  const date = getTodayDateKey();
  const totalAssetKey = getTotalAssetKey();

  await upsertDailyValues([
    {
      userId,
      date,
      scope: "asset",
      assetType: "stock",
      assetKey: totalAssetKey,
      assetLabel: "Stocks",
      investedAmount: 0,
      currentValue: snapshot.stocksValue,
      source: "system",
    },
    {
      userId,
      date,
      scope: "asset",
      assetType: "mutual_fund",
      assetKey: totalAssetKey,
      assetLabel: "Mutual Funds",
      investedAmount: 0,
      currentValue: snapshot.mutualFundsValue,
      source: "system",
    },
    {
      userId,
      date,
      scope: "asset",
      assetType: "gold",
      assetKey: totalAssetKey,
      assetLabel: "Gold",
      investedAmount: 0,
      currentValue: snapshot.goldValue,
      source: "system",
    },
    {
      userId,
      date,
      scope: "asset",
      assetType: "cash",
      assetKey: totalAssetKey,
      assetLabel: "Cash and Reserves",
      investedAmount: snapshot.cashValue,
      currentValue: snapshot.cashValue,
      source: "system",
    },
    {
      userId,
      date,
      scope: "portfolio",
      assetType: "portfolio",
      assetKey: totalAssetKey,
      assetLabel: "Total Portfolio",
      investedAmount: snapshot.totalInvested,
      currentValue: snapshot.totalCurrentWorth,
      gainLoss: snapshot.totalGainLoss,
      source: "system",
    },
  ]);
}

export async function getPortfolioHistory(
  userId: string,
  range: DashboardHistoryRange
): Promise<DashboardHistoryPoint[]> {
  return getPortfolioHistoryFromDailyValues(userId, range);
}

export async function saveDailyPortfolioValuesForUser(userId: string) {
  const [stocks, mutualFunds, gold, cash] = await Promise.all([
    getStockDashboard(userId),
    getMutualFundDashboard(userId),
    getGoldDashboard(userId),
    getCashReserveDashboard(userId),
  ]);
  const assetClasses = createAssetClassSummaries({
    stocks,
    mutualFunds,
    gold,
    cash,
  });
  const summary = buildSummaryFromAssetClasses(assetClasses);
  const totalAssetKey = getTotalAssetKey();
  const date = getTodayDateKey();

  await upsertDailyValues([
    ...assetClasses.map((assetClass) => ({
      userId,
      date,
      scope: "asset" as const,
      assetType:
        assetClass.key === "mutualFunds"
          ? ("mutual_fund" as const)
          : assetClass.key === "stocks"
            ? ("stock" as const)
            : assetClass.key,
      assetKey: totalAssetKey,
      assetLabel: assetClass.label,
      investedAmount: assetClass.investedAmount,
      currentValue: assetClass.currentValue,
      gainLoss: assetClass.gainLoss,
      source: "system" as const,
    })),
    {
      userId,
      date,
      scope: "portfolio" as const,
      assetType: "portfolio" as const,
      assetKey: totalAssetKey,
      assetLabel: "Total Portfolio",
      investedAmount: summary.totalInvested,
      currentValue: summary.totalCurrentWorth,
      gainLoss: summary.totalGainLoss,
      source: "system" as const,
    },
  ]);

  return {
    date,
    summary,
    assetClasses,
  };
}

export async function getDashboard(user: SafeUser): Promise<DashboardData> {
  const [stocks, mutualFunds, gold, cash, goals] = await Promise.all([
    getStockDashboard(user.id),
    getMutualFundDashboard(user.id),
    getGoldDashboard(user.id),
    getCashReserveDashboard(user.id),
    getGoalsPageData(user),
  ]);

  const assetClasses = createAssetClassSummaries({
    stocks,
    mutualFunds,
    gold,
    cash,
  });
  const summary = buildSummaryFromAssetClasses(assetClasses);
  const goalsSummary = buildGoalsSummary(goals);

  const history = await getPortfolioHistory(user.id, DEFAULT_HISTORY_RANGE);
  const allocation = attachAllocationPercent(
    assetClasses.map((assetClass) => ({
      key: assetClass.key,
      label: assetClass.label,
      currentValue: assetClass.currentValue,
    }))
  );
  const recentActivity = sortRecentActivity([
    ...buildStockActivity(stocks),
    ...buildMutualFundActivity(mutualFunds),
    ...buildGoldActivity(gold),
    ...buildCashActivity(cash),
  ]).slice(0, 12);
  const empty = assetClasses.every((assetClass) => assetClass.currentValue <= 0);

  return {
    summary,
    assetClasses,
    allocation,
    recentActivity,
    goalsSummary,
    insights: buildDashboardInsights({
      empty,
      hasStaleData: summary.hasStaleData,
      summary: {
        totalGainLoss: summary.totalGainLoss,
        totalGainLossPercent: summary.totalGainLossPercent,
        totalCurrentWorth: summary.totalCurrentWorth,
      },
      allocation,
      assetClasses,
      goalsSummary,
    }),
    history,
    historyRange: DEFAULT_HISTORY_RANGE,
    empty,
  };
}

export async function refreshDashboard(user: SafeUser) {
  return getDashboard(user);
}
