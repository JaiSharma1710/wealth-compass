export const DASHBOARD_HISTORY_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const;

export type DashboardHistoryRange = (typeof DASHBOARD_HISTORY_RANGES)[number];
export type DashboardAssetClassKey = "stocks" | "mutualFunds" | "gold" | "cash" | "otherAssets";

export type DashboardSummary = {
  /** Total assets minus liabilities. */
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  /** Kept for compatibility: equals totalAssets. */
  totalCurrentWorth: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  /** Annualised return across stocks, mutual funds and gold. */
  xirr: number | null;
  todayGainLoss: number | null;
  todayGainLossPercent: number | null;
  todayMovementAvailableAssetKeys: DashboardAssetClassKey[];
  todayMovementUnavailableAssetKeys: DashboardAssetClassKey[];
  lastUpdatedAt: string | null;
  hasStaleData: boolean;
};

export type DashboardAssetClassSummary = {
  key: DashboardAssetClassKey;
  label: string;
  currentValue: number;
  investedAmount: number;
  gainLoss: number;
  gainLossPercent: number;
  todayGainLoss: number | null;
  todayGainLossPercent: number | null;
  allocationPercent: number;
  count: number;
  stale: boolean;
  actionHref: string;
  detail: string | null;
  realizedProfit: number | null;
  xirr: number | null;
};

export type DashboardAllocationPoint = {
  key: DashboardAssetClassKey;
  label: string;
  value: number;
  percentage: number;
};

export type DashboardHistoryPoint = {
  date: string;
  /** Net worth on that date. */
  totalValue: number;
  stocksValue: number;
  mutualFundsValue: number;
  goldValue: number;
  cashValue: number;
  otherAssetsValue: number;
  liabilitiesValue: number;
};

export type DashboardPeriodChange = {
  key: "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y";
  label: string;
  change: number | null;
  changePercent: number | null;
  /** Earliest snapshot date used as the base. */
  fromDate: string | null;
};

export type DashboardMover = {
  id: string;
  name: string;
  subtitle: string;
  assetClassKey: DashboardAssetClassKey;
  href: string;
  currentValue: number;
  dayChange: number;
  dayChangePercent: number | null;
};

export type DashboardRecentActivityItem = {
  id: string;
  date: string;
  assetClassKey: DashboardAssetClassKey | "expenses";
  assetClassLabel: string;
  type: string;
  name: string;
  amount: number;
  description: string;
  href: string;
};

export type DashboardGoalsSummary = {
  activeGoalsCount: number;
  completedGoalsCount: number;
  totalTargetAmount: number;
  totalSavedAmount: number;
  overallCompletionPercent: number;
  nextGoalNeedingAttention: {
    id: string;
    name: string;
    remainingAmount: number;
    progressPct: number;
    targetDate: string | null;
  } | null;
  goals: Array<{
    id: string;
    name: string;
    progressPct: number;
    currentValue: number;
    targetAmount: number;
    targetDate: string | null;
  }>;
  empty: boolean;
};

export type DashboardCashFlowSummary = {
  cycleLabel: string;
  cycleStartDate: string;
  cycleEndDate: string;
  daysLeft: number;
  spent: number;
  credits: number;
  budget: number | null;
  remainingBudget: number | null;
  projectedSpend: number;
  status: "needs_budget" | "on_track" | "over_pace" | "over_budget";
  previousCycleSpent: number | null;
  topCategories: Array<{ key: string; label: string; amount: number }>;
};

export type DashboardLiabilitiesSummary = {
  total: number;
  monthlyPayments: number;
  count: number;
  items: Array<{ id: string; name: string; categoryLabel: string; outstanding: number }>;
};

export type DashboardSyncStatus = {
  lastSyncedAt: string | null;
  syncedToday: boolean;
  failedCount: number;
  failedItems: Array<{ label: string; message: string }>;
};

export type DashboardInsight = {
  id: string;
  tone: "neutral" | "positive" | "warning" | "negative";
  title: string;
  message: string;
  href?: string;
};

export type DashboardData = {
  summary: DashboardSummary;
  assetClasses: DashboardAssetClassSummary[];
  allocation: DashboardAllocationPoint[];
  periodChanges: DashboardPeriodChange[];
  movers: { gainers: DashboardMover[]; losers: DashboardMover[] };
  cashFlow: DashboardCashFlowSummary | null;
  liabilities: DashboardLiabilitiesSummary;
  recentActivity: DashboardRecentActivityItem[];
  goalsSummary: DashboardGoalsSummary;
  insights: DashboardInsight[];
  /** Full history; the client filters by range. */
  history: DashboardHistoryPoint[];
  historyRange: DashboardHistoryRange;
  sync: DashboardSyncStatus;
  empty: boolean;
};

export type DashboardHistoryResponse = {
  range: DashboardHistoryRange;
  history: DashboardHistoryPoint[];
};
