export const DASHBOARD_HISTORY_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const;

export type DashboardHistoryRange = (typeof DASHBOARD_HISTORY_RANGES)[number];
export type DashboardAssetClassKey = "stocks" | "mutualFunds" | "gold" | "cash";

export type DashboardSummary = {
  totalCurrentWorth: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
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
};

export type DashboardAllocationPoint = {
  key: DashboardAssetClassKey;
  label: string;
  value: number;
  percentage: number;
};

export type DashboardHistoryPoint = {
  date: string;
  totalValue: number;
  stocksValue: number;
  mutualFundsValue: number;
  goldValue: number;
  cashValue: number;
};

export type DashboardRecentActivityItem = {
  id: string;
  date: string;
  assetClassKey: DashboardAssetClassKey;
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
  empty: boolean;
};

export type DashboardInsight = {
  id: string;
  tone: "neutral" | "positive" | "warning" | "negative";
  title: string;
  message: string;
};

export type DashboardData = {
  summary: DashboardSummary;
  assetClasses: DashboardAssetClassSummary[];
  allocation: DashboardAllocationPoint[];
  recentActivity: DashboardRecentActivityItem[];
  goalsSummary: DashboardGoalsSummary;
  insights: DashboardInsight[];
  history: DashboardHistoryPoint[];
  historyRange: DashboardHistoryRange;
  empty: boolean;
};

export type DashboardHistoryResponse = {
  range: DashboardHistoryRange;
  history: DashboardHistoryPoint[];
};
