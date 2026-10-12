import "server-only";

import { getAccountsDashboard } from "@/lib/accounts";
import type { SafeUser } from "@/lib/auth";
import { getCashReserveDashboard } from "@/lib/cash-reserves";
import {
  attachAllocationPercent,
  buildDashboardInsights,
  buildPeriodChanges,
  calculateAllocationPercent,
  calculateGainLossPercent,
  filterHistoryByRange,
  getAvailableHistoryRanges,
  roundCurrency,
  roundPercent,
  sortRecentActivity,
} from "@/lib/dashboard-calculations";
import {
  getPortfolioHistoryFromDailyValues,
  getTodayDateKey,
  getTotalAssetKey,
  upsertDailyValues,
  type DailyValueAssetType,
} from "@/lib/daily-values";
import { DASHBOARD_HISTORY_RANGES } from "@/lib/dashboard.types";
import type {
  DashboardAssetClassKey,
  DashboardAssetClassSummary,
  DashboardCashFlowSummary,
  DashboardData,
  DashboardDebtSummary,
  DashboardGoalsSummary,
  DashboardHistoryPoint,
  DashboardHistoryRange,
  DashboardMover,
  DashboardRecentActivityItem,
  DashboardSummary,
} from "@/lib/dashboard.types";
import { getExpenseDashboard } from "@/lib/expenses";
import { getDebtPageData } from "@/lib/debt";
import type { DebtPageData } from "@/lib/debt.types";
import { getGoalsPageData } from "@/lib/goals";
import { getGoldDashboard } from "@/lib/gold";
import { getMarketSyncStatus } from "@/lib/market-sync-status";
import { getMutualFundDashboard } from "@/lib/mutual-funds";
import { getStockDashboard } from "@/lib/stocks";
import { calculateXirr } from "@/lib/xirr";

const DEFAULT_HISTORY_RANGE: DashboardHistoryRange = "ALL";

type StockDashboard = Awaited<ReturnType<typeof getStockDashboard>>;
type MutualFundDashboard = Awaited<ReturnType<typeof getMutualFundDashboard>>;
type GoldDashboard = Awaited<ReturnType<typeof getGoldDashboard>>;
type CashDashboard = Awaited<ReturnType<typeof getCashReserveDashboard>>;
type AccountsDashboard = Awaited<ReturnType<typeof getAccountsDashboard>>;
type ExpenseDashboard = Awaited<ReturnType<typeof getExpenseDashboard>>;

type AssetInputs = {
  debt: DebtPageData;
  stocks: StockDashboard;
  mutualFunds: MutualFundDashboard;
  gold: GoldDashboard;
  cash: CashDashboard;
  accounts: AccountsDashboard;
};

const SNAPSHOT_ASSET_TYPES: Record<DashboardAssetClassKey, DailyValueAssetType> = {
  stocks: "stock",
  mutualFunds: "mutual_fund",
  gold: "gold",
  cash: "cash",
  otherAssets: "other",
};

function buildGoalsSummary(goalsPageData: Awaited<ReturnType<typeof getGoalsPageData>>): DashboardGoalsSummary {
  const activeGoals = goalsPageData.goals.filter((goal) => !goal.isCompleted);
  const totalSavedAmount = roundCurrency(
    goalsPageData.goals.reduce((sum, goal) => sum + Math.min(goal.currentValue, goal.targetAmount), 0)
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
    goals: goalsPageData.goals.slice(0, 4).map((goal) => ({
      id: goal.id,
      name: goal.name,
      progressPct: goal.progressPct,
      currentValue: goal.currentValue,
      targetAmount: goal.targetAmount,
      targetDate: goal.targetDate,
    })),
    empty: goalsPageData.goals.length === 0,
  };
}

/** Outstanding principal across loans on a given date (yyyy-mm-dd), from their schedules. */
function getLoanOutstandingOn(debt: DebtPageData, dateKey: string) {
  return roundCurrency(
    debt.loans.reduce((sum, loan) => {
      if (dateKey < loan.startDate.slice(0, 10)) return sum;
      const lastPaid = [...loan.schedule].reverse().find((row) => row.dueDate.slice(0, 10) <= dateKey);
      return sum + (lastPaid ? lastPaid.closingBalance : loan.principalAmount);
    }, 0)
  );
}

function buildDebtSummary(debtPageData: DebtPageData): DashboardDebtSummary {
  return {
    ...debtPageData.overview,
    empty: debtPageData.loans.length === 0,
  };
}

function buildActivity(input: AssetInputs & { expenses: ExpenseDashboard | null }) {
  const stock: DashboardRecentActivityItem[] = input.stocks.transactions.slice(0, 12).map((transaction) => ({
    id: `stock-${transaction.id}`,
    date: transaction.transactionDate,
    assetClassKey: "stocks",
    assetClassLabel: "Stocks",
    type: transaction.type === "BUY" ? "Bought" : "Sold",
    name: transaction.symbol.replace(/\.(NS|BO)$/, ""),
    amount:
      transaction.type === "BUY"
        ? transaction.buyNetAmount || transaction.buyGrossAmount || 0
        : transaction.sellNetAmount || transaction.sellGrossAmount || 0,
    description: `${transaction.quantity} shares @ ₹${transaction.price}`,
    href: `/stocks/${encodeURIComponent(transaction.symbol)}`,
  }));
  const mutualFund: DashboardRecentActivityItem[] = input.mutualFunds.recentTransactions
    .slice(0, 12)
    .map((transaction) => ({
      id: `mf-${transaction.id}`,
      date: transaction.date,
      assetClassKey: "mutualFunds",
      assetClassLabel: "Mutual Funds",
      type: transaction.transactionType === "buy" ? "Invested" : "Redeemed",
      name: transaction.schemeName,
      amount: transaction.amount,
      description: `${transaction.units} units @ ₹${transaction.nav}`,
      href: "/mutual-funds",
    }));
  // Valuations are price updates, not activity.
  const gold: DashboardRecentActivityItem[] = input.gold.recentActivity.entries
    .filter((entry) => entry.transactionType !== "valuation")
    .map((entry) => ({
      id: `gold-${entry.id}`,
      date: entry.date,
      assetClassKey: "gold",
      assetClassLabel: "Gold",
      type: entry.transactionType === "buy" ? "Bought" : "Sold",
      name: entry.schemeName,
      amount: roundCurrency(entry.investedAmount || entry.sellAmount || 0),
      description: entry.investmentOptionLabel,
      href: "/gold",
    }));
  const cash: DashboardRecentActivityItem[] = input.cash.recentActivity.entries.map((entry) => ({
    id: `cash-${entry.id}`,
    date: entry.date,
    assetClassKey: "cash",
    assetClassLabel: "Cash",
    type: entry.entryType === "credit" ? "Deposit" : "Withdrawal",
    name: entry.bank,
    amount: entry.amount,
    description: entry.note || "Cash reserve",
    href: "/cash-and-reserves",
  }));
  const expenses: DashboardRecentActivityItem[] = (input.expenses?.entriesPage.entries || [])
    .slice(0, 6)
    .map((entry) => ({
      id: `expense-${entry.id}`,
      date: entry.occurredAt,
      assetClassKey: "expenses",
      assetClassLabel: "Expenses",
      type: entry.entryType === "expense" ? "Spent" : "Received",
      name: entry.note || entry.categoryLabel,
      amount: entry.amount,
      description: entry.categoryLabel,
      href: "/expenses",
    }));

  return sortRecentActivity([...stock, ...mutualFund, ...gold, ...cash, ...expenses]).slice(0, 12);
}

function createAssetClassSummaries(input: AssetInputs): DashboardAssetClassSummary[] {
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
  const otherValues = calculateGainLossPercent(
    input.accounts.totalAssets,
    input.accounts.totalAssetsInvested
  );

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
      xirr: input.stocks.xirr,
    },
    {
      key: "mutualFunds",
      label: "Mutual Funds",
      currentValue: input.mutualFunds.totalPortfolioValue,
      investedAmount: input.mutualFunds.totalInvestedAmount,
      gainLoss: mutualFundValues.gainLoss,
      gainLossPercent: mutualFundValues.gainLossPercent,
      todayGainLoss: input.mutualFunds.totalDayChange,
      todayGainLossPercent: input.mutualFunds.totalDayChangePct,
      allocationPercent: 0,
      count: input.mutualFunds.holdings.length,
      stale: input.mutualFunds.holdings.some((holding) => holding.isStale),
      actionHref: "/mutual-funds",
      detail: input.mutualFunds.lastUpdatedAt,
      realizedProfit: input.mutualFunds.totalRealizedProfitAmount,
      xirr: input.mutualFunds.xirr,
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
      detail: null,
      realizedProfit: null,
      xirr: input.gold.xirr,
    },
    {
      key: "cash",
      label: "Cash",
      currentValue: input.cash.totalBalance,
      investedAmount: input.cash.totalBalance,
      gainLoss: 0,
      gainLossPercent: 0,
      todayGainLoss: null,
      todayGainLossPercent: null,
      allocationPercent: 0,
      count: input.cash.bankDistribution.length,
      stale: false,
      actionHref: "/cash-and-reserves",
      detail: null,
      realizedProfit: null,
      xirr: null,
    },
    {
      key: "otherAssets",
      label: "Other Assets",
      currentValue: input.accounts.totalAssets,
      investedAmount: input.accounts.totalAssetsInvested,
      gainLoss: otherValues.gainLoss,
      gainLossPercent: otherValues.gainLossPercent,
      todayGainLoss: null,
      todayGainLossPercent: null,
      allocationPercent: 0,
      count: input.accounts.assets.length,
      stale: false,
      actionHref: "/accounts",
      detail: null,
      realizedProfit: null,
      xirr: null,
    },
  ];
  const totalAssets = assetClasses.reduce((sum, assetClass) => sum + assetClass.currentValue, 0);

  return assetClasses.map((assetClass) => ({
    ...assetClass,
    allocationPercent: calculateAllocationPercent(assetClass.currentValue, totalAssets),
  }));
}

function buildSummary(
  assetClasses: DashboardAssetClassSummary[],
  input: AssetInputs
): DashboardSummary {
  const totalAssets = roundCurrency(
    assetClasses.reduce((sum, assetClass) => sum + assetClass.currentValue, 0)
  );
  // EMI loans (Debt page) plus other liabilities such as credit cards (Accounts page).
  const totalLiabilities = roundCurrency(
    input.accounts.totalLiabilities + input.debt.overview.totalOutstandingPrincipal
  );
  const totalInvested = roundCurrency(
    assetClasses.reduce((sum, assetClass) => sum + assetClass.investedAmount, 0)
  );
  const { gainLoss: totalGainLoss, gainLossPercent: totalGainLossPercent } =
    calculateGainLossPercent(totalAssets, totalInvested);
  const availableToday = assetClasses.filter((assetClass) => assetClass.todayGainLoss != null);
  const todayGainLoss =
    availableToday.length > 0
      ? roundCurrency(
          availableToday.reduce((sum, assetClass) => sum + (assetClass.todayGainLoss || 0), 0)
        )
      : null;
  const todayGainLossPercent =
    todayGainLoss != null && totalAssets - todayGainLoss > 0
      ? roundPercent((todayGainLoss / (totalAssets - todayGainLoss)) * 100)
      : null;
  const marketValue =
    input.stocks.totalCurrentValue + input.mutualFunds.totalPortfolioValue + input.gold.totalCurrentValue;
  const xirr = calculateXirr([
    ...[...input.stocks.cashFlows, ...input.mutualFunds.cashFlows, ...input.gold.cashFlows].map(
      (flow) => ({ amount: flow.amount, date: new Date(flow.date) })
    ),
    ...(marketValue > 0 ? [{ amount: marketValue, date: new Date() }] : []),
  ]);
  const lastUpdatedAt =
    [input.stocks.lastUpdatedAt, input.mutualFunds.lastUpdatedAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) || null;

  return {
    netWorth: roundCurrency(totalAssets - totalLiabilities),
    totalAssets,
    totalLiabilities,
    totalCurrentWorth: totalAssets,
    totalInvested,
    totalGainLoss,
    totalGainLossPercent,
    xirr,
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

function buildMovers(input: AssetInputs) {
  const movers: DashboardMover[] = [
    ...input.stocks.holdings
      .filter((holding) => holding.todayPnL != null)
      .map((holding) => ({
        id: `stock-${holding.symbol}`,
        name: holding.symbol.replace(/\.(NS|BO)$/, ""),
        subtitle: holding.companyName,
        assetClassKey: "stocks" as const,
        href: `/stocks/${encodeURIComponent(holding.symbol)}`,
        currentValue: holding.currentValue,
        dayChange: holding.todayPnL || 0,
        dayChangePercent: holding.todayPnLPercent,
      })),
    ...input.mutualFunds.holdings
      .filter((holding) => holding.dayChange != null)
      .map((holding) => ({
        id: `mf-${holding.schemeCode}`,
        name: holding.schemeName,
        subtitle: "Mutual fund",
        assetClassKey: "mutualFunds" as const,
        href: "/mutual-funds",
        currentValue: holding.currentValue,
        dayChange: holding.dayChange || 0,
        dayChangePercent: holding.dayChangePct ?? null,
      })),
  ];
  const byPercent = (mover: DashboardMover) => mover.dayChangePercent ?? 0;

  return {
    gainers: movers
      .filter((mover) => mover.dayChange > 0)
      .sort((left, right) => byPercent(right) - byPercent(left))
      .slice(0, 5),
    losers: movers
      .filter((mover) => mover.dayChange < 0)
      .sort((left, right) => byPercent(left) - byPercent(right))
      .slice(0, 5),
  };
}

function buildCashFlow(expenses: ExpenseDashboard | null): DashboardCashFlowSummary | null {
  if (!expenses) {
    return null;
  }

  return {
    cycleLabel: expenses.cycle.label,
    cycleStartDate: expenses.cycle.startDate,
    cycleEndDate: expenses.cycle.endDate,
    daysLeft: expenses.cycle.remainingDaysIncludingToday,
    spent: expenses.cycleSummary.expenseTotal,
    credits: expenses.cycleSummary.creditTotal,
    budget: expenses.budget.amount,
    remainingBudget: expenses.health.remainingBudget,
    projectedSpend: expenses.health.projectedCycleSpend,
    status: expenses.health.status,
    previousCycleSpent: expenses.previousCycleSummary.entryCount
      ? expenses.previousCycleSummary.expenseTotal
      : null,
    topCategories: expenses.categoryBreakdown.slice(0, 4).map((category) => ({
      key: category.key,
      label: category.label,
      amount: category.amount,
    })),
  };
}

async function loadAssetInputs(userId: string): Promise<AssetInputs> {
  const [stocks, mutualFunds, gold, cash, accounts, debt] = await Promise.all([
    getStockDashboard(userId),
    getMutualFundDashboard(userId),
    getGoldDashboard(userId),
    getCashReserveDashboard(userId),
    getAccountsDashboard(userId),
    getDebtPageData(userId),
  ]);

  return { stocks, mutualFunds, gold, cash, accounts, debt };
}

export async function getPortfolioHistory(
  userId: string,
  range: DashboardHistoryRange
): Promise<DashboardHistoryPoint[]> {
  return getPortfolioHistoryFromDailyValues(userId, range);
}

export async function saveDailyPortfolioValuesForUser(userId: string) {
  const inputs = await loadAssetInputs(userId);
  const assetClasses = createAssetClassSummaries(inputs);
  const summary = buildSummary(assetClasses, inputs);
  const totalAssetKey = getTotalAssetKey();
  const date = getTodayDateKey();

  await upsertDailyValues([
    ...assetClasses.map((assetClass) => ({
      userId,
      date,
      scope: "asset" as const,
      assetType: SNAPSHOT_ASSET_TYPES[assetClass.key],
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
      scope: "asset" as const,
      assetType: "liability" as const,
      assetKey: totalAssetKey,
      assetLabel: "Liabilities",
      investedAmount: 0,
      currentValue: summary.totalLiabilities,
      gainLoss: 0,
      source: "system" as const,
    },
    {
      userId,
      date,
      scope: "portfolio" as const,
      assetType: "portfolio" as const,
      assetKey: totalAssetKey,
      assetLabel: "Net Worth",
      investedAmount: summary.totalInvested,
      currentValue: summary.netWorth,
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
  const [inputs, expenses, history, sync] = await Promise.all([
    loadAssetInputs(user.id),
    getExpenseDashboard(user.id).catch(() => null),
    getPortfolioHistoryFromDailyValues(user.id, "ALL"),
    getMarketSyncStatus(user.id),
  ]);
  const goals = await getGoalsPageData(user, {
    cash: inputs.cash,
    gold: inputs.gold,
    mutualFunds: inputs.mutualFunds,
    stocks: inputs.stocks,
  });

  const assetClasses = createAssetClassSummaries(inputs);
  const summary = buildSummary(assetClasses, inputs);
  const goalsSummary = buildGoalsSummary(goals);
  const todayKey = getTodayDateKey();
  // Today's point reflects live values even before the snapshot job runs.
  const liveHistory = [
    ...history.filter((point) => point.date !== todayKey),
    {
      date: todayKey,
      totalValue: summary.netWorth,
      stocksValue: inputs.stocks.totalCurrentValue,
      mutualFundsValue: inputs.mutualFunds.totalPortfolioValue,
      goldValue: inputs.gold.totalCurrentValue,
      cashValue: inputs.cash.totalBalance,
      otherAssetsValue: inputs.accounts.totalAssets,
      liabilitiesValue: summary.totalLiabilities,
    },
  ];
  // Snapshots saved before loans were tracked have no liability figure; rebuild it from
  // each loan's EMI schedule so history doesn't show a fake cliff on the day debt appears.
  for (const point of liveHistory) {
    if (point.date === todayKey || point.liabilitiesValue > 0) continue;
    const loanBalance = getLoanOutstandingOn(inputs.debt, point.date);
    if (loanBalance <= 0) continue;
    point.liabilitiesValue = loanBalance;
    point.totalValue = roundCurrency(point.totalValue - loanBalance);
  }

  const periodChanges = buildPeriodChanges(liveHistory, todayKey);
  const historyAvailableRanges = getAvailableHistoryRanges(liveHistory, {
    ranges: [...DASHBOARD_HISTORY_RANGES],
  });
  const historyRange = historyAvailableRanges.includes(DEFAULT_HISTORY_RANGE)
    ? DEFAULT_HISTORY_RANGE
    : historyAvailableRanges[0] || "ALL";
  const allocation = attachAllocationPercent(
    assetClasses.map((assetClass) => ({
      key: assetClass.key,
      label: assetClass.label,
      currentValue: assetClass.currentValue,
    }))
  );
  const cashFlow = buildCashFlow(expenses);
  const empty = assetClasses.every((assetClass) => assetClass.currentValue <= 0);

  return {
    summary,
    assetClasses,
    allocation,
    periodChanges,
    movers: buildMovers(inputs),
    cashFlow,
    liabilities: {
      total: summary.totalLiabilities,
      monthlyPayments: roundCurrency(
        inputs.accounts.totalMonthlyPayments +
          inputs.debt.loans
            .filter((loan) => loan.remainingInstallments > 0)
            .reduce((sum, loan) => sum + loan.emiAmount, 0)
      ),
      count:
        inputs.accounts.liabilities.length +
        inputs.debt.loans.filter((loan) => loan.remainingPrincipal > 0).length,
      items: [
        ...inputs.debt.loans
          .filter((loan) => loan.remainingPrincipal > 0)
          .map((loan) => ({
            id: loan.id,
            name: loan.name,
            categoryLabel: "Loan · EMI",
            outstanding: loan.remainingPrincipal,
          })),
        ...inputs.accounts.liabilities.map((account) => ({
          id: account.id,
          name: account.name,
          categoryLabel: account.categoryLabel,
          outstanding: account.currentValue,
        })),
      ].slice(0, 4),
    },
    recentActivity: buildActivity({ ...inputs, expenses }),
    goalsSummary,
    insights: buildDashboardInsights({
      empty,
      hasStaleData: summary.hasStaleData,
      summary,
      allocation,
      assetClasses,
      goalsSummary,
      cashFlow,
      periodChanges,
      syncFailedCount: sync.syncedToday ? sync.failedCount : 0,
    }),
    history: liveHistory,
    historyRange,
    historyAvailableRanges,
    sync,
    debtSummary: buildDebtSummary(inputs.debt),
    empty,
  };
}

export { filterHistoryByRange };
