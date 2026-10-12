import type {
  DashboardAllocationPoint,
  DashboardCashFlowSummary,
  DashboardPeriodChange,
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
  summary: Pick<
    DashboardSummary,
    "totalGainLoss" | "totalGainLossPercent" | "totalCurrentWorth" | "netWorth" | "totalLiabilities"
  >;
  allocation: DashboardAllocationPoint[];
  assetClasses: DashboardAssetClassSummary[];
  goalsSummary: DashboardGoalsSummary;
  cashFlow?: DashboardCashFlowSummary | null;
  periodChanges?: DashboardPeriodChange[];
  syncFailedCount?: number;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (input.empty) {
    insights.push({
      id: "empty-onboarding",
      tone: "neutral",
      title: "Start building your wealth map",
      message: "Add your first asset to unlock net worth, allocation, and growth tracking.",
      href: "/stocks",
    });

    return insights;
  }

  if (input.syncFailedCount) {
    insights.push({
      id: "sync-failed",
      tone: "warning",
      title: `${input.syncFailedCount} price${input.syncFailedCount === 1 ? "" : "s"} could not refresh`,
      message: "Those holdings keep their last known value until the next successful sync.",
    });
  } else if (input.hasStaleData) {
    insights.push({
      id: "stale-data",
      tone: "warning",
      title: "Prices are not from today",
      message: "Values use the last successful sync. They refresh automatically every morning.",
    });
  }

  const cash = input.assetClasses.find((assetClass) => assetClass.key === "cash");
  const monthlySpend = input.cashFlow
    ? Math.max(input.cashFlow.previousCycleSpent || 0, input.cashFlow.projectedSpend)
    : 0;

  if (cash && monthlySpend > 0) {
    const months = cash.currentValue / monthlySpend;

    insights.push({
      id: "emergency-fund",
      tone: months >= 6 ? "positive" : months >= 3 ? "neutral" : "warning",
      title: `Cash covers ${months >= 24 ? "24+" : months.toFixed(1)} months of expenses`,
      message:
        months >= 6
          ? "Your emergency fund is comfortably above the 6-month guideline."
          : "A 6-month cash buffer is the usual guideline for an emergency fund.",
      href: "/cash-and-reserves",
    });
  }

  if (input.cashFlow && input.cashFlow.status === "over_budget") {
    insights.push({
      id: "budget-overshoot",
      tone: "negative",
      title: "Spending is on course to exceed budget",
      message: `Projected spend this cycle is ${formatCompactInr(input.cashFlow.projectedSpend)} against a ${formatCompactInr(input.cashFlow.budget || 0)} budget.`,
      href: "/expenses",
    });
  }

  const topAllocation = input.allocation[0];

  if (topAllocation && topAllocation.percentage > 60) {
    insights.push({
      id: "concentration",
      tone: "warning",
      title: `${topAllocation.label} is ${topAllocation.percentage.toFixed(0)}% of your assets`,
      message: "A heavy tilt to one asset class raises risk. Consider whether this is intentional.",
    });
  }

  const investable = input.assetClasses.filter(
    (assetClass) => assetClass.currentValue > 0 && assetClass.investedAmount > 0 && assetClass.key !== "cash"
  );
  const useXirr = investable.length >= 2 && investable.every((assetClass) => assetClass.xirr != null);
  const metric = (assetClass: DashboardAssetClassSummary) =>
    useXirr ? assetClass.xirr || 0 : assetClass.gainLossPercent;
  const ranked = [...investable].sort((left, right) => metric(right) - metric(left));

  if (ranked.length >= 2) {
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const unit = useXirr ? "XIRR" : "return";

    insights.push({
      id: "best-asset",
      tone: "positive",
      title: `${best.label} lead with ${metric(best).toFixed(1)}% ${unit}`,
      message:
        metric(worst) < metric(best)
          ? `${worst.label} trail at ${metric(worst).toFixed(1)}%${useXirr ? " a year" : " overall"}.`
          : "All your investments are moving together.",
      href: best.actionHref,
    });
  }

  if (input.summary.totalLiabilities > 0 && input.summary.totalCurrentWorth > 0) {
    const ratio = (input.summary.totalLiabilities / input.summary.totalCurrentWorth) * 100;

    insights.push({
      id: "debt-ratio",
      tone: ratio > 50 ? "warning" : "neutral",
      title: `Debt is ${ratio.toFixed(0)}% of your assets`,
      message: ratio > 50 ? "Paying down high-interest loans first lifts net worth fastest." : "Your debt load is manageable relative to assets.",
      href: "/accounts",
    });
  }

  if (input.goalsSummary.empty) {
    insights.push({
      id: "no-goals",
      tone: "neutral",
      title: "No goals added yet",
      message: "Create a goal to connect your assets with a concrete target.",
      href: "/goals",
    });
  }

  return insights.slice(0, 6);
}

function formatCompactInr(value: number) {
  const abs = Math.abs(value);

  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Net-worth change over standard periods, measured from the latest snapshot on or
 * before each period's start. A period is null when no snapshot is old enough.
 */
export function buildPeriodChanges(
  history: DashboardHistoryPoint[],
  todayKey: string
): DashboardPeriodChange[] {
  const sorted = [...history].sort((left, right) => left.date.localeCompare(right.date));
  const latest = sorted.at(-1) || null;
  const periods: Array<{ key: DashboardPeriodChange["key"]; label: string; start: string }> = [
    { key: "1D", label: "1 day", start: shiftDateKey(todayKey, -1) },
    { key: "1W", label: "1 week", start: shiftDateKey(todayKey, -7) },
    { key: "1M", label: "1 month", start: shiftDateKey(todayKey, -30) },
    { key: "3M", label: "3 months", start: shiftDateKey(todayKey, -91) },
    { key: "6M", label: "6 months", start: shiftDateKey(todayKey, -182) },
    { key: "YTD", label: "This year", start: `${todayKey.slice(0, 4)}-01-01` },
    { key: "1Y", label: "1 year", start: shiftDateKey(todayKey, -365) },
  ];

  return periods.map((period) => {
    const base = [...sorted].reverse().find((point) => point.date <= period.start && point.date < (latest?.date || ""));

    if (!latest || !base) {
      return { key: period.key, label: period.label, change: null, changePercent: null, fromDate: null };
    }

    const change = roundCurrency(latest.totalValue - base.totalValue);

    return {
      key: period.key,
      label: period.label,
      change,
      changePercent: base.totalValue !== 0 ? roundPercent((change / Math.abs(base.totalValue)) * 100) : null,
      fromDate: base.date,
    };
  });
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

export function getAvailableHistoryRanges(
  history: DashboardHistoryPoint[],
  options: {
    ranges: DashboardHistoryRange[];
    now?: Date;
  }
) {
  const allTimeRange = options.ranges.includes("ALL") ? ["ALL" as const] : [];
  const validDates = history
    .map((point) => new Date(`${point.date}T00:00:00`))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!validDates.length) {
    return allTimeRange;
  }

  const oldestDate = validDates[0];
  const now = options.now || new Date();

  const availableRanges = options.ranges.filter((range) => {
    if (range === "ALL") {
      return true;
    }

    const start = getHistoryRangeStart(range, now);

    return Boolean(start && oldestDate <= start);
  });

  return availableRanges.includes("ALL") ? availableRanges : [...availableRanges, ...allTimeRange];
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
