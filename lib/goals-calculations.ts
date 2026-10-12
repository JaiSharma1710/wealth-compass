import {
  GOAL_WHOLE_CLASS_ID,
  type GoalAssetGroup,
  type GoalLinkInput,
  type GoalLinkSummary,
  type GoalLinkedAssetOption,
  type GoalStatus,
} from "@/lib/goals.types";


export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export type GoalProgress = {
  currentValue: number;
  fundedAmount: number;
  remainingAmount: number;
  progressPct: number;
  isCompleted: boolean;
  status: GoalStatus;
  monthsLeft: number | null;
  requiredMonthly: number | null;
  expectedPct: number | null;
};

/**
 * Progress, remaining amount and required monthly saving for one goal.
 *
 * Deliberately simple: no investment growth is assumed. Required monthly =
 * remaining / whole months left. "On track" compares actual progress against a
 * straight line from the day the goal was created to its target date.
 */
export function calculateGoalProgress(params: {
  targetAmount: number;
  currentValue: number;
  targetDate: Date | null;
  createdAt: Date;
  now?: Date;
}): GoalProgress {
  const now = params.now ?? new Date();
  const target = params.targetAmount;
  const currentValue = roundCurrency(Math.max(params.currentValue, 0));
  const fundedAmount = roundCurrency(Math.min(currentValue, target));
  const remainingAmount = roundCurrency(Math.max(target - currentValue, 0));
  const progressPct = target > 0 ? Math.min(100, roundCurrency((currentValue / target) * 100)) : 0;
  const isCompleted = target > 0 && currentValue >= target;

  const base = { currentValue, fundedAmount, remainingAmount, progressPct, isCompleted };

  if (isCompleted) {
    return { ...base, status: "completed", monthsLeft: null, requiredMonthly: null, expectedPct: null };
  }

  if (!params.targetDate) {
    return { ...base, status: "no_date", monthsLeft: null, requiredMonthly: null, expectedPct: null };
  }

  const msLeft = params.targetDate.getTime() - now.getTime();

  if (msLeft <= 0) {
    return { ...base, status: "overdue", monthsLeft: null, requiredMonthly: null, expectedPct: 100 };
  }

  // Calendar months, counting a partial final month as one (1 Jul -> 1 Jan = 6).
  const targetDay = params.targetDate;
  const wholeMonths =
    (targetDay.getUTCFullYear() - now.getUTCFullYear()) * 12 + (targetDay.getUTCMonth() - now.getUTCMonth());
  const monthsLeft = Math.max(1, wholeMonths + (targetDay.getUTCDate() > now.getUTCDate() ? 1 : 0));
  const requiredMonthly = roundCurrency(remainingAmount / monthsLeft);
  const totalMs = params.targetDate.getTime() - params.createdAt.getTime();
  const elapsedMs = now.getTime() - params.createdAt.getTime();
  const expectedPct =
    totalMs <= 0 ? 100 : roundCurrency(Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)));

  return {
    ...base,
    status: progressPct + 0.5 >= expectedPct ? "on_track" : "behind",
    monthsLeft,
    requiredMonthly,
    expectedPct,
  };
}

/**
 * Resolve a goal's links to values. Individual links are skipped in the total
 * when their whole asset class is also linked, so nothing is counted twice.
 */
export function resolveGoalLinks(
  links: GoalLinkInput[],
  assetGroups: GoalAssetGroup[],
  fallbackLabels: Map<string, string> = new Map()
): { links: GoalLinkSummary[]; currentValue: number } {
  const lookup = new Map<string, GoalLinkedAssetOption>();
  assetGroups.forEach((group) =>
    group.options.forEach((option) => lookup.set(`${option.assetType}::${option.investmentId}`, option))
  );
  const wholeClasses = new Set(
    links.filter((link) => link.investmentId === GOAL_WHOLE_CLASS_ID).map((link) => link.assetType)
  );
  const seen = new Set<string>();
  const resolved: GoalLinkSummary[] = [];
  let currentValue = 0;

  for (const link of links) {
    const key = `${link.assetType}::${link.investmentId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    const option = lookup.get(key);
    const isWholeClass = link.investmentId === GOAL_WHOLE_CLASS_ID;
    const isCounted = Boolean(option) && (isWholeClass || !wholeClasses.has(link.assetType));
    const value = option?.currentValue ?? 0;

    if (isCounted) currentValue += value;

    resolved.push({
      assetType: link.assetType,
      assetTypeLabel: option?.assetTypeLabel ?? link.assetType,
      investmentId: link.investmentId,
      label: option?.investmentLabel ?? fallbackLabels.get(key) ?? "Removed holding",
      detail: option?.investmentDetail ?? "",
      currentValue: roundCurrency(value),
      isWholeClass,
      isActive: Boolean(option),
      isCounted,
    });
  }

  return { links: resolved, currentValue: roundCurrency(currentValue) };
}

/** Legacy goals stored a single assetType + investmentId; treat that as a one-item links array. */
export function normalizeGoalLinks(doc: {
  links?: { assetType: string; investmentId: string }[] | null;
  assetType?: string | null;
  investmentId?: string | null;
}): GoalLinkInput[] {
  if (doc.links && doc.links.length > 0) {
    return doc.links.map((link) => ({
      assetType: link.assetType as GoalLinkInput["assetType"],
      investmentId: link.investmentId,
    }));
  }

  if (doc.assetType && doc.investmentId) {
    return [{ assetType: doc.assetType as GoalLinkInput["assetType"], investmentId: doc.investmentId }];
  }

  return [];
}
