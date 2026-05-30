import type {
  DashboardAllocationPoint,
  DashboardAssetClassKey,
  DashboardAssetClassSummary,
  DashboardGoalsSummary,
  DashboardHistoryPoint,
  DashboardHistoryRange,
  DashboardInsight,
  DashboardRecentActivityItem,
  DashboardSummary,
} from "@/lib/dashboard.types";

export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateGainLossPercent(currentValue: number, investedAmount: number) {
  const gainLoss = roundCurrency(currentValue - investedAmount);
  const gainLossPercent =
    investedAmount > 0 ? roundPercent((gainLoss / investedAmount) * 100) : 0;

  return {
    gainLoss,
    gainLossPercent,
  };
}

export function calculateAllocationPercent(value: number, totalValue: number) {
  return totalValue > 0 ? roundPercent((value / totalValue) * 100) : 0;
}

export function buildDashboardSummary(input: {
  assetClasses: DashboardAssetClassSummary[];
}): DashboardSummary {
  const totalCurrentWorth = roundCurrency(
    input.assetClasses.reduce((sum, assetClass) => sum + assetClass.currentValue, 0)
  );
  const totalInvested = roundCurrency(
    input.assetClasses.reduce((sum, assetClass) => sum + assetClass.investedAmount, 0)
  );
  const { gainLoss: totalGainLoss, gainLossPercent: totalGainLossPercent } =
    calculateGainLossPercent(totalCurrentWorth, totalInvested);
  const availableTodayAssets = input.assetClasses.filter(
    (assetClass) => assetClass.todayGainLoss != null
  );
  const todayGainLoss =
    availableTodayAssets.length > 0
      ? roundCurrency(
          availableTodayAssets.reduce(
            (sum, assetClass) => sum + (assetClass.todayGainLoss || 0),
            0
          )
        )
      : null;
  const todayGainLossPercent =
    todayGainLoss != null && totalCurrentWorth - todayGainLoss > 0
      ? roundPercent((todayGainLoss / (totalCurrentWorth - todayGainLoss)) * 100)
      : null;
  const lastUpdatedAt =
    input.assetClasses
      .map((assetClass) => assetClass.detail)
      .filter(() => false)
      .at(0) || null;

  return {
    totalCurrentWorth,
    totalInvested,
    totalGainLoss,
    totalGainLossPercent,
    todayGainLoss,
    todayGainLossPercent,
    todayMovementAvailableAssetKeys: availableTodayAssets.map((assetClass) => assetClass.key),
    todayMovementUnavailableAssetKeys: input.assetClasses
      .filter((assetClass) => assetClass.todayGainLoss == null)
      .map((assetClass) => assetClass.key),
    lastUpdatedAt: lastUpdatedAt,
    hasStaleData: input.assetClasses.some((assetClass) => assetClass.stale),
  };
}

export function attachAllocationPercent<T extends { currentValue: number; key: DashboardAssetClassKey; label: string }>(
  items: T[]
): DashboardAllocationPoint[] {
  const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0);

  return items
    .filter((item) => item.currentValue > 0)
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: roundCurrency(item.currentValue),
      percentage: calculateAllocationPercent(item.currentValue, totalValue),
    }))
    .sort((left, right) => right.value - left.value);
}

export function sortRecentActivity(
  activity: DashboardRecentActivityItem[]
): DashboardRecentActivityItem[] {
  return [...activity].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}

export function buildDashboardInsights(input: {
  empty: boolean;
  hasStaleData: boolean;
  summary: Pick<DashboardSummary, "totalGainLoss" | "totalGainLossPercent" | "totalCurrentWorth">;
  allocation: DashboardAllocationPoint[];
  assetClasses: DashboardAssetClassSummary[];
  goalsSummary: DashboardGoalsSummary;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (input.empty) {
    insights.push({
      id: "empty-onboarding",
      tone: "neutral",
      title: "Start building your wealth map",
      message: "Add your first asset to unlock net worth, allocation, and growth tracking.",
    });

    return insights;
  }

  if (input.hasStaleData) {
    insights.push({
      id: "stale-data",
      tone: "warning",
      title: "Some values may be stale",
      message: "One or more asset classes could not refresh live values successfully.",
    });
  }

  const topAllocation = input.allocation[0];

  if (topAllocation && topAllocation.percentage > 70) {
    insights.push({
      id: "concentration",
      tone: "warning",
      title: `${topAllocation.label} dominates your portfolio`,
      message: `${topAllocation.label} accounts for ${topAllocation.percentage.toFixed(
        2
      )}% of your total current worth.`,
    });
  }

  const cashAsset = input.assetClasses.find((assetClass) => assetClass.key === "cash");

  if (
    cashAsset &&
    input.summary.totalCurrentWorth > 0 &&
    calculateAllocationPercent(cashAsset.currentValue, input.summary.totalCurrentWorth) < 10
  ) {
    insights.push({
      id: "low-liquidity",
      tone: "warning",
      title: "Liquidity is on the lower side",
      message: "Cash and reserves are below 10% of your total current worth.",
    });
  }

  if (input.summary.totalGainLoss > 0) {
    insights.push({
      id: "portfolio-up",
      tone: "positive",
      title: "Your portfolio is in profit",
      message: `Overall wealth is up ${input.summary.totalGainLossPercent.toFixed(2)}%.`,
    });
  } else if (input.summary.totalGainLoss < 0) {
    insights.push({
      id: "portfolio-down",
      tone: "negative",
      title: "Your portfolio is below cost",
      message: `Overall wealth is down ${Math.abs(
        input.summary.totalGainLossPercent
      ).toFixed(2)}% from contributed capital.`,
    });
  }

  const bestAsset = [...input.assetClasses].sort(
    (left, right) => right.gainLossPercent - left.gainLossPercent
  )[0];
  const worstAsset = [...input.assetClasses].sort(
    (left, right) => left.gainLossPercent - right.gainLossPercent
  )[0];

  if (bestAsset && bestAsset.currentValue > 0) {
    insights.push({
      id: "best-asset",
      tone: "positive",
      title: `${bestAsset.label} is performing best`,
      message: `${bestAsset.label} is up ${bestAsset.gainLossPercent.toFixed(2)}%.`,
    });
  }

  if (worstAsset && worstAsset.currentValue > 0 && worstAsset.gainLossPercent < 0) {
    insights.push({
      id: "worst-asset",
      tone: "neutral",
      title: `${worstAsset.label} needs attention`,
      message: `${worstAsset.label} is down ${Math.abs(
        worstAsset.gainLossPercent
      ).toFixed(2)}%.`,
    });
  }

  if (input.goalsSummary.empty) {
    insights.push({
      id: "no-goals",
      tone: "neutral",
      title: "No goals added yet",
      message: "Create a goal to connect your assets with a concrete target.",
    });
  }

  return insights.slice(0, 6);
}

export function getHistoryRangeStart(range: DashboardHistoryRange, now = new Date()) {
  const start = new Date(now);

  switch (range) {
    case "1W":
      start.setDate(start.getDate() - 7);
      return start;
    case "1M":
      start.setDate(start.getDate() - 30);
      return start;
    case "3M":
      start.setDate(start.getDate() - 90);
      return start;
    case "6M":
      start.setDate(start.getDate() - 180);
      return start;
    case "1Y":
      start.setDate(start.getDate() - 365);
      return start;
    case "ALL":
    default:
      return null;
  }
}

export function filterHistoryByRange(
  history: DashboardHistoryPoint[],
  range: DashboardHistoryRange,
  now = new Date()
) {
  const start = getHistoryRangeStart(range, now);

  if (!start) {
    return [...history];
  }

  return history.filter((point) => new Date(point.date) >= start);
}

export function getDateKeyInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}
