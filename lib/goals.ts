import "server-only";

import { Types } from "mongoose";

import { getCashReserveDashboard } from "@/lib/cash-reserves";
import type { SafeUser } from "@/lib/auth";
import {
  calculateGoalProgress,
  normalizeGoalLinks,
  resolveGoalLinks,
  roundCurrency,
} from "@/lib/goals-calculations";
import {
  GOAL_ASSET_TYPES,
  GOAL_WHOLE_CLASS_ID,
  type GoalAssetGroup,
  type GoalAssetType,
  type GoalLinkInput,
  type GoalLinkedAssetOption,
  type GoalsOverview,
  type GoalsPageData,
  type GoalSummary,
  type SaveGoalInput,
} from "@/lib/goals.types";
import { getStockDashboard } from "@/lib/stocks";
import { getGoldDashboard } from "@/lib/gold";
import { Goal } from "@/lib/models/goal";
import { connectToDatabase } from "@/lib/mongodb";
import { getMutualFundDashboard } from "@/lib/mutual-funds";

type GoalLeanDocument = {
  _id: { toString(): string } | string;
  name: string;
  note?: string | null;
  targetAmount: number;
  targetDate?: Date | null;
  links?: { assetType: string; investmentId: string; label?: string }[] | null;
  assetType?: GoalAssetType | null;
  investmentId?: string | null;
  investmentLabel?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function option(
  assetType: GoalAssetType,
  assetTypeLabel: string,
  investmentId: string,
  investmentLabel: string,
  investmentDetail: string,
  currentValue: number,
  isWholeClass = false
): GoalLinkedAssetOption {
  return {
    assetType,
    assetTypeLabel,
    investmentId,
    investmentLabel,
    investmentDetail,
    currentValue: roundCurrency(currentValue),
    isAvailable: true,
    isWholeClass,
  };
}

function buildAssetGroups(params: {
  banks: string[];
  cashDashboard: Awaited<ReturnType<typeof getCashReserveDashboard>>;
  goldDashboard: Awaited<ReturnType<typeof getGoldDashboard>>;
  mutualFundDashboard: Awaited<ReturnType<typeof getMutualFundDashboard>>;
  stockDashboard: Awaited<ReturnType<typeof getStockDashboard>> | null;
}): GoalAssetGroup[] {
  const bankBalances = new Map(
    params.cashDashboard.bankDistribution.map((entry) => [entry.bank, entry.balance])
  );
  const banks = Array.from(new Set(params.banks.map((bank) => normalizeLabel(bank)).filter(Boolean)));
  const cashOptions: GoalLinkedAssetOption[] = banks.length
    ? [
        option("cash", "Cash", GOAL_WHOLE_CLASS_ID, "All cash", "Every bank account", params.cashDashboard.totalBalance, true),
        ...banks.map((bank) =>
          option("cash", "Cash", `cash::${bank}`, bank, "Bank account", bankBalances.get(bank) || 0)
        ),
      ]
    : [];

  const goldHoldings = params.goldDashboard.holdings;
  const goldOptions: GoalLinkedAssetOption[] = goldHoldings.length
    ? [
        option("gold", "Gold", GOAL_WHOLE_CLASS_ID, "All gold", `${goldHoldings.length} holdings`, goldHoldings.reduce((sum, h) => sum + h.currentValue, 0), true),
        ...goldHoldings.map((h) => option("gold", "Gold", h.id, h.schemeName, h.investmentOptionLabel, h.currentValue)),
      ]
    : [];

  const mfHoldings = params.mutualFundDashboard.holdings;
  const mutualFundOptions: GoalLinkedAssetOption[] = mfHoldings.length
    ? [
        option("mutual_fund", "Mutual Fund", GOAL_WHOLE_CLASS_ID, "All mutual funds", `${mfHoldings.length} schemes`, mfHoldings.reduce((sum, h) => sum + h.currentValue, 0), true),
        ...mfHoldings.map((h) =>
          option("mutual_fund", "Mutual Fund", String(h.schemeCode), h.schemeName, `${h.units} units`, h.currentValue)
        ),
      ]
    : [];

  const stockHoldings = (params.stockDashboard?.holdings || []).filter((h) => h.status === "ACTIVE");
  const stockOptions: GoalLinkedAssetOption[] = stockHoldings.length
    ? [
        option("stock", "Stocks", GOAL_WHOLE_CLASS_ID, "Entire stock portfolio", `${stockHoldings.length} stocks`, stockHoldings.reduce((sum, h) => sum + h.currentValue, 0), true),
        ...stockHoldings.map((h) =>
          option("stock", "Stocks", h.symbol, h.shortName || h.companyName || h.symbol, `${h.symbol} · ${h.quantity} shares`, h.currentValue)
        ),
      ]
    : [];

  return [
    {
      assetType: "cash",
      label: "Cash",
      description: "Bank balances. Link one bank or all of your cash.",
      available: cashOptions.length > 0,
      options: cashOptions,
      emptyMessage: "Add banks in Settings to link cash-backed goals.",
    },
    {
      assetType: "mutual_fund",
      label: "Mutual Funds",
      description: "One scheme or every mutual fund you hold.",
      available: mutualFundOptions.length > 0,
      options: mutualFundOptions,
      emptyMessage: "Buy a mutual fund before linking it to a goal.",
    },
    {
      assetType: "stock",
      label: "Stocks",
      description: "The whole stock portfolio or individual stocks.",
      available: stockOptions.length > 0,
      options: stockOptions,
      emptyMessage: "Add a stock holding to link it to a goal.",
    },
    {
      assetType: "gold",
      label: "Gold",
      description: "SGBs, ETFs and digital gold, one by one or all together.",
      available: goldOptions.length > 0,
      options: goldOptions,
      emptyMessage: "Create a gold holding first, then link it to a goal.",
    },
  ];
}

function buildGoalSummary(goal: GoalLeanDocument, assetGroups: GoalAssetGroup[], now: Date): GoalSummary {
  const links = normalizeGoalLinks(goal);
  const fallbackLabels = new Map<string, string>();

  (goal.links || []).forEach((link) => {
    if (link.label) fallbackLabels.set(`${link.assetType}::${link.investmentId}`, link.label);
  });

  if (goal.assetType && goal.investmentId && goal.investmentLabel) {
    fallbackLabels.set(`${goal.assetType}::${goal.investmentId}`, goal.investmentLabel);
  }

  const resolved = resolveGoalLinks(links, assetGroups, fallbackLabels);
  const createdAt = goal.createdAt ?? goal.updatedAt ?? now;
  const progress = calculateGoalProgress({
    targetAmount: goal.targetAmount,
    currentValue: resolved.currentValue,
    targetDate: goal.targetDate ?? null,
    createdAt,
    now,
  });

  return {
    id: String(goal._id),
    name: goal.name,
    note: goal.note || "",
    targetAmount: roundCurrency(goal.targetAmount),
    targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
    links: resolved.links,
    ...progress,
    createdAt: createdAt.toISOString(),
    updatedAt: (goal.updatedAt ?? createdAt).toISOString(),
  };
}

function buildOverview(goals: GoalSummary[]): GoalsOverview {
  const totalGoals = goals.length;
  const totalTargetAmount = roundCurrency(goals.reduce((sum, goal) => sum + goal.targetAmount, 0));
  const totalSavedAmount = roundCurrency(goals.reduce((sum, goal) => sum + goal.fundedAmount, 0));

  return {
    totalGoals,
    completedGoals: goals.filter((goal) => goal.isCompleted).length,
    totalTargetAmount,
    totalSavedAmount,
    averageProgressPct: totalGoals
      ? roundCurrency(goals.reduce((sum, goal) => sum + goal.progressPct, 0) / totalGoals)
      : 0,
    overallProgressPct: totalTargetAmount > 0 ? roundCurrency((totalSavedAmount / totalTargetAmount) * 100) : 0,
    totalRemainingAmount: roundCurrency(goals.reduce((sum, goal) => sum + goal.remainingAmount, 0)),
    totalRequiredMonthly: roundCurrency(goals.reduce((sum, goal) => sum + (goal.requiredMonthly || 0), 0)),
    behindGoals: goals.filter((goal) => goal.status === "behind" || goal.status === "overdue").length,
  };
}

export type GoalsPreloadedDashboards = {
  cash: Awaited<ReturnType<typeof getCashReserveDashboard>>;
  gold: Awaited<ReturnType<typeof getGoldDashboard>>;
  mutualFunds: Awaited<ReturnType<typeof getMutualFundDashboard>>;
  stocks?: Awaited<ReturnType<typeof getStockDashboard>>;
};

async function getGoalAssetGroupsForUser(user: SafeUser, preloaded?: GoalsPreloadedDashboards) {
  const [cashDashboard, goldDashboard, mutualFundDashboard, stockDashboard] = await Promise.all([
    preloaded?.cash ?? getCashReserveDashboard(user.id),
    preloaded?.gold ?? getGoldDashboard(user.id),
    preloaded?.mutualFunds ?? getMutualFundDashboard(user.id),
    preloaded?.stocks ?? getStockDashboard(user.id).catch(() => null),
  ]);

  return buildAssetGroups({
    banks: user.profile.banks,
    cashDashboard,
    goldDashboard,
    mutualFundDashboard,
    stockDashboard,
  });
}

export async function getGoalsPageData(
  user: SafeUser,
  preloaded?: GoalsPreloadedDashboards
): Promise<GoalsPageData> {
  await connectToDatabase();

  const [assetGroups, goals] = await Promise.all([
    getGoalAssetGroupsForUser(user, preloaded),
    Goal.find({ userId: new Types.ObjectId(user.id) }).sort({ createdAt: -1 }).lean<GoalLeanDocument[]>(),
  ]);

  const now = new Date();
  const goalSummaries = goals
    .map((goal) => buildGoalSummary(goal, assetGroups, now))
    .sort((left, right) => {
      if (left.isCompleted !== right.isCompleted) {
        return left.isCompleted ? 1 : -1;
      }

      return right.remainingAmount - left.remainingAmount;
    });

  return {
    overview: buildOverview(goalSummaries),
    goals: goalSummaries,
    assetGroups,
  };
}

async function validateGoalInput(user: SafeUser, input: SaveGoalInput) {
  const name = normalizeLabel(input.name || "");
  const note = (input.note || "").trim();
  const targetDate = (input.targetDate || "").trim();

  if (name.length < 2 || name.length > 120) {
    throw new Error("Goal name must be between 2 and 120 characters.");
  }

  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error("Target amount must be greater than zero.");
  }

  if (note.length > 300) {
    throw new Error("Note must be 300 characters or fewer.");
  }

  const parsedTargetDate = targetDate ? parseDateOnly(targetDate) : null;

  if (targetDate && !parsedTargetDate) {
    throw new Error("Target date must be a valid date.");
  }

  const requested: GoalLinkInput[] = Array.isArray(input.links) ? input.links : [];

  if (requested.length === 0) {
    throw new Error("Link at least one investment to this goal.");
  }

  const assetGroups = await getGoalAssetGroupsForUser(user);
  const links: { assetType: GoalAssetType; investmentId: string; label: string }[] = [];
  const seen = new Set<string>();

  for (const link of requested) {
    const key = `${link.assetType}::${link.investmentId}`;

    if (seen.has(key)) continue;
    seen.add(key);

    if (!GOAL_ASSET_TYPES.includes(link.assetType)) {
      throw new Error("Unknown asset type in linked sources.");
    }

    const selected = assetGroups
      .find((group) => group.assetType === link.assetType)
      ?.options.find((candidate) => candidate.investmentId === link.investmentId);

    if (!selected) {
      throw new Error("One of the linked investments is no longer available.");
    }

    links.push({ assetType: link.assetType, investmentId: link.investmentId, label: selected.investmentLabel });
  }

  return {
    name,
    note,
    targetAmount: roundCurrency(input.targetAmount),
    targetDate: parsedTargetDate,
    links,
  };
}

export async function createGoal(user: SafeUser, input: SaveGoalInput) {
  const data = await validateGoalInput(user, input);

  await connectToDatabase();
  await Goal.create({ userId: user.id, ...data });
}

export async function updateGoal(user: SafeUser, goalId: string, input: SaveGoalInput) {
  if (!Types.ObjectId.isValid(goalId)) {
    throw new Error("Invalid goal ID.");
  }

  const data = await validateGoalInput(user, input);

  await connectToDatabase();

  const updated = await Goal.findOneAndUpdate(
    { _id: new Types.ObjectId(goalId), userId: new Types.ObjectId(user.id) },
    {
      $set: data,
      // Legacy single-link fields are superseded by `links`.
      $unset: { assetType: "", investmentId: "", investmentLabel: "", investmentDetail: "" },
    },
    { new: true }
  );

  if (!updated) {
    throw new Error("Goal not found.");
  }
}

export async function deleteGoal(userId: string, goalId: string) {
  if (!Types.ObjectId.isValid(goalId)) {
    throw new Error("Invalid goal ID.");
  }

  await connectToDatabase();

  const deletedGoal = await Goal.findOneAndDelete({
    _id: new Types.ObjectId(goalId),
    userId: new Types.ObjectId(userId),
  });

  if (!deletedGoal) {
    throw new Error("Goal not found.");
  }
}
